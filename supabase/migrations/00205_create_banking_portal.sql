-- supabase/migrations/00205_create_banking_portal.sql
-- The reconciliation screen, and the one routine that was missing behind it.
--
-- Everything needed to pull a statement in was already here: connections,
-- feed accounts, sync runs, suggestions, memory and splits. What was missing
-- was a way to drive it from the interface. This file adds the reads the
-- screen needs, folds the two suggestion routines into one answer so the
-- person deciding sees every candidate in one list, and lets a line be
-- matched to an expense or an unpaid bill rather than to a payment only.
-- A line nobody can explain can finally be set aside with a reason, which is
-- what keeps the queue honest.

-- -----------------------------------------------------------------------------
-- What is connected, and how healthy it is
-- -----------------------------------------------------------------------------

create or replace function public.company_feed_accounts(
  p_company_id uuid
)
returns table (
  feed_account_id uuid,
  connection_id uuid,
  institution_name text,
  connection_status text,
  provider text,
  account_name text,
  account_mask text,
  account_type text,
  currency char(3),
  current_balance numeric,
  balance_updated_at timestamptz,
  is_linked boolean,
  is_ignored boolean,
  bank_account_id uuid,
  bank_account_name text,
  last_transaction_date date,
  consent_expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'Those bank feeds belong to another business' using errcode = '42501';
  end if;

  return query
  select f.id,
         c.id,
         c.institution_name,
         c.status,
         c.provider,
         f.account_name,
         f.account_mask,
         f.account_type,
         f.currency,
         f.current_balance,
         f.balance_updated_at,
         f.is_linked,
         f.is_ignored,
         f.bank_account_id,
         a.name,
         f.last_transaction_date,
         c.consent_expires_at
    from public.bank_feed_accounts as f
    join public.bank_feed_connections as c on c.id = f.connection_id
    left join public.bank_accounts as a on a.id = f.bank_account_id
   where f.company_id = p_company_id
     and f.deleted_at is null
     and c.deleted_at is null
   order by c.institution_name, f.account_name;
end;
$$;

comment on function public.company_feed_accounts(uuid) is
  'Lists every account an aggregator reported and the ledger account it feeds.';

-- -----------------------------------------------------------------------------
-- The queue, with enough on it to decide
-- -----------------------------------------------------------------------------

create or replace function public.bank_lines_to_review(
  p_company_id uuid,
  p_limit integer default 50
)
returns table (
  bank_transaction_id uuid,
  bank_account_id uuid,
  bank_account_name text,
  transaction_date date,
  amount numeric,
  currency char(3),
  description text,
  counterparty_name text,
  reference text,
  status text,
  import_source text,
  suggestion_count integer,
  best_confidence numeric,
  remembered_confidence numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'Those statement lines belong to another business'
      using errcode = '42501';
  end if;

  return query
  select t.id,
         t.bank_account_id,
         a.name,
         t.transaction_date,
         t.amount,
         t.currency,
         t.description,
         t.counterparty_name,
         t.reference,
         t.status,
         t.import_source,
         coalesce(s.suggestion_count, 0)::integer,
         coalesce(s.best_confidence, 0),
         coalesce(r.confidence, 0)
    from public.bank_transactions as t
    join public.bank_accounts as a on a.id = t.bank_account_id
    left join lateral (
      select count(*)::integer as suggestion_count,
             max(m.confidence) as best_confidence
        from public.reconciliation_matches as m
       where m.bank_transaction_id = t.id
         and m.unmatched_at is null
         and not m.is_confirmed
    ) as s on true
    left join lateral (
      select rc.confidence
        from public.recall_reconciliation_choice(t.id) as rc
       limit 1
    ) as r on true
   where t.company_id = p_company_id
     and t.status in ('unmatched', 'suggested')
     and not t.is_ignored
   order by t.transaction_date, t.created_at
   limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

comment on function public.bank_lines_to_review(uuid, integer) is
  'Lists the statement lines waiting for a decision, with what is known about each.';

-- Money in and money out are explained by different kinds of record, so the
-- screen asks once and gets every candidate in one list.
create or replace function public.candidate_matches(
  p_bank_transaction_id uuid,
  p_limit integer default 5
)
returns table (
  record_type text,
  record_id uuid,
  record_label text,
  matched_amount numeric,
  confidence numeric,
  match_reason text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_line public.bank_transactions%rowtype;
begin
  select * into v_line
    from public.bank_transactions
   where id = p_bank_transaction_id;

  if not found then
    return;
  end if;

  if not coalesce(
    public.is_service_role() or public.has_company_access(v_line.company_id),
    false
  ) then
    raise exception 'That statement line belongs to another business'
      using errcode = '42501';
  end if;

  if v_line.amount > 0 then
    return query
    select 'payment'::text,
           candidate.payment_id,
           coalesce(c.display_name, 'Payment received'),
           candidate.matched_amount,
           candidate.confidence,
           candidate.match_reason
      from public.suggest_bank_matches(p_bank_transaction_id, p_limit) as candidate
      join public.payments as p on p.id = candidate.payment_id
      left join public.clients as c on c.id = p.client_id
     order by candidate.confidence desc;
  else
    return query
    select candidate.record_type,
           candidate.record_id,
           case candidate.record_type
             when 'expense' then coalesce(
               (select e.description from public.expenses as e where e.id = candidate.record_id),
               'Expense'
             )
             else coalesce(
               (select b.bill_number from public.supplier_bills as b
                 where b.id = candidate.record_id),
               'Supplier bill'
             )
           end,
           candidate.matched_amount,
           candidate.confidence,
           candidate.match_reason
      from public.suggest_spending_matches(p_bank_transaction_id, p_limit) as candidate
     order by candidate.confidence desc;
  end if;
end;
$$;

comment on function public.candidate_matches(uuid, integer) is
  'Returns every record that could explain one statement line, best first.';

-- -----------------------------------------------------------------------------
-- Settling a line
-- -----------------------------------------------------------------------------

-- Money leaving the account is explained by an expense or a bill, which the
-- older routine could not record. One entry point now covers all three, so
-- the interface never has to know which table it is writing to.
create or replace function public.settle_bank_line(
  p_bank_transaction_id uuid,
  p_record_type text,
  p_record_id uuid,
  p_confidence numeric default 100
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_line public.bank_transactions%rowtype;
  v_match_id uuid;
  v_amount numeric;
  v_confidence numeric := least(greatest(coalesce(p_confidence, 100), 0), 100);
begin
  select * into v_line
    from public.bank_transactions
   where id = p_bank_transaction_id
     for update;

  if not found then
    raise exception 'That statement line was not found' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.can_write_company_data(v_line.company_id),
    false
  ) then
    raise exception 'That statement line is not yours to settle' using errcode = '42501';
  end if;

  if v_line.status = 'matched' then
    raise exception 'This statement line has already been matched' using errcode = '22023';
  end if;

  if p_record_type = 'payment' then
    return public.match_bank_transaction(p_bank_transaction_id, p_record_id, 'manual',
                                         v_confidence);
  end if;

  if p_record_type = 'expense' then
    select e.total_amount into v_amount
      from public.expenses as e
     where e.id = p_record_id
       and e.company_id = v_line.company_id
       and e.deleted_at is null;

    if v_amount is null then
      raise exception 'That expense belongs to another business' using errcode = '42501';
    end if;

    if exists (
      select 1 from public.reconciliation_matches as m
       where m.expense_id = p_record_id and m.unmatched_at is null
    ) then
      raise exception 'That expense has already been reconciled' using errcode = '22023';
    end if;

    insert into public.reconciliation_matches (
      company_id, bank_transaction_id, expense_id, matched_amount, confidence,
      match_method, is_confirmed, confirmed_at, confirmed_by
    )
    values (
      v_line.company_id, p_bank_transaction_id, p_record_id, v_line.amount,
      v_confidence, 'manual', true, now(), public.current_user_id()
    )
    returning id into v_match_id;
  elsif p_record_type = 'supplier_bill' then
    select b.total_amount into v_amount
      from public.supplier_bills as b
     where b.id = p_record_id
       and b.company_id = v_line.company_id
       and b.deleted_at is null;

    if v_amount is null then
      raise exception 'That bill belongs to another business' using errcode = '42501';
    end if;

    if exists (
      select 1 from public.reconciliation_matches as m
       where m.supplier_bill_id = p_record_id and m.unmatched_at is null
    ) then
      raise exception 'That bill has already been reconciled' using errcode = '22023';
    end if;

    insert into public.reconciliation_matches (
      company_id, bank_transaction_id, supplier_bill_id, matched_amount, confidence,
      match_method, is_confirmed, confirmed_at, confirmed_by
    )
    values (
      v_line.company_id, p_bank_transaction_id, p_record_id, v_line.amount,
      v_confidence, 'manual', true, now(), public.current_user_id()
    )
    returning id into v_match_id;
  else
    raise exception 'A statement line cannot be settled against a %', p_record_type
      using errcode = '22023';
  end if;

  update public.bank_transactions
     set status = 'matched',
         matched_at = now(),
         matched_by = public.current_user_id(),
         match_confidence = v_confidence,
         updated_at = now()
   where id = p_bank_transaction_id;

  return v_match_id;
end;
$$;

comment on function public.settle_bank_line(uuid, text, uuid, numeric) is
  'Records that one statement line is explained by a payment, an expense or a bill.';

-- A line that is genuinely nothing to do with the books is set aside with a
-- reason, rather than left in the queue for ever.
create or replace function public.ignore_bank_line(
  p_bank_transaction_id uuid,
  p_reason text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_status text;
begin
  select company_id, status into v_company_id, v_status
    from public.bank_transactions
   where id = p_bank_transaction_id;

  if v_company_id is null then
    raise exception 'That statement line was not found' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.can_write_company_data(v_company_id),
    false
  ) then
    raise exception 'That statement line is not yours to change' using errcode = '42501';
  end if;

  if v_status = 'matched' then
    raise exception 'A matched line has to be unmatched before it can be set aside'
      using errcode = '22023';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Say why this line is being set aside' using errcode = '22023';
  end if;

  update public.bank_transactions
     set is_ignored = true,
         ignore_reason = btrim(p_reason),
         status = 'ignored',
         updated_at = now()
   where id = p_bank_transaction_id;

  return true;
end;
$$;

comment on function public.ignore_bank_line(uuid, text) is
  'Sets one statement line aside with a reason, keeping the queue honest.';

-- -----------------------------------------------------------------------------
-- How a feed behaves
-- -----------------------------------------------------------------------------

create or replace function public.set_feed_frequency(
  p_connection_id uuid,
  p_sync_frequency_hours smallint
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id
    from public.bank_feed_connections
   where id = p_connection_id and deleted_at is null;

  if v_company_id is null then
    raise exception 'That connection was not found' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.is_company_owner(v_company_id),
    false
  ) then
    raise exception 'Only the owner of a business can change its bank feeds'
      using errcode = '42501';
  end if;

  if p_sync_frequency_hours is null
     or p_sync_frequency_hours < 1
     or p_sync_frequency_hours > 168 then
    raise exception 'A feed can be read between once an hour and once a week'
      using errcode = '22023';
  end if;

  update public.bank_feed_connections
     set sync_frequency_hours = p_sync_frequency_hours,
         next_sync_at = coalesce(last_synced_at, now())
                        + make_interval(hours => p_sync_frequency_hours),
         updated_by = public.current_user_id(),
         updated_at = now()
   where id = p_connection_id;

  return true;
end;
$$;

comment on function public.set_feed_frequency(uuid, smallint) is
  'Chooses how often one bank connection is read.';

-- -----------------------------------------------------------------------------
-- One picture of the books against the bank
-- -----------------------------------------------------------------------------

create or replace function public.reconciliation_overview(
  p_company_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'That account is not yours to read' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'connections', (
      select count(*)::int
        from public.bank_feed_connections
       where company_id = p_company_id
         and deleted_at is null
         and status <> 'disconnected'
    ),
    'connections_needing_attention', (
      select count(*)::int
        from public.bank_feed_connections
       where company_id = p_company_id
         and deleted_at is null
         and status in ('reauthorization_required', 'expired', 'error')
    ),
    'linked_accounts', (
      select count(*)::int
        from public.bank_feed_accounts
       where company_id = p_company_id
         and deleted_at is null
         and is_linked
    ),
    'unlinked_accounts', (
      select count(*)::int
        from public.bank_feed_accounts
       where company_id = p_company_id
         and deleted_at is null
         and not is_linked
         and not is_ignored
    ),
    'lines_to_review', (
      select count(*)::int
        from public.bank_transactions
       where company_id = p_company_id
         and status in ('unmatched', 'suggested')
         and not is_ignored
    ),
    'value_to_review', (
      select coalesce(round(sum(abs(amount)), 4), 0)
        from public.bank_transactions
       where company_id = p_company_id
         and status in ('unmatched', 'suggested')
         and not is_ignored
    ),
    'oldest_unreviewed_date', (
      select min(transaction_date)
        from public.bank_transactions
       where company_id = p_company_id
         and status in ('unmatched', 'suggested')
         and not is_ignored
    ),
    'matched_last_30_days', (
      select count(*)::int
        from public.bank_transactions
       where company_id = p_company_id
         and status = 'matched'
         and matched_at >= now() - interval '30 days'
    ),
    'learned_counterparties', (
      select count(*)::int
        from public.reconciliation_memory
       where company_id = p_company_id
    )
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.reconciliation_overview(uuid) is
  'One figure each for feed health, the queue and what the engine has learned.';

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.company_feed_accounts(uuid)
  from public, authenticated;
revoke execute on function public.bank_lines_to_review(uuid, integer)
  from public, authenticated;
revoke execute on function public.candidate_matches(uuid, integer)
  from public, authenticated;
revoke execute on function public.settle_bank_line(uuid, text, uuid, numeric)
  from public, authenticated;
revoke execute on function public.ignore_bank_line(uuid, text)
  from public, authenticated;
revoke execute on function public.set_feed_frequency(uuid, smallint)
  from public, authenticated;
revoke execute on function public.reconciliation_overview(uuid)
  from public, authenticated;

grant execute on function public.company_feed_accounts(uuid)
  to authenticated, service_role;
grant execute on function public.bank_lines_to_review(uuid, integer)
  to authenticated, service_role;
grant execute on function public.candidate_matches(uuid, integer)
  to authenticated, service_role;
grant execute on function public.settle_bank_line(uuid, text, uuid, numeric)
  to authenticated, service_role;
grant execute on function public.ignore_bank_line(uuid, text)
  to authenticated, service_role;
grant execute on function public.set_feed_frequency(uuid, smallint)
  to authenticated, service_role;
grant execute on function public.reconciliation_overview(uuid)
  to authenticated, service_role;

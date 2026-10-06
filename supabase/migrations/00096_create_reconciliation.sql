-- supabase/migrations/00096_create_reconciliation.sql
-- Matching statement lines to the records that explain them.
--
-- The suggestion engine is deliberately conservative: it proposes, a person
-- confirms, and the confirmation is recorded with the score that produced it.
-- A match can always be undone, which is what makes people willing to use it.

create table public.reconciliation_matches (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  bank_transaction_id uuid not null,

  -- Exactly one of these explains the line.
  payment_id uuid,
  expense_id uuid,
  supplier_bill_id uuid,
  payout_id uuid,
  journal_entry_id uuid,

  matched_amount numeric(18, 4) not null,
  confidence numeric(5, 2) not null default 100,
  match_method text not null default 'manual',
  match_reason text,

  is_confirmed boolean not null default false,
  confirmed_at timestamptz,
  confirmed_by uuid,
  unmatched_at timestamptz,
  unmatched_by uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reconciliation_matches_amount_check
    check (matched_amount <> 0),
  constraint reconciliation_matches_confidence_check
    check (confidence between 0 and 100),
  constraint reconciliation_matches_method_check
    check (match_method in ('manual', 'exact_amount', 'amount_and_date',
                            'reference', 'rule', 'provider_payout')),
  constraint reconciliation_matches_target_check
    check (
      (payment_id is not null)::integer
      + (expense_id is not null)::integer
      + (supplier_bill_id is not null)::integer
      + (payout_id is not null)::integer
      + (journal_entry_id is not null)::integer = 1
    )
);

comment on table public.reconciliation_matches is
  'What a statement line was matched to, how confident the match was, and who confirmed it.';

create index reconciliation_matches_transaction_idx
  on public.reconciliation_matches (bank_transaction_id)
  where unmatched_at is null;

create index reconciliation_matches_payment_idx
  on public.reconciliation_matches (payment_id)
  where payment_id is not null and unmatched_at is null;

create unique index reconciliation_matches_confirmed_unique
  on public.reconciliation_matches (bank_transaction_id)
  where is_confirmed and unmatched_at is null;

-- -----------------------------------------------------------------------------
-- Rules
-- -----------------------------------------------------------------------------

-- A tenant teaches the engine its own habits: this description always means
-- that account, that vendor, that category.
create table public.reconciliation_rules (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  name text not null,
  priority smallint not null default 100,
  is_active boolean not null default true,

  -- Conditions. A null condition is simply not tested.
  description_contains text,
  counterparty_contains text,
  amount_equals numeric(18, 4),
  amount_minimum numeric(18, 4),
  amount_maximum numeric(18, 4),
  direction text,
  bank_account_id uuid,

  -- What to do when the conditions hold.
  set_ledger_account_id uuid,
  set_vendor_id uuid,
  set_expense_category_id uuid,
  auto_confirm boolean not null default false,

  match_count integer not null default 0,
  last_matched_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint reconciliation_rules_name_check
    check (length(btrim(name)) between 2 and 80),
  constraint reconciliation_rules_direction_check
    check (direction is null or direction in ('money_in', 'money_out')),
  constraint reconciliation_rules_range_check
    check (amount_minimum is null or amount_maximum is null
           or amount_maximum >= amount_minimum),
  constraint reconciliation_rules_condition_check
    check (description_contains is not null or counterparty_contains is not null
           or amount_equals is not null or amount_minimum is not null
           or amount_maximum is not null)
);

comment on table public.reconciliation_rules is
  'Patterns a tenant has taught the matcher about its own statement lines.';

create index reconciliation_rules_company_idx
  on public.reconciliation_rules (company_id, priority)
  where is_active and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Suggestions
-- -----------------------------------------------------------------------------

-- Proposes what a statement line probably is. Nothing is written: the caller
-- shows the list and a person picks.
create or replace function public.suggest_bank_matches(
  p_bank_transaction_id uuid,
  p_limit integer default 5
)
returns table (
  payment_id uuid,
  matched_amount numeric,
  confidence numeric,
  match_method text,
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
  select * into v_line from public.bank_transactions where id = p_bank_transaction_id;

  if not found or v_line.amount <= 0 then
    return;
  end if;

  return query
  select p.id,
         p.amount,
         case
           when p.amount = v_line.amount and coalesce(p.value_date, p.received_at::date) = v_line.transaction_date
             then 100::numeric
           when p.amount = v_line.amount
                and abs(coalesce(p.value_date, p.received_at::date) - v_line.transaction_date) <= 3
             then 90::numeric
           when p.amount = v_line.amount
             then 75::numeric
           else 60::numeric
         end,
         case
           when p.amount = v_line.amount and coalesce(p.value_date, p.received_at::date) = v_line.transaction_date
             then 'exact_amount'
           else 'amount_and_date'
         end,
         case
           when p.amount = v_line.amount and coalesce(p.value_date, p.received_at::date) = v_line.transaction_date
             then 'The amount and the date both agree'
           when p.amount = v_line.amount
             then 'The amount agrees and the date is close'
           else 'The amount is close to this payment'
         end
    from public.payments as p
   where p.company_id = v_line.company_id
     and p.deleted_at is null
     and p.reconciled_at is null
     and p.status = 'succeeded'
     and abs(p.amount - v_line.amount) <= greatest(round(v_line.amount * 0.01, 4), 0.5)
     and abs(coalesce(p.value_date, p.received_at::date) - v_line.transaction_date) <= 10
   order by abs(p.amount - v_line.amount),
            abs(coalesce(p.value_date, p.received_at::date) - v_line.transaction_date)
   limit greatest(coalesce(p_limit, 5), 1);
end;
$$;

comment on function public.suggest_bank_matches(uuid, integer) is
  'Proposes the payments that could explain a statement line, best first.';

-- Confirms a match between a statement line and a payment.
create or replace function public.match_bank_transaction(
  p_bank_transaction_id uuid,
  p_payment_id uuid,
  p_method text default 'manual',
  p_confidence numeric default 100
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_line public.bank_transactions%rowtype;
  v_payment public.payments%rowtype;
  v_match_id uuid;
begin
  select * into v_line
    from public.bank_transactions
   where id = p_bank_transaction_id for update;

  if not found then
    raise exception 'Statement line % was not found', p_bank_transaction_id
      using errcode = 'P0002';
  end if;

  if v_line.status = 'matched' then
    raise exception 'This statement line has already been matched'
      using errcode = '22023';
  end if;

  select * into v_payment
    from public.payments
   where id = p_payment_id and deleted_at is null for update;

  if not found then
    raise exception 'Payment % was not found', p_payment_id using errcode = 'P0002';
  end if;

  if v_payment.company_id <> v_line.company_id then
    raise exception 'The payment belongs to a different account'
      using errcode = '42501';
  end if;

  if v_payment.reconciled_at is not null then
    raise exception 'This payment has already been reconciled'
      using errcode = '22023';
  end if;

  insert into public.reconciliation_matches (
    company_id, bank_transaction_id, payment_id, matched_amount, confidence,
    match_method, is_confirmed, confirmed_at, confirmed_by
  )
  values (
    v_line.company_id, p_bank_transaction_id, p_payment_id, v_line.amount,
    least(greatest(coalesce(p_confidence, 100), 0), 100), p_method, true, now(),
    public.current_user_id()
  )
  returning id into v_match_id;

  update public.bank_transactions
     set status = 'matched',
         matched_at = now(),
         matched_by = public.current_user_id(),
         match_confidence = least(greatest(coalesce(p_confidence, 100), 0), 100),
         updated_at = now()
   where id = p_bank_transaction_id;

  update public.payments
     set reconciled_at = now(),
         bank_transaction_id = p_bank_transaction_id,
         updated_at = now()
   where id = p_payment_id;

  return v_match_id;
end;
$$;

comment on function public.match_bank_transaction(uuid, uuid, text, numeric) is
  'Confirms that a statement line is explained by a recorded payment.';

-- Undoes a match, because people make mistakes and must be able to fix them.
create or replace function public.unmatch_bank_transaction(
  p_bank_transaction_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.reconciliation_matches%rowtype;
begin
  select * into v_match
    from public.reconciliation_matches
   where bank_transaction_id = p_bank_transaction_id
     and unmatched_at is null
     for update;

  if not found then
    return false;
  end if;

  update public.reconciliation_matches
     set unmatched_at = now(),
         unmatched_by = public.current_user_id(),
         is_confirmed = false,
         match_reason = coalesce(p_reason, match_reason),
         updated_at = now()
   where id = v_match.id;

  update public.bank_transactions
     set status = 'unmatched',
         matched_at = null,
         matched_by = null,
         match_confidence = null,
         updated_at = now()
   where id = p_bank_transaction_id;

  if v_match.payment_id is not null then
    update public.payments
       set reconciled_at = null,
           bank_transaction_id = null,
           updated_at = now()
     where id = v_match.payment_id;
  end if;

  return true;
end;
$$;

comment on function public.unmatch_bank_transaction(uuid, text) is
  'Releases a statement line and the record it was matched to.';

-- Applies the rules of a tenant to the lines that nobody has looked at yet.
create or replace function public.apply_reconciliation_rules(
  p_company_id uuid,
  p_limit integer default 200
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_line record;
  v_rule record;
  v_count integer := 0;
begin
  for v_line in
    select *
      from public.bank_transactions
     where company_id = p_company_id
       and status = 'unmatched'
       and not is_ignored
     order by transaction_date desc
     limit greatest(coalesce(p_limit, 200), 1)
  loop
    for v_rule in
      select *
        from public.reconciliation_rules
       where company_id = p_company_id
         and is_active
         and deleted_at is null
       order by priority, created_at
    loop
      if v_rule.bank_account_id is not null
         and v_rule.bank_account_id <> v_line.bank_account_id then
        continue;
      end if;

      if v_rule.direction = 'money_in' and v_line.amount < 0 then
        continue;
      end if;

      if v_rule.direction = 'money_out' and v_line.amount > 0 then
        continue;
      end if;

      if v_rule.description_contains is not null
         and position(lower(v_rule.description_contains) in lower(v_line.description)) = 0 then
        continue;
      end if;

      if v_rule.counterparty_contains is not null
         and position(lower(v_rule.counterparty_contains)
                      in lower(coalesce(v_line.counterparty_name, ''))) = 0 then
        continue;
      end if;

      if v_rule.amount_equals is not null
         and abs(v_line.amount) <> abs(v_rule.amount_equals) then
        continue;
      end if;

      if v_rule.amount_minimum is not null
         and abs(v_line.amount) < v_rule.amount_minimum then
        continue;
      end if;

      if v_rule.amount_maximum is not null
         and abs(v_line.amount) > v_rule.amount_maximum then
        continue;
      end if;

      update public.bank_transactions
         set status = 'suggested',
             category_hint = v_rule.name,
             match_confidence = case when v_rule.auto_confirm then 95 else 80 end,
             updated_at = now()
       where id = v_line.id;

      update public.reconciliation_rules
         set match_count = match_count + 1,
             last_matched_at = now(),
             updated_at = now()
       where id = v_rule.id;

      v_count := v_count + 1;
      exit;
    end loop;
  end loop;

  return v_count;
end;
$$;

comment on function public.apply_reconciliation_rules(uuid, integer) is
  'Runs the rules of a tenant over the statement lines nobody has classed yet.';

-- Reports how far a bank account is from being reconciled.
create or replace function public.reconciliation_summary(p_bank_account_id uuid)
returns table (
  unmatched_count integer,
  unmatched_total numeric,
  matched_count integer,
  matched_total numeric,
  oldest_unmatched date
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- A suggested line is still unexplained: a person has not confirmed it yet.
  select count(*) filter
         (where status in ('unmatched', 'suggested') and not is_ignored)::integer,
         round(coalesce(sum(amount) filter
                        (where status in ('unmatched', 'suggested')
                           and not is_ignored), 0), 4),
         count(*) filter (where status = 'matched')::integer,
         round(coalesce(sum(amount) filter (where status = 'matched'), 0), 4),
         min(transaction_date) filter
         (where status in ('unmatched', 'suggested') and not is_ignored)
    from public.bank_transactions
   where bank_account_id = p_bank_account_id;
$$;

comment on function public.reconciliation_summary(uuid) is
  'Counts what is still unexplained on a bank account, and since when.';

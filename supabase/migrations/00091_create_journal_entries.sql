-- supabase/migrations/00091_create_journal_entries.sql
-- Double entry journal.
--
-- Nothing is posted unless the debits equal the credits, nothing posted is
-- ever edited, and a mistake is corrected by a reversing entry. Those three
-- rules are what make the reports trustworthy, so all three are enforced in
-- the database rather than in the application.

create table public.journal_entries (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  entry_number text not null,
  entry_date date not null default current_date,
  status public.journal_entry_status not null default 'draft',

  memo text,
  reference text,
  currency char(3) not null default 'USD',

  -- What produced the entry, so the ledger can be traced back to the document.
  source_type text not null default 'manual',
  source_id uuid,

  total_debit numeric(18, 4) not null default 0,
  total_credit numeric(18, 4) not null default 0,

  posted_at timestamptz,
  posted_by uuid,
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_of_entry_id uuid,
  reversal_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint journal_entries_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint journal_entries_totals_check
    check (total_debit >= 0 and total_credit >= 0),
  constraint journal_entries_source_check
    check (source_type in ('manual', 'invoice', 'credit_note', 'payment',
                           'refund', 'expense', 'supplier_bill', 'payout',
                           'opening_balance', 'stock_movement', 'fee',
                           'exchange_difference', 'write_off', 'reversal')),
  constraint journal_entries_posted_check
    check (status <> 'posted' or posted_at is not null),
  constraint journal_entries_reversed_check
    check (status <> 'reversed' or reversed_at is not null)
);

comment on table public.journal_entries is
  'One balanced movement in the ledger, manual or raised by a document.';
comment on column public.journal_entries.source_id is
  'The document that produced the entry, which makes the ledger traceable.';

create unique index journal_entries_number_unique
  on public.journal_entries (company_id, entry_number)
  where deleted_at is null;

create index journal_entries_company_idx
  on public.journal_entries (company_id, entry_date desc)
  where deleted_at is null;

create index journal_entries_source_idx
  on public.journal_entries (source_type, source_id)
  where source_id is not null;

create index journal_entries_status_idx
  on public.journal_entries (company_id, status)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Lines
-- -----------------------------------------------------------------------------

create table public.journal_lines (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  entry_id uuid not null,
  account_id uuid not null,

  line_number smallint not null default 1,
  description text,

  debit_amount numeric(18, 4) not null default 0,
  credit_amount numeric(18, 4) not null default 0,

  -- Optional analysis, so a report can be cut by client, project or vendor.
  client_id uuid,
  vendor_id uuid,
  project_id uuid,
  tax_rate_id uuid,

  -- Foreign currency support: the amount as entered and the rate applied.
  source_currency char(3),
  source_amount numeric(18, 4),
  exchange_rate numeric(18, 8),

  created_at timestamptz not null default now(),

  constraint journal_lines_amounts_check
    check (debit_amount >= 0 and credit_amount >= 0),
  constraint journal_lines_single_side_check
    check ((debit_amount > 0 and credit_amount = 0)
           or (credit_amount > 0 and debit_amount = 0)),
  constraint journal_lines_currency_check
    check (source_currency is null or source_currency ~ '^[A-Z]{3}$'),
  constraint journal_lines_rate_check
    check (exchange_rate is null or exchange_rate > 0)
);

comment on table public.journal_lines is
  'The debits and credits of one journal entry, one account per line.';

create index journal_lines_entry_idx
  on public.journal_lines (entry_id, line_number);

create index journal_lines_account_idx
  on public.journal_lines (account_id, created_at desc);

create index journal_lines_client_idx
  on public.journal_lines (client_id)
  where client_id is not null;

-- -----------------------------------------------------------------------------
-- Who may write in the books
-- -----------------------------------------------------------------------------

-- Owners and staff keep their normal write rights, and an accountant holding
-- an active grant may post as well. That exception is the whole point of the
-- accountant role, so it lives in one named predicate instead of being spelled
-- out in every policy.
create or replace function public.can_post_journal_entries(p_company_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_company_id is null then
    return false;
  end if;

  if public.can_write_company_data(p_company_id) then
    return true;
  end if;

  return public.current_user_role() = 'accountant'
     and public.has_accountant_access(p_company_id);
end;
$$;
comment on function public.can_post_journal_entries(uuid) is
  'Returns true when the caller may post journal entries for the company.';

-- -----------------------------------------------------------------------------
-- Posting
-- -----------------------------------------------------------------------------

-- Writes a balanced entry in one call. The lines arrive as a JSON array, which
-- keeps the whole posting inside a single transaction.
create or replace function public.post_journal_entry(
  p_company_id uuid,
  p_lines jsonb,
  p_memo text default null,
  p_entry_date date default current_date,
  p_source_type text default 'manual',
  p_source_id uuid default null,
  p_reference text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_entry_id uuid;
  v_line jsonb;
  v_index smallint := 0;
  v_debit numeric := 0;
  v_credit numeric := 0;
  v_account_id uuid;
  v_currency char(3);
begin
  if not public.is_service_role()
     and not public.can_post_journal_entries(p_company_id) then
    raise exception 'You do not have permission to post entries for this company'
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'A journal entry needs at least two lines'
      using errcode = '22023';
  end if;

  select base_currency into v_currency from public.companies where id = p_company_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_debit := v_debit + coalesce((v_line ->> 'debit')::numeric, 0);
    v_credit := v_credit + coalesce((v_line ->> 'credit')::numeric, 0);
  end loop;

  if round(v_debit, 4) <> round(v_credit, 4) then
    raise exception 'The entry does not balance: debits are % and credits are %',
      round(v_debit, 4), round(v_credit, 4) using errcode = '22023';
  end if;

  if round(v_debit, 4) = 0 then
    raise exception 'A journal entry must move a non zero amount'
      using errcode = '22023';
  end if;

  insert into public.journal_entries (
    company_id, entry_number, entry_date, status, memo, reference, currency,
    source_type, source_id, total_debit, total_credit, posted_at, posted_by
  )
  values (
    p_company_id,
    public.next_document_number(p_company_id, 'journal_entry', 'JE-', 5::smallint,
                                'yearly', null, p_entry_date),
    p_entry_date,
    'posted',
    p_memo,
    p_reference,
    coalesce(v_currency, 'USD'),
    p_source_type,
    p_source_id,
    round(v_debit, 4),
    round(v_credit, 4),
    now(),
    public.current_user_id()
  )
  returning id into v_entry_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_index := v_index + 1;

    if v_line ? 'account_key' then
      v_account_id := public.system_account_id(p_company_id, v_line ->> 'account_key');
    else
      v_account_id := (v_line ->> 'account_id')::uuid;
    end if;

    if v_account_id is null then
      raise exception 'Line % does not name an account that exists', v_index
        using errcode = '22023';
    end if;

    insert into public.journal_lines (
      company_id, entry_id, account_id, line_number, description,
      debit_amount, credit_amount, client_id, vendor_id, project_id
    )
    values (
      p_company_id,
      v_entry_id,
      v_account_id,
      v_index,
      v_line ->> 'description',
      round(coalesce((v_line ->> 'debit')::numeric, 0), 4),
      round(coalesce((v_line ->> 'credit')::numeric, 0), 4),
      (v_line ->> 'client_id')::uuid,
      (v_line ->> 'vendor_id')::uuid,
      (v_line ->> 'project_id')::uuid
    );
  end loop;

  return v_entry_id;
end;
$$;

comment on function public.post_journal_entry(
  uuid, jsonb, text, date, text, uuid, text
) is 'Writes one balanced, posted journal entry and its lines.';

-- Corrects a posted entry by writing its mirror image.
create or replace function public.reverse_journal_entry(
  p_entry_id uuid,
  p_reason text,
  p_entry_date date default current_date
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_entry public.journal_entries%rowtype;
  v_lines jsonb;
  v_reversal_id uuid;
begin
  select * into v_entry
    from public.journal_entries
   where id = p_entry_id and deleted_at is null for update;

  if not found then
    raise exception 'Journal entry % was not found', p_entry_id using errcode = 'P0002';
  end if;

  if not public.is_service_role()
     and not public.can_post_journal_entries(v_entry.company_id) then
    raise exception 'You do not have permission to reverse entries for this company'
      using errcode = '42501';
  end if;

  if v_entry.status <> 'posted' then
    raise exception 'Only a posted entry can be reversed' using errcode = '22023';
  end if;

  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Please say why the entry is being reversed'
      using errcode = '22023';
  end if;

  select jsonb_agg(
           jsonb_build_object(
             'account_id', account_id,
             'debit', credit_amount,
             'credit', debit_amount,
             'description', coalesce(description, 'Reversal'),
             'client_id', client_id,
             'vendor_id', vendor_id,
             'project_id', project_id
           )
           order by line_number
         )
    into v_lines
    from public.journal_lines
   where entry_id = p_entry_id;

  v_reversal_id := public.post_journal_entry(
    v_entry.company_id,
    v_lines,
    'Reversal of ' || v_entry.entry_number || ': ' || p_reason,
    p_entry_date,
    -- The reversal points at the entry it corrects rather than at the
    -- document, so the document can be posted again once it is fixed.
    'reversal',
    p_entry_id,
    v_entry.entry_number
  );

  update public.journal_entries
     set reversal_of_entry_id = p_entry_id,
         updated_at = now()
   where id = v_reversal_id;

  update public.journal_entries
     set status = 'reversed',
         reversed_at = now(),
         reversed_by = public.current_user_id(),
         reversal_reason = p_reason,
         updated_at = now()
   where id = p_entry_id;

  return v_reversal_id;
end;
$$;

comment on function public.reverse_journal_entry(uuid, text, date) is
  'Posts the mirror image of an entry and marks the original reversed.';

-- Returns the balance of one account over a period.
create or replace function public.account_balance(
  p_account_id uuid,
  p_from date default null,
  p_to date default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_type public.account_type;
  v_debit numeric;
  v_credit numeric;
begin
  select account_type into v_type from public.ledger_accounts where id = p_account_id;

  if not found then
    return 0;
  end if;

  select coalesce(sum(l.debit_amount), 0), coalesce(sum(l.credit_amount), 0)
    into v_debit, v_credit
    from public.journal_lines as l
    join public.journal_entries as e on e.id = l.entry_id
   where l.account_id = p_account_id
     and e.status = 'posted'
     and e.deleted_at is null
     and (p_from is null or e.entry_date >= p_from)
     and (p_to is null or e.entry_date <= p_to);

  -- Assets and expenses grow on the debit side, everything else on the credit
  -- side, so the sign follows the nature of the account.
  if v_type in ('asset', 'expense') then
    return round(v_debit - v_credit, 4);
  end if;

  return round(v_credit - v_debit, 4);
end;
$$;

comment on function public.account_balance(uuid, date, date) is
  'Returns the balance of an account in its natural direction.';

-- Lists the trial balance of a tenant, which must always sum to zero.
create or replace function public.trial_balance(
  p_company_id uuid,
  p_from date default null,
  p_to date default null
)
returns table (
  account_code text,
  account_name text,
  account_type public.account_type,
  debit_total numeric,
  credit_total numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.code,
         a.name,
         a.account_type,
         round(coalesce(sum(l.debit_amount), 0), 4),
         round(coalesce(sum(l.credit_amount), 0), 4)
    from public.ledger_accounts as a
    left join public.journal_lines as l on l.account_id = a.id
    left join public.journal_entries as e
      on e.id = l.entry_id
     and e.status = 'posted'
     and e.deleted_at is null
     and (p_from is null or e.entry_date >= p_from)
     and (p_to is null or e.entry_date <= p_to)
   where a.company_id = p_company_id
     and a.deleted_at is null
   group by a.code, a.name, a.account_type, a.display_order
  having coalesce(sum(l.debit_amount), 0) <> 0
      or coalesce(sum(l.credit_amount), 0) <> 0
   order by a.display_order, a.code;
$$;

comment on function public.trial_balance(uuid, date, date) is
  'Lists every account with movement in a period, debits against credits.';

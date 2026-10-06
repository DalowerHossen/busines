-- supabase/migrations/00179_create_smart_reconciliation.sql
-- Matching that gets better the more it is corrected.
--
-- The existing matcher proposes payments for money coming in. This file adds
-- the other half: money going out matched to expenses and bills, lines split
-- across several records, and a memory of what a person decided last time
-- the same counterparty appeared.

create table public.bank_transaction_splits (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  bank_transaction_id uuid not null,

  amount numeric(18, 4) not null,
  ledger_account_id uuid,
  expense_category_id uuid,
  vendor_id uuid,
  client_id uuid,
  project_id uuid,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,

  constraint bank_transaction_splits_amount_check
    check (amount <> 0)
);

comment on table public.bank_transaction_splits is
  'One part of a statement line that belongs to a different account.';

create index bank_transaction_splits_transaction_idx
  on public.bank_transaction_splits (bank_transaction_id);

-- What a person decided the last time this counterparty turned up.
create table public.reconciliation_memory (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  counterparty_key text not null,
  direction text not null,

  ledger_account_id uuid,
  expense_category_id uuid,
  vendor_id uuid,

  times_seen integer not null default 1,
  times_confirmed integer not null default 1,
  last_seen_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reconciliation_memory_key_check
    check (length(btrim(counterparty_key)) between 2 and 120),
  constraint reconciliation_memory_direction_check
    check (direction in ('money_in', 'money_out')),
  constraint reconciliation_memory_counts_check
    check (times_seen > 0 and times_confirmed > 0
           and times_confirmed <= times_seen)
);

comment on table public.reconciliation_memory is
  'What a tenant has already decided about a counterparty, used to guess again.';

create unique index reconciliation_memory_unique
  on public.reconciliation_memory (company_id, counterparty_key, direction);

-- -----------------------------------------------------------------------------
-- Suggestions for money going out
-- -----------------------------------------------------------------------------

-- Proposes the expenses and bills that could explain a payment leaving the
-- account. Nothing is written; a person still decides.
create or replace function public.suggest_spending_matches(
  p_bank_transaction_id uuid,
  p_limit integer default 5
)
returns table (
  record_type text,
  record_id uuid,
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
  v_outflow numeric;
begin
  select * into v_line
    from public.bank_transactions
   where id = p_bank_transaction_id;

  if not found or v_line.amount >= 0 then
    return;
  end if;

  v_outflow := abs(v_line.amount);

  return query
  select 'expense'::text,
         e.id,
         e.total_amount,
         case
           when e.total_amount = v_outflow and e.expense_date = v_line.transaction_date
             then 100::numeric
           when e.total_amount = v_outflow
                and abs(e.expense_date - v_line.transaction_date) <= 3
             then 90::numeric
           when e.total_amount = v_outflow then 75::numeric
           else 60::numeric
         end,
         case
           when e.total_amount = v_outflow and e.expense_date = v_line.transaction_date
             then 'The amount and the date both agree'
           when e.total_amount = v_outflow
             then 'The amount agrees and the date is close'
           else 'The amount is close to this expense'
         end
    from public.expenses as e
   where e.company_id = v_line.company_id
     and e.deleted_at is null
     and e.status <> 'rejected'
     and not exists (
       select 1
         from public.reconciliation_matches as m
        where m.expense_id = e.id
          and m.unmatched_at is null
     )
     and abs(e.total_amount - v_outflow)
         <= greatest(round(v_outflow * 0.01, 4), 0.5)
     and abs(e.expense_date - v_line.transaction_date) <= 10

  union all

  select 'supplier_bill'::text,
         b.id,
         b.total_amount,
         case
           when b.total_amount = v_outflow then 85::numeric
           else 60::numeric
         end,
         case
           when b.total_amount = v_outflow
             then 'The amount matches an unpaid bill'
           else 'The amount is close to an unpaid bill'
         end
    from public.supplier_bills as b
   where b.company_id = v_line.company_id
     and b.deleted_at is null
     and not exists (
       select 1
         from public.reconciliation_matches as m
        where m.supplier_bill_id = b.id
          and m.unmatched_at is null
     )
     and abs(b.total_amount - v_outflow)
         <= greatest(round(v_outflow * 0.01, 4), 0.5)

  order by 4 desc, 3
  limit greatest(coalesce(p_limit, 5), 1);
end;
$$;

comment on function public.suggest_spending_matches(uuid, integer) is
  'Proposes the expenses and bills that could explain money leaving the account.';

-- -----------------------------------------------------------------------------
-- Learning
-- -----------------------------------------------------------------------------

-- Normalises a counterparty so the same shop is recognised next month even
-- when the reference number inside the description changes.
create or replace function public.counterparty_key(p_text text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select nullif(
    btrim(
      regexp_replace(
        regexp_replace(lower(coalesce(p_text, '')), '[0-9]+', ' ', 'g'),
        '\s+', ' ', 'g'
      )
    ),
    ''
  );
$$;

comment on function public.counterparty_key(text) is
  'Reduces a statement description to the part that identifies the counterparty.';

-- Remembers a decision so the next identical line can be guessed.
create or replace function public.remember_reconciliation_choice(
  p_company_id uuid,
  p_counterparty text,
  p_direction text,
  p_ledger_account_id uuid default null,
  p_expense_category_id uuid default null,
  p_vendor_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text;
  v_memory_id uuid;
begin
  if not coalesce(
    public.is_service_role() or public.can_write_company_data(p_company_id),
    false
  ) then
    raise exception 'That account is not yours to write to' using errcode = '42501';
  end if;

  v_key := public.counterparty_key(p_counterparty);

  if v_key is null then
    return null;
  end if;

  insert into public.reconciliation_memory (
    company_id, counterparty_key, direction, ledger_account_id,
    expense_category_id, vendor_id
  )
  values (
    p_company_id, v_key, p_direction, p_ledger_account_id,
    p_expense_category_id, p_vendor_id
  )
  on conflict (company_id, counterparty_key, direction)
  do update set
    ledger_account_id = coalesce(excluded.ledger_account_id,
                                 reconciliation_memory.ledger_account_id),
    expense_category_id = coalesce(excluded.expense_category_id,
                                   reconciliation_memory.expense_category_id),
    vendor_id = coalesce(excluded.vendor_id, reconciliation_memory.vendor_id),
    times_seen = reconciliation_memory.times_seen + 1,
    times_confirmed = reconciliation_memory.times_confirmed + 1,
    last_seen_at = now(),
    updated_at = now()
  returning id into v_memory_id;

  return v_memory_id;
end;
$$;

comment on function public.remember_reconciliation_choice(
  uuid, text, text, uuid, uuid, uuid
) is 'Stores how a counterparty was categorised so it can be guessed next time.';

-- What the memory suggests for a line nobody has touched yet.
create or replace function public.recall_reconciliation_choice(
  p_bank_transaction_id uuid
)
returns table (
  ledger_account_id uuid,
  expense_category_id uuid,
  vendor_id uuid,
  confidence numeric,
  times_confirmed integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_line public.bank_transactions%rowtype;
  v_key text;
  v_description_key text;
begin
  select * into v_line
    from public.bank_transactions
   where id = p_bank_transaction_id;

  if not found then
    return;
  end if;

  -- The counterparty is the better key, but the description is often all
  -- the bank sends, so both are tried.
  v_key := public.counterparty_key(v_line.counterparty_name);
  v_description_key := public.counterparty_key(v_line.description);

  if v_key is null and v_description_key is null then
    return;
  end if;

  return query
  select m.ledger_account_id,
         m.expense_category_id,
         m.vendor_id,
         least(50 + m.times_confirmed * 10, 95)::numeric,
         m.times_confirmed
    from public.reconciliation_memory as m
   where m.company_id = v_line.company_id
     and m.counterparty_key in (v_key, v_description_key)
     and m.direction = case when v_line.amount >= 0 then 'money_in' else 'money_out' end
   order by (m.counterparty_key = v_key) desc, m.times_confirmed desc
   limit 1;
end;
$$;

comment on function public.recall_reconciliation_choice(uuid) is
  'Returns what this tenant decided last time the same counterparty appeared.';

-- Splits a statement line across several accounts, to the penny.
create or replace function public.split_bank_transaction(
  p_bank_transaction_id uuid,
  p_splits jsonb
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_line public.bank_transactions%rowtype;
  v_total numeric := 0;
  v_count integer := 0;
  v_split jsonb;
begin
  select * into v_line
    from public.bank_transactions
   where id = p_bank_transaction_id
     for update;

  if not found then
    raise exception 'That statement line does not exist' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.can_write_company_data(v_line.company_id),
    false
  ) then
    raise exception 'That account is not yours to write to' using errcode = '42501';
  end if;

  if jsonb_typeof(p_splits) <> 'array' or jsonb_array_length(p_splits) < 2 then
    raise exception 'A split needs at least two parts' using errcode = '22023';
  end if;

  for v_split in select * from jsonb_array_elements(p_splits)
  loop
    v_total := v_total + (v_split ->> 'amount')::numeric;
  end loop;

  if round(v_total, 4) <> round(v_line.amount, 4) then
    raise exception 'The parts add up to % but the line is %', v_total, v_line.amount
      using errcode = '22023';
  end if;

  delete from public.bank_transaction_splits
   where bank_transaction_id = p_bank_transaction_id;

  for v_split in select * from jsonb_array_elements(p_splits)
  loop
    insert into public.bank_transaction_splits (
      company_id, bank_transaction_id, amount, ledger_account_id,
      expense_category_id, vendor_id, client_id, project_id, note, created_by
    )
    values (
      v_line.company_id,
      p_bank_transaction_id,
      (v_split ->> 'amount')::numeric,
      nullif(v_split ->> 'ledger_account_id', '')::uuid,
      nullif(v_split ->> 'expense_category_id', '')::uuid,
      nullif(v_split ->> 'vendor_id', '')::uuid,
      nullif(v_split ->> 'client_id', '')::uuid,
      nullif(v_split ->> 'project_id', '')::uuid,
      v_split ->> 'note',
      public.current_user_id()
    );

    v_count := v_count + 1;
  end loop;

  update public.bank_transactions
     set status = 'split',
         updated_at = now()
   where id = p_bank_transaction_id;

  return v_count;
end;
$$;

comment on function public.split_bank_transaction(uuid, jsonb) is
  'Divides one statement line into parts that must add up to the whole.';

-- Everything still waiting for a decision, oldest first.
create or replace function public.unreconciled_work(
  p_company_id uuid,
  p_limit integer default 50
)
returns table (
  bank_transaction_id uuid,
  transaction_date date,
  amount numeric,
  description text,
  suggestion_count integer,
  best_confidence numeric
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
    raise exception 'That account is not yours to read' using errcode = '42501';
  end if;

  return query
  select t.id,
         t.transaction_date,
         t.amount,
         t.description,
         coalesce(s.suggestion_count, 0)::integer,
         coalesce(s.best_confidence, 0)
    from public.bank_transactions as t
    left join lateral (
      select count(*)::integer as suggestion_count,
             max(confidence) as best_confidence
        from public.reconciliation_matches as m
       where m.bank_transaction_id = t.id
         and m.unmatched_at is null
         and not m.is_confirmed
    ) as s on true
   where t.company_id = p_company_id
     and t.status in ('unmatched', 'suggested')
     and not t.is_ignored
   order by t.transaction_date, t.created_at
   limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

comment on function public.unreconciled_work(uuid, integer) is
  'Lists the statement lines still waiting for somebody to decide.';

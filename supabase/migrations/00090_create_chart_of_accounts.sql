-- supabase/migrations/00090_create_chart_of_accounts.sql
-- The chart of accounts, and the templates new tenants start from.
--
-- Every tenant gets a working chart on its first day, because an empty
-- accounting module is useless and because the invoice, payment and expense
-- postings all need somewhere to land. The template is chosen by country, so
-- the wording matches what a local accountant expects to see.

-- The ledger issues its own numbers, so the entry series is added to the
-- document type list here, one migration before the first entry is posted.
alter type public.document_type add value if not exists 'journal_entry';

create table public.ledger_accounts (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  code text not null,
  name text not null,
  description text,

  account_type public.account_type not null,
  -- Narrower grouping used by the reports, for example current_asset or
  -- cost_of_sales.
  account_subtype text,
  parent_account_id uuid,

  currency char(3),
  is_active boolean not null default true,
  -- A system account is wired into the postings and cannot be removed.
  is_system boolean not null default false,
  system_key text,

  -- Cached from the journal lines so a report does not have to aggregate the
  -- whole ledger to show a balance.
  current_balance numeric(18, 4) not null default 0,
  opening_balance numeric(18, 4) not null default 0,
  opening_balance_date date,

  tax_rate_id uuid,
  display_order smallint not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint ledger_accounts_code_check
    check (code ~ '^[0-9A-Za-z][0-9A-Za-z._-]{0,19}$'),
  constraint ledger_accounts_name_check
    check (length(btrim(name)) between 2 and 80),
  constraint ledger_accounts_currency_check
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint ledger_accounts_system_key_check
    check (system_key is null or system_key ~ '^[a-z][a-z0-9_]{2,40}$'),
  constraint ledger_accounts_parent_check
    check (parent_account_id is null or parent_account_id <> id)
);

comment on table public.ledger_accounts is
  'The accounts a tenant posts to, grouped the way its reports read.';
comment on column public.ledger_accounts.system_key is
  'Stable handle used by the automatic postings, for example accounts_receivable.';

create unique index ledger_accounts_code_unique
  on public.ledger_accounts (company_id, code)
  where deleted_at is null;

create unique index ledger_accounts_system_key_unique
  on public.ledger_accounts (company_id, system_key)
  where system_key is not null and deleted_at is null;

create index ledger_accounts_company_idx
  on public.ledger_accounts (company_id, account_type, display_order)
  where deleted_at is null;

create index ledger_accounts_parent_idx
  on public.ledger_accounts (parent_account_id)
  where parent_account_id is not null;

-- -----------------------------------------------------------------------------
-- Templates
-- -----------------------------------------------------------------------------

-- The starting chart for a country. One row per account in the template.
create table public.chart_templates (
  id uuid primary key default public.generate_uuid_v7(),

  template_key text not null,
  country_code char(2),
  code text not null,
  name text not null,
  account_type public.account_type not null,
  account_subtype text,
  system_key text,
  display_order smallint not null default 0,

  created_at timestamptz not null default now(),

  constraint chart_templates_key_check
    check (template_key ~ '^[a-z][a-z0-9_]{2,40}$'),
  constraint chart_templates_country_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint chart_templates_code_check
    check (code ~ '^[0-9A-Za-z][0-9A-Za-z._-]{0,19}$')
);

comment on table public.chart_templates is
  'Ready made charts of accounts a new tenant can start from.';

create unique index chart_templates_unique
  on public.chart_templates (template_key, code);

create index chart_templates_country_idx
  on public.chart_templates (country_code, display_order);

insert into public.chart_templates (
  template_key, country_code, code, name, account_type, account_subtype,
  system_key, display_order
)
values
  ('general', null, '1000', 'Cash on hand', 'asset', 'current_asset', 'cash', 10),
  ('general', null, '1010', 'Business bank account', 'asset', 'current_asset',
   'bank', 20),
  ('general', null, '1050', 'Payment provider balance', 'asset', 'current_asset',
   'provider_balance', 30),
  ('general', null, '1100', 'Accounts receivable', 'asset', 'current_asset',
   'accounts_receivable', 40),
  ('general', null, '1200', 'Inventory', 'asset', 'current_asset', 'inventory', 50),
  ('general', null, '1300', 'Prepaid expenses', 'asset', 'current_asset', null, 60),
  ('general', null, '1500', 'Equipment', 'asset', 'fixed_asset', null, 70),
  ('general', null, '2000', 'Accounts payable', 'liability', 'current_liability',
   'accounts_payable', 80),
  ('general', null, '2100', 'Sales tax payable', 'liability', 'current_liability',
   'tax_payable', 90),
  ('general', null, '2200', 'Deferred revenue', 'liability', 'current_liability',
   'deferred_revenue', 100),
  ('general', null, '2500', 'Loans payable', 'liability', 'long_term_liability',
   null, 110),
  ('general', null, '3000', 'Owner capital', 'equity', 'equity', 'owner_equity', 120),
  ('general', null, '3100', 'Retained earnings', 'equity', 'equity',
   'retained_earnings', 130),
  ('general', null, '3200', 'Owner drawings', 'equity', 'equity', null, 140),
  ('general', null, '4000', 'Sales revenue', 'income', 'operating_income',
   'sales_revenue', 150),
  ('general', null, '4100', 'Service revenue', 'income', 'operating_income', null, 160),
  ('general', null, '4200', 'Discounts given', 'income', 'contra_income',
   'sales_discount', 170),
  ('general', null, '4300', 'Other income', 'income', 'other_income', null, 180),
  ('general', null, '5000', 'Cost of goods sold', 'expense', 'cost_of_sales',
   'cost_of_goods_sold', 190),
  ('general', null, '6000', 'Salaries and wages', 'expense', 'operating_expense',
   null, 200),
  ('general', null, '6100', 'Rent', 'expense', 'operating_expense', null, 210),
  ('general', null, '6200', 'Utilities', 'expense', 'operating_expense', null, 220),
  ('general', null, '6300', 'Software and subscriptions', 'expense',
   'operating_expense', 'software_expense', 230),
  ('general', null, '6400', 'Marketing and advertising', 'expense',
   'operating_expense', null, 240),
  ('general', null, '6500', 'Professional fees', 'expense', 'operating_expense',
   null, 250),
  ('general', null, '6600', 'Travel', 'expense', 'operating_expense', null, 260),
  ('general', null, '6700', 'Payment processing fees', 'expense',
   'operating_expense', 'processing_fees', 270),
  ('general', null, '6800', 'Bank charges', 'expense', 'operating_expense', null, 280),
  ('general', null, '6900', 'Bad debt written off', 'expense', 'operating_expense',
   'bad_debt', 290),
  ('general', null, '7000', 'Foreign exchange gain or loss', 'expense',
   'other_expense', 'exchange_difference', 300);

-- -----------------------------------------------------------------------------
-- Installation
-- -----------------------------------------------------------------------------

-- Copies a template into a tenant. Existing codes are left untouched, so the
-- routine is safe to run again after a chart has been edited.
create or replace function public.install_chart_of_accounts(
  p_company_id uuid,
  p_template_key text default 'general'
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_count integer := 0;
  v_currency char(3);
begin
  select base_currency into v_currency from public.companies where id = p_company_id;

  for v_row in
    select *
      from public.chart_templates
     where template_key = p_template_key
     order by display_order
  loop
    insert into public.ledger_accounts (
      company_id, code, name, account_type, account_subtype, system_key,
      currency, is_system, display_order
    )
    values (
      p_company_id, v_row.code, v_row.name, v_row.account_type,
      v_row.account_subtype, v_row.system_key, v_currency,
      v_row.system_key is not null, v_row.display_order
    )
    on conflict do nothing;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.install_chart_of_accounts(uuid, text) is
  'Copies a ready made chart of accounts into a tenant that has none.';

-- Returns the account a posting should use for a well known purpose.
create or replace function public.system_account_id(
  p_company_id uuid,
  p_system_key text
)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id
    from public.ledger_accounts
   where company_id = p_company_id
     and system_key = p_system_key
     and deleted_at is null
   limit 1;
$$;

comment on function public.system_account_id(uuid, text) is
  'Returns the account the automatic postings use for one purpose.';

-- Every new tenant starts with a working chart.
create or replace function public.install_default_chart()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.install_chart_of_accounts(new.id, 'general');
  return new;
end;
$$;

comment on function public.install_default_chart() is
  'Gives a new tenant the general chart of accounts on its first day.';

create trigger companies_70_chart_setup
  after insert on public.companies
  for each row execute function public.install_default_chart();

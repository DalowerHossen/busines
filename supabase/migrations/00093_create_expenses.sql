-- supabase/migrations/00093_create_expenses.sql
-- Expenses, receipts and the approval they go through.
--
-- An expense can be billable, which means it is recharged to a client on the
-- next invoice, and it can be reimbursable, which means the business owes the
-- person who paid for it. The two are independent, and both are tracked here
-- so nothing is paid twice or forgotten.

create table public.expense_categories (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  name text not null,
  description text,
  ledger_account_id uuid,
  tax_rate_id uuid,

  is_active boolean not null default true,
  display_order smallint not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint expense_categories_name_check
    check (length(btrim(name)) between 2 and 60)
);

comment on table public.expense_categories is
  'How a tenant groups its spending, and which account each group posts to.';

create unique index expense_categories_name_unique
  on public.expense_categories (company_id, lower(name))
  where deleted_at is null;

create index expense_categories_company_idx
  on public.expense_categories (company_id, display_order)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Expenses
-- -----------------------------------------------------------------------------

create table public.expenses (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  expense_number text not null,
  status public.expense_status not null default 'draft',

  vendor_id uuid,
  category_id uuid,
  ledger_account_id uuid,
  payment_account_id uuid,

  expense_date date not null default current_date,
  description text not null,
  reference text,

  currency char(3) not null default 'USD',
  subtotal_amount numeric(18, 4) not null default 0,
  tax_rate_id uuid,
  tax_amount numeric(18, 4) not null default 0,
  total_amount numeric(18, 4) not null default 0,

  -- Reporting in the base currency of the tenant.
  exchange_rate numeric(18, 8) not null default 1,
  base_currency_amount numeric(18, 4) not null default 0,

  payment_method public.payment_method_type,
  is_paid boolean not null default false,
  paid_at timestamptz,

  -- Recharged to a client on their next invoice.
  is_billable boolean not null default false,
  client_id uuid,
  project_id uuid,
  markup_percentage numeric(7, 4) not null default 0,
  invoiced_at timestamptz,
  invoice_id uuid,

  -- Paid personally by a team member, so the business owes them.
  is_reimbursable boolean not null default false,
  paid_by_user_id uuid,
  reimbursed_at timestamptz,

  receipt_storage_key text,
  receipt_file_name text,
  -- Filled by the receipt reader, kept so a human can correct it.
  ocr_extracted jsonb not null default '{}'::jsonb,
  ocr_confidence numeric(5, 2),

  submitted_at timestamptz,
  submitted_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  rejected_at timestamptz,
  rejection_reason text,

  journal_entry_id uuid,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint expenses_number_check
    check (expense_number ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{1,31}$'),
  constraint expenses_description_check
    check (length(btrim(description)) between 2 and 300),
  constraint expenses_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint expenses_amounts_check
    check (subtotal_amount >= 0 and tax_amount >= 0 and total_amount >= 0
           and base_currency_amount >= 0),
  constraint expenses_rate_check
    check (exchange_rate > 0),
  constraint expenses_markup_check
    check (markup_percentage between 0 and 1000),
  constraint expenses_billable_check
    check (not is_billable or client_id is not null),
  constraint expenses_reimbursable_check
    check (not is_reimbursable or paid_by_user_id is not null),
  constraint expenses_rejected_check
    check (status <> 'rejected' or rejection_reason is not null),
  constraint expenses_ocr_check
    check (jsonb_typeof(ocr_extracted) = 'object'),
  constraint expenses_confidence_check
    check (ocr_confidence is null or ocr_confidence between 0 and 100)
);

comment on table public.expenses is
  'What a tenant spent, who approved it, and whether it is recharged on.';
comment on column public.expenses.ocr_extracted is
  'What the receipt reader found, kept beside the values a person confirmed.';

create unique index expenses_number_unique
  on public.expenses (company_id, expense_number)
  where deleted_at is null;

create index expenses_company_idx
  on public.expenses (company_id, expense_date desc)
  where deleted_at is null;

create index expenses_vendor_idx
  on public.expenses (vendor_id, expense_date desc)
  where vendor_id is not null and deleted_at is null;

create index expenses_billable_idx
  on public.expenses (company_id, client_id)
  where is_billable and invoiced_at is null and deleted_at is null;

create index expenses_approval_idx
  on public.expenses (company_id, status)
  where status = 'submitted' and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Supplier bills
-- -----------------------------------------------------------------------------

-- A bill is what a supplier invoiced the tenant. It sits on the payable side
-- of the ledger and is settled separately from the expense that records it.
create table public.supplier_bills (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  vendor_id uuid not null,

  bill_number text not null,
  vendor_invoice_number text,
  status public.invoice_status not null default 'sent',

  bill_date date not null default current_date,
  due_date date not null default current_date,

  currency char(3) not null default 'USD',
  subtotal_amount numeric(18, 4) not null default 0,
  tax_amount numeric(18, 4) not null default 0,
  total_amount numeric(18, 4) not null default 0,
  paid_amount numeric(18, 4) not null default 0,
  balance_due numeric(18, 4)
    generated always as (total_amount - paid_amount) stored,

  purchase_order_id uuid,
  journal_entry_id uuid,
  line_items jsonb not null default '[]'::jsonb,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint supplier_bills_number_check
    check (bill_number ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{1,31}$'),
  constraint supplier_bills_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint supplier_bills_amounts_check
    check (subtotal_amount >= 0 and tax_amount >= 0 and total_amount >= 0
           and paid_amount >= 0 and paid_amount <= total_amount),
  constraint supplier_bills_dates_check
    check (due_date >= bill_date),
  constraint supplier_bills_lines_check
    check (jsonb_typeof(line_items) = 'array')
);

comment on table public.supplier_bills is
  'What a supplier charged the tenant, and how much of it is still owed.';

create unique index supplier_bills_number_unique
  on public.supplier_bills (company_id, bill_number)
  where deleted_at is null;

create index supplier_bills_vendor_idx
  on public.supplier_bills (vendor_id, bill_date desc)
  where deleted_at is null;

create index supplier_bills_unpaid_idx
  on public.supplier_bills (company_id, due_date)
  where deleted_at is null and status <> 'paid';

-- -----------------------------------------------------------------------------
-- Numbering and approval
-- -----------------------------------------------------------------------------

-- Allocates the expense number from the tenant sequence.
create or replace function public.assign_expense_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.expense_number is not null and length(btrim(new.expense_number)) > 0 then
    return new;
  end if;

  new.expense_number := public.next_document_number(
    new.company_id, 'supplier_bill', 'EXP-', 4::smallint, 'yearly', null,
    new.expense_date
  );

  return new;
end;
$$;

comment on function public.assign_expense_number() is
  'Gives a new expense the next number in the sequence of its tenant.';

-- Moves an expense through submission, approval and rejection.
create or replace function public.review_expense(
  p_expense_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns public.expense_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_expense public.expenses%rowtype;
  v_status public.expense_status;
begin
  select * into v_expense
    from public.expenses
   where id = p_expense_id and deleted_at is null for update;

  if not found then
    raise exception 'Expense % was not found', p_expense_id using errcode = 'P0002';
  end if;

  if v_expense.status not in ('submitted', 'draft') then
    raise exception 'This expense has already been dealt with'
      using errcode = '22023';
  end if;

  if not (public.is_super_admin() or public.is_company_owner(v_expense.company_id)) then
    raise exception 'Only the account owner can approve spending'
      using errcode = '42501';
  end if;

  if v_expense.submitted_by = public.current_user_id()
     and not public.is_company_owner(v_expense.company_id) then
    raise exception 'An expense cannot be approved by the person who claimed it'
      using errcode = '42501';
  end if;

  if not p_approve and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Please say why the expense is being rejected'
      using errcode = '22023';
  end if;

  v_status := case when p_approve then 'approved'::public.expense_status
                   else 'rejected'::public.expense_status
              end;

  update public.expenses
     set status = v_status,
         approved_at = case when p_approve then now() else null end,
         approved_by = case when p_approve then public.current_user_id() else null end,
         rejected_at = case when p_approve then null else now() end,
         rejection_reason = case when p_approve then null else p_reason end,
         updated_at = now()
   where id = p_expense_id;

  return v_status;
end;
$$;

comment on function public.review_expense(uuid, boolean, text) is
  'Approves or rejects a claimed expense, never by the person who claimed it.';

-- supabase/migrations/00044_create_credit_notes.sql
-- Credit notes.
--
-- A credit note is the only way to reduce an issued invoice. It is a document
-- in its own right with its own number, and the amount it carries is applied
-- to one or more invoices, reducing their outstanding balance.

create table public.credit_notes (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  client_id uuid not null,
  invoice_id uuid,

  credit_note_number text,
  status public.credit_note_status not null default 'draft',
  reason public.credit_note_reason not null default 'correction',
  reason_detail text,

  company_profile_snapshot_id uuid,
  bill_to jsonb not null default '{}'::jsonb,

  currency char(3) not null,
  currency_exponent smallint not null default 2,
  decimal_scale smallint not null default 2,
  rounding_mode public.rounding_mode not null default 'half_up',
  tax_mode public.tax_mode not null default 'exclusive',

  issue_date date not null default current_date,

  subtotal_amount numeric(18, 4) not null default 0,
  tax_amount numeric(18, 4) not null default 0,
  total_amount numeric(18, 4) not null default 0,
  applied_amount numeric(18, 4) not null default 0,
  refunded_amount numeric(18, 4) not null default 0,
  remaining_amount numeric(18, 4)
    generated always as (total_amount - applied_amount - refunded_amount) stored,

  notes text,
  issued_at timestamptz,
  sent_at timestamptz,
  is_locked boolean not null default false,
  pdf_storage_key text,
  pdf_generated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint credit_notes_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint credit_notes_amounts_check
    check (subtotal_amount >= 0 and tax_amount >= 0 and total_amount >= 0
           and applied_amount >= 0 and refunded_amount >= 0),
  constraint credit_notes_settlement_check
    check (applied_amount + refunded_amount <= total_amount + 0.0001),
  constraint credit_notes_issued_number_check
    check (status = 'draft' or credit_note_number is not null),
  constraint credit_notes_bill_to_check
    check (jsonb_typeof(bill_to) = 'object')
);

comment on table public.credit_notes is
  'Documents that reduce or cancel the amount owed on an issued invoice.';
comment on column public.credit_notes.remaining_amount is
  'Credit that is still available to apply to an invoice or to refund.';

create unique index credit_notes_number_unique
  on public.credit_notes (company_id, credit_note_number)
  where credit_note_number is not null and deleted_at is null;

create index credit_notes_company_idx
  on public.credit_notes (company_id, status, issue_date desc)
  where deleted_at is null;

create index credit_notes_client_idx
  on public.credit_notes (client_id, issue_date desc)
  where deleted_at is null;

create index credit_notes_invoice_idx
  on public.credit_notes (invoice_id)
  where invoice_id is not null and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Credit note lines
-- -----------------------------------------------------------------------------

create table public.credit_note_items (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  credit_note_id uuid not null,
  invoice_item_id uuid,

  line_number smallint not null,
  description text not null,
  quantity numeric(14, 3) not null default 1,
  unit_price numeric(18, 4) not null default 0,

  tax_rate_id uuid,
  tax_name_snapshot text,
  tax_percentage numeric(9, 4) not null default 0,
  is_taxable boolean not null default true,
  tax_amount numeric(18, 4) not null default 0,

  line_subtotal numeric(18, 4) not null default 0,
  line_total numeric(18, 4) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint credit_note_items_line_number_check
    check (line_number between 1 and 999),
  constraint credit_note_items_description_check
    check (length(btrim(description)) between 1 and 500),
  constraint credit_note_items_quantity_check
    check (quantity >= 0),
  constraint credit_note_items_amounts_check
    check (unit_price >= 0 and tax_amount >= 0)
);

comment on table public.credit_note_items is
  'Lines of a credit note, optionally tied to the invoice line they correct.';

create unique index credit_note_items_line_number_unique
  on public.credit_note_items (credit_note_id, line_number)
  where deleted_at is null;

create index credit_note_items_note_idx
  on public.credit_note_items (credit_note_id, line_number)
  where deleted_at is null;

create index credit_note_items_company_idx
  on public.credit_note_items (company_id)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Applications of a credit note to an invoice
-- -----------------------------------------------------------------------------

create table public.credit_note_applications (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  credit_note_id uuid not null,
  invoice_id uuid not null,

  amount numeric(18, 4) not null,
  applied_at timestamptz not null default now(),
  reversed_at timestamptz,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,

  constraint credit_note_applications_amount_check
    check (amount > 0)
);

comment on table public.credit_note_applications is
  'Each amount moved from a credit note onto a specific invoice.';

create index credit_note_applications_note_idx
  on public.credit_note_applications (credit_note_id)
  where reversed_at is null;

create index credit_note_applications_invoice_idx
  on public.credit_note_applications (invoice_id)
  where reversed_at is null;

create index credit_note_applications_company_idx
  on public.credit_note_applications (company_id);

-- Recomputes the totals of a credit note from its lines.
create or replace function public.recalculate_credit_note_totals(p_credit_note_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_note public.credit_notes%rowtype;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
begin
  select * into v_note from public.credit_notes where id = p_credit_note_id;

  if not found then
    raise exception 'Credit note % was not found', p_credit_note_id using errcode = 'P0002';
  end if;

  select coalesce(sum(line_subtotal), 0), coalesce(sum(tax_amount), 0)
    into v_subtotal, v_tax
    from public.credit_note_items
   where credit_note_id = p_credit_note_id
     and deleted_at is null;

  update public.credit_notes
     set subtotal_amount = public.round_money(v_subtotal, v_note.decimal_scale, v_note.rounding_mode),
         tax_amount = public.round_money(v_tax, v_note.decimal_scale, v_note.rounding_mode),
         total_amount = public.round_money(
           case when v_note.tax_mode = 'inclusive' then v_subtotal + v_tax
                else v_subtotal + v_tax end,
           v_note.decimal_scale, v_note.rounding_mode
         ),
         updated_at = now()
   where id = p_credit_note_id;
end;
$$;

comment on function public.recalculate_credit_note_totals(uuid) is
  'Rebuilds the totals of a credit note from its lines.';

create or replace function public.calculate_credit_note_item_amounts()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_tax_mode public.tax_mode;
  v_scale smallint;
  v_mode public.rounding_mode;
  v_net numeric;
begin
  select tax_mode, decimal_scale, rounding_mode
    into v_tax_mode, v_scale, v_mode
    from public.credit_notes
   where id = new.credit_note_id;

  if v_tax_mode is null then
    raise exception 'Credit note % was not found', new.credit_note_id using errcode = 'P0002';
  end if;

  v_net := new.quantity * new.unit_price;

  if not new.is_taxable or v_tax_mode = 'none' or new.tax_percentage = 0 then
    new.tax_amount := 0;
    new.line_subtotal := public.round_money(v_net, v_scale, v_mode);
    new.line_total := new.line_subtotal;
  elsif v_tax_mode = 'inclusive' then
    new.tax_amount := public.round_money(
      public.calculate_tax_amount(v_net, new.tax_percentage, 'inclusive'), v_scale, v_mode
    );
    new.line_subtotal := public.round_money(v_net - new.tax_amount, v_scale, v_mode);
    new.line_total := public.round_money(v_net, v_scale, v_mode);
  else
    new.tax_amount := public.round_money(
      public.calculate_tax_amount(v_net, new.tax_percentage, 'exclusive'), v_scale, v_mode
    );
    new.line_subtotal := public.round_money(v_net, v_scale, v_mode);
    new.line_total := public.round_money(v_net + new.tax_amount, v_scale, v_mode);
  end if;

  return new;
end;
$$;

comment on function public.calculate_credit_note_item_amounts() is
  'Derives the tax and totals of a single credit note line.';

create trigger credit_note_items_calculate_amounts
  before insert or update of quantity, unit_price, tax_percentage, is_taxable
  on public.credit_note_items
  for each row execute function public.calculate_credit_note_item_amounts();

create or replace function public.refresh_credit_note_totals_from_item()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_credit_note_totals(old.credit_note_id);
    return old;
  end if;

  perform public.recalculate_credit_note_totals(new.credit_note_id);
  return new;
end;
$$;

comment on function public.refresh_credit_note_totals_from_item() is
  'Trigger function that recalculates a credit note after a line changes.';

create trigger credit_note_items_refresh_totals
  after insert or update or delete on public.credit_note_items
  for each row execute function public.refresh_credit_note_totals_from_item();

-- Applies credit to an invoice and moves both documents to their new state.
create or replace function public.apply_credit_note_to_invoice(
  p_credit_note_id uuid,
  p_invoice_id uuid,
  p_amount numeric default null
)
returns numeric
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_note public.credit_notes%rowtype;
  v_invoice public.invoices%rowtype;
  v_amount numeric;
begin
  select * into v_note from public.credit_notes where id = p_credit_note_id and deleted_at is null;

  if not found then
    raise exception 'Credit note % was not found', p_credit_note_id using errcode = 'P0002';
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id and deleted_at is null;

  if not found then
    raise exception 'Invoice % was not found', p_invoice_id using errcode = 'P0002';
  end if;

  if v_note.company_id <> v_invoice.company_id then
    raise exception 'A credit note can only be applied inside its own company'
      using errcode = '42501';
  end if;

  if not public.can_write_company_data(v_note.company_id) then
    raise exception 'You are not allowed to apply credit in this company'
      using errcode = '42501';
  end if;

  if v_note.status = 'draft' then
    raise exception 'A draft credit note cannot be applied' using errcode = '42501';
  end if;

  if v_note.currency <> v_invoice.currency then
    raise exception 'The credit note and the invoice must use the same currency'
      using errcode = '22023';
  end if;

  v_amount := least(
    coalesce(p_amount, v_note.remaining_amount),
    v_note.remaining_amount,
    v_invoice.balance_due
  );

  if v_amount <= 0 then
    raise exception 'There is no outstanding amount left to credit'
      using errcode = '22023';
  end if;

  insert into public.credit_note_applications (company_id, credit_note_id, invoice_id, amount)
  values (v_note.company_id, p_credit_note_id, p_invoice_id, v_amount);

  update public.invoices
     set credited_amount = credited_amount + v_amount,
         updated_at = now()
   where id = p_invoice_id;

  update public.credit_notes
     set applied_amount = applied_amount + v_amount,
         status = case
                    when applied_amount + v_amount + refunded_amount
                         >= total_amount - 0.0001 then 'applied'::public.credit_note_status
                    else 'partially_applied'::public.credit_note_status
                  end,
         updated_at = now()
   where id = p_credit_note_id;

  perform public.refresh_invoice_settlement(p_invoice_id);

  return v_amount;
end;
$$;

comment on function public.apply_credit_note_to_invoice(uuid, uuid, numeric) is
  'Moves available credit onto an invoice and updates both documents.';

-- supabase/migrations/00043_create_estimates.sql
-- Estimates, quotes and proposals.
--
-- An estimate carries the same arithmetic as an invoice but no statutory
-- weight: it expires, it can be approved or declined by the client through a
-- signed link, and approval converts it into a draft invoice.

create table public.estimates (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  client_id uuid not null,
  client_contact_id uuid,

  estimate_number text,
  status public.estimate_status not null default 'draft',
  title text,

  company_profile_snapshot_id uuid,
  bill_to jsonb not null default '{}'::jsonb,
  client_name_snapshot text,

  currency char(3) not null,
  currency_exponent smallint not null default 2,
  base_currency char(3) not null,
  exchange_rate numeric(18, 8) not null default 1,
  decimal_scale smallint not null default 2,
  rounding_mode public.rounding_mode not null default 'half_up',
  tax_mode public.tax_mode not null default 'exclusive',
  discount_stage public.discount_stage not null default 'before_tax',

  issue_date date not null default current_date,
  valid_until date,

  discount_type public.discount_type,
  discount_value numeric(18, 4) not null default 0,
  shipping_amount numeric(18, 4) not null default 0,

  subtotal_amount numeric(18, 4) not null default 0,
  discount_amount numeric(18, 4) not null default 0,
  tax_amount numeric(18, 4) not null default 0,
  total_amount numeric(18, 4) not null default 0,

  notes text,
  terms_and_conditions text,
  footer_note text,
  template_key text not null default 'classic',

  sent_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0,
  approved_at timestamptz,
  approved_by_name text,
  approval_signature_storage_key text,
  approval_ip_address inet,
  declined_at timestamptz,
  decline_reason text,
  converted_at timestamptz,
  converted_invoice_id uuid,

  is_locked boolean not null default false,
  pdf_storage_key text,
  pdf_generated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint estimates_currency_check
    check (currency ~ '^[A-Z]{3}$' and base_currency ~ '^[A-Z]{3}$'),
  constraint estimates_exchange_rate_check
    check (exchange_rate > 0),
  constraint estimates_validity_check
    check (valid_until is null or valid_until >= issue_date),
  constraint estimates_amounts_check
    check (subtotal_amount >= 0 and tax_amount >= 0 and total_amount >= 0
           and discount_amount >= 0 and shipping_amount >= 0),
  constraint estimates_issued_number_check
    check (status = 'draft' or estimate_number is not null),
  constraint estimates_approval_check
    check (status <> 'approved' or approved_at is not null),
  constraint estimates_conversion_check
    check (status <> 'converted' or converted_invoice_id is not null),
  constraint estimates_bill_to_check
    check (jsonb_typeof(bill_to) = 'object')
);

comment on table public.estimates is
  'Quotes sent to clients, which become invoices once they are approved.';

create unique index estimates_number_unique
  on public.estimates (company_id, estimate_number)
  where estimate_number is not null and deleted_at is null;

create unique index estimates_company_scope_key
  on public.estimates (id, company_id);

create index estimates_company_status_idx
  on public.estimates (company_id, status, issue_date desc)
  where deleted_at is null;

create index estimates_client_idx
  on public.estimates (client_id, issue_date desc)
  where deleted_at is null;

create index estimates_expiry_idx
  on public.estimates (valid_until)
  where deleted_at is null and status in ('sent', 'viewed');

-- -----------------------------------------------------------------------------
-- Estimate lines
-- -----------------------------------------------------------------------------

create table public.estimate_items (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  estimate_id uuid not null,

  line_number smallint not null,
  line_type public.document_line_type not null default 'service',
  product_id uuid,

  description text not null,
  long_description text,
  quantity numeric(14, 3) not null default 1,
  unit_label text,
  unit_price numeric(18, 4) not null default 0,

  discount_type public.discount_type,
  discount_value numeric(18, 4) not null default 0,
  discount_amount numeric(18, 4) not null default 0,

  tax_rate_id uuid,
  tax_name_snapshot text,
  tax_percentage numeric(9, 4) not null default 0,
  is_taxable boolean not null default true,
  tax_amount numeric(18, 4) not null default 0,

  line_subtotal numeric(18, 4) not null default 0,
  line_total numeric(18, 4) not null default 0,

  -- Optional lines let the client choose what to include before approving.
  is_optional boolean not null default false,
  is_selected boolean not null default true,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint estimate_items_line_number_check
    check (line_number between 1 and 999),
  constraint estimate_items_description_check
    check (length(btrim(description)) between 1 and 500),
  constraint estimate_items_quantity_check
    check (quantity >= 0),
  constraint estimate_items_tax_percentage_check
    check (tax_percentage >= 0 and tax_percentage <= 100),
  constraint estimate_items_metadata_check
    check (jsonb_typeof(metadata) = 'object')
);

comment on table public.estimate_items is
  'Lines of an estimate, including the optional ones a client may select.';

create unique index estimate_items_line_number_unique
  on public.estimate_items (estimate_id, line_number)
  where deleted_at is null;

create index estimate_items_estimate_idx
  on public.estimate_items (estimate_id, line_number)
  where deleted_at is null;

create index estimate_items_company_idx
  on public.estimate_items (company_id)
  where deleted_at is null;

-- Recomputes the totals of an estimate from its selected lines.
create or replace function public.recalculate_estimate_totals(p_estimate_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_estimate public.estimates%rowtype;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_discount numeric := 0;
  v_total numeric;
begin
  select * into v_estimate from public.estimates where id = p_estimate_id;

  if not found then
    raise exception 'Estimate % was not found', p_estimate_id using errcode = 'P0002';
  end if;

  select coalesce(sum(line_subtotal), 0), coalesce(sum(tax_amount), 0)
    into v_subtotal, v_tax
    from public.estimate_items
   where estimate_id = p_estimate_id
     and deleted_at is null
     and (not is_optional or is_selected);

  if v_estimate.discount_type is not null and v_estimate.discount_value > 0 then
    v_discount := public.calculate_discount_amount(
      v_subtotal, v_estimate.discount_value, v_estimate.discount_type
    );
  end if;

  v_total := v_subtotal - v_discount + v_estimate.shipping_amount;

  if v_estimate.tax_mode <> 'inclusive' then
    v_total := v_total + v_tax;
  end if;

  update public.estimates
     set subtotal_amount = public.round_money(
           v_subtotal, v_estimate.decimal_scale, v_estimate.rounding_mode
         ),
         discount_amount = public.round_money(
           v_discount, v_estimate.decimal_scale, v_estimate.rounding_mode
         ),
         tax_amount = public.round_money(
           v_tax, v_estimate.decimal_scale, v_estimate.rounding_mode
         ),
         total_amount = public.round_money(
           v_total, v_estimate.decimal_scale, v_estimate.rounding_mode
         ),
         updated_at = now()
   where id = p_estimate_id;
end;
$$;

comment on function public.recalculate_estimate_totals(uuid) is
  'Rebuilds the totals of an estimate from the lines the client will receive.';

create or replace function public.calculate_estimate_item_amounts()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_tax_mode public.tax_mode;
  v_scale smallint;
  v_mode public.rounding_mode;
  v_gross numeric;
  v_net numeric;
begin
  select tax_mode, decimal_scale, rounding_mode
    into v_tax_mode, v_scale, v_mode
    from public.estimates
   where id = new.estimate_id;

  if v_tax_mode is null then
    raise exception 'Estimate % was not found', new.estimate_id using errcode = 'P0002';
  end if;

  v_gross := new.quantity * new.unit_price;

  if new.discount_type is null or new.discount_value = 0 then
    new.discount_amount := 0;
  else
    new.discount_amount := public.calculate_discount_amount(
      v_gross, new.discount_value, new.discount_type
    );
  end if;

  v_net := v_gross - new.discount_amount;

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

comment on function public.calculate_estimate_item_amounts() is
  'Derives the discount, tax and totals of a single estimate line.';

create trigger estimate_items_calculate_amounts
  before insert or update of quantity, unit_price, discount_type, discount_value,
    tax_percentage, is_taxable on public.estimate_items
  for each row execute function public.calculate_estimate_item_amounts();

create or replace function public.refresh_estimate_totals_from_item()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_estimate_totals(old.estimate_id);
    return old;
  end if;

  perform public.recalculate_estimate_totals(new.estimate_id);
  return new;
end;
$$;

comment on function public.refresh_estimate_totals_from_item() is
  'Trigger function that recalculates an estimate after one of its lines changes.';

create trigger estimate_items_refresh_totals
  after insert or update or delete on public.estimate_items
  for each row execute function public.refresh_estimate_totals_from_item();

-- Turns an approved estimate into a draft invoice, copying the selected lines.
create or replace function public.convert_estimate_to_invoice(p_estimate_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_estimate public.estimates%rowtype;
  v_invoice_id uuid;
  v_number text;
  v_prefix text;
  v_padding smallint;
  v_reset_policy text;
begin
  select * into v_estimate
    from public.estimates
   where id = p_estimate_id and deleted_at is null;

  if not found then
    raise exception 'Estimate % was not found', p_estimate_id using errcode = 'P0002';
  end if;

  if not public.can_write_company_data(v_estimate.company_id) then
    raise exception 'You are not allowed to convert estimates for this company'
      using errcode = '42501';
  end if;

  if v_estimate.converted_invoice_id is not null then
    return v_estimate.converted_invoice_id;
  end if;

  insert into public.invoices (
    company_id, client_id, client_contact_id, currency, currency_exponent,
    base_currency, exchange_rate, decimal_scale, rounding_mode, tax_mode,
    discount_stage, issue_date, due_date, discount_type, discount_value,
    shipping_amount, notes, terms_and_conditions, footer_note, template_key,
    source_estimate_id
  )
  values (
    v_estimate.company_id, v_estimate.client_id, v_estimate.client_contact_id,
    v_estimate.currency, v_estimate.currency_exponent, v_estimate.base_currency,
    v_estimate.exchange_rate, v_estimate.decimal_scale, v_estimate.rounding_mode,
    v_estimate.tax_mode, v_estimate.discount_stage, current_date, current_date,
    v_estimate.discount_type, v_estimate.discount_value, v_estimate.shipping_amount,
    v_estimate.notes, v_estimate.terms_and_conditions, v_estimate.footer_note,
    v_estimate.template_key, p_estimate_id
  )
  returning id into v_invoice_id;

  insert into public.invoice_items (
    company_id, invoice_id, line_number, line_type, product_id, description,
    long_description, quantity, unit_label, unit_price, discount_type,
    discount_value, tax_rate_id, tax_name_snapshot, tax_percentage, is_taxable,
    metadata
  )
  select company_id, v_invoice_id, line_number, line_type, product_id, description,
         long_description, quantity, unit_label, unit_price, discount_type,
         discount_value, tax_rate_id, tax_name_snapshot, tax_percentage, is_taxable,
         metadata
    from public.estimate_items
   where estimate_id = p_estimate_id
     and deleted_at is null
     and (not is_optional or is_selected)
   order by line_number;

  -- An estimate that is converted becomes part of the document history, so it
  -- receives its own number if it never went out formally.
  if v_estimate.estimate_number is null then
    select coalesce(estimate_prefix, 'EST-'), coalesce(number_padding, 4),
           coalesce(numbering_reset_policy, 'never')
      into v_prefix, v_padding, v_reset_policy
      from public.company_profiles
     where company_id = v_estimate.company_id
       and deleted_at is null;

    v_number := public.next_document_number(
      v_estimate.company_id, 'estimate', coalesce(v_prefix, 'EST-'),
      coalesce(v_padding, 4)::smallint, coalesce(v_reset_policy, 'never')
    );
  end if;

  update public.estimates
     set status = 'converted',
         estimate_number = coalesce(estimate_number, v_number),
         converted_at = now(),
         converted_invoice_id = v_invoice_id,
         updated_at = now()
   where id = p_estimate_id;

  perform public.recalculate_invoice_totals(v_invoice_id);

  return v_invoice_id;
end;
$$;

comment on function public.convert_estimate_to_invoice(uuid) is
  'Creates a draft invoice from the selected lines of an approved estimate.';

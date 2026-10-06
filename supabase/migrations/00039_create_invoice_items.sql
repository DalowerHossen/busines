-- supabase/migrations/00039_create_invoice_items.sql
-- Invoice lines.
--
-- A line copies everything it needs from the catalogue at the moment it is
-- added: description, unit price, unit label and the tax percentage. Renaming
-- or repricing a product afterwards leaves existing documents untouched.

create table public.invoice_items (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  invoice_id uuid not null,

  line_number smallint not null,
  line_type public.document_line_type not null default 'service',

  product_id uuid,
  sku_snapshot text,
  description text not null,
  long_description text,

  quantity numeric(14, 3) not null default 1,
  unit_label text,
  unit_price numeric(18, 4) not null default 0,

  -- Line level discount.
  discount_type public.discount_type,
  discount_value numeric(18, 4) not null default 0,
  discount_amount numeric(18, 4) not null default 0,

  -- Tax treatment copied from the catalogue or chosen on the line.
  tax_rate_id uuid,
  tax_group_id uuid,
  tax_name_snapshot text,
  tax_percentage numeric(9, 4) not null default 0,
  is_tax_compound boolean not null default false,
  is_taxable boolean not null default true,
  tax_amount numeric(18, 4) not null default 0,

  -- Computed amounts for this line.
  line_subtotal numeric(18, 4) not null default 0,
  line_total numeric(18, 4) not null default 0,

  -- Cost at the time of sale, used by the margin report.
  cost_price_snapshot numeric(18, 4),

  -- Links to the records that produced this line.
  time_entry_id uuid,
  expense_id uuid,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint invoice_items_line_number_check
    check (line_number between 1 and 999),
  constraint invoice_items_description_check
    check (length(btrim(description)) between 1 and 500),
  constraint invoice_items_quantity_check
    check (quantity >= 0),
  constraint invoice_items_unit_price_check
    check (line_type = 'discount' or unit_price >= 0),
  constraint invoice_items_discount_check
    check (discount_value >= 0 and discount_amount >= 0),
  constraint invoice_items_tax_selection_check
    check (tax_rate_id is null or tax_group_id is null),
  constraint invoice_items_tax_percentage_check
    check (tax_percentage >= 0 and tax_percentage <= 100),
  constraint invoice_items_metadata_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint invoice_items_text_line_check
    check (line_type <> 'text' or (quantity = 0 and unit_price = 0))
);

comment on table public.invoice_items is
  'Lines of an invoice, each holding a frozen copy of the catalogue values.';
comment on column public.invoice_items.tax_percentage is
  'Percentage copied onto the line so historic documents stay reproducible.';

create unique index invoice_items_line_number_unique
  on public.invoice_items (invoice_id, line_number)
  where deleted_at is null;

create index invoice_items_invoice_idx
  on public.invoice_items (invoice_id, line_number)
  where deleted_at is null;

create index invoice_items_product_idx
  on public.invoice_items (product_id)
  where product_id is not null and deleted_at is null;

create index invoice_items_company_idx
  on public.invoice_items (company_id)
  where deleted_at is null;

-- Copies the catalogue values onto a new line when the caller supplied a
-- product but left the descriptive columns empty.
create or replace function public.fill_invoice_item_from_product()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product record;
  v_rate record;
begin
  if new.product_id is null then
    return new;
  end if;

  select p.name,
         p.description,
         p.sku,
         p.unit_price,
         p.cost_price,
         p.tax_rate_id,
         p.tax_group_id,
         u.abbreviation as unit_abbreviation
    into v_product
    from public.products as p
    left join public.units_of_measure as u on u.id = p.unit_of_measure_id
   where p.id = new.product_id
     and p.company_id = new.company_id
     and p.deleted_at is null;

  if not found then
    raise exception 'Product % does not belong to this company', new.product_id
      using errcode = '23503';
  end if;

  if new.description is null or length(btrim(new.description)) = 0 then
    new.description := v_product.name;
  end if;

  if new.long_description is null then
    new.long_description := v_product.description;
  end if;

  new.sku_snapshot := coalesce(new.sku_snapshot, v_product.sku);
  new.unit_label := coalesce(new.unit_label, v_product.unit_abbreviation);
  new.cost_price_snapshot := coalesce(new.cost_price_snapshot, v_product.cost_price);

  if new.unit_price = 0 and tg_op = 'INSERT' then
    new.unit_price := v_product.unit_price;
  end if;

  if new.tax_rate_id is null and new.tax_group_id is null then
    new.tax_rate_id := v_product.tax_rate_id;
    new.tax_group_id := v_product.tax_group_id;
  end if;

  if new.tax_rate_id is not null then
    select name, rate_percentage, is_compound
      into v_rate
      from public.tax_rates
     where id = new.tax_rate_id
       and company_id = new.company_id
       and deleted_at is null;

    if found then
      new.tax_name_snapshot := coalesce(new.tax_name_snapshot, v_rate.name);
      new.tax_percentage := v_rate.rate_percentage;
      new.is_tax_compound := v_rate.is_compound;
    end if;
  elsif new.tax_group_id is not null then
    new.tax_percentage := public.effective_tax_group_rate(new.tax_group_id);

    select name into new.tax_name_snapshot
      from public.tax_groups
     where id = new.tax_group_id
       and company_id = new.company_id;
  end if;

  return new;
end;
$$;

comment on function public.fill_invoice_item_from_product() is
  'Copies catalogue description, price and tax onto a line when a product is used.';

create trigger invoice_items_20_fill_from_product
  before insert or update of product_id on public.invoice_items
  for each row execute function public.fill_invoice_item_from_product();

-- Assigns the next line number when the caller did not choose one.
-- The numeric prefixes in the trigger names fix the order in which the line
-- triggers run: guard, numbering, catalogue defaults, then the arithmetic.
create or replace function public.assign_invoice_item_line_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.line_number is not null and new.line_number > 0 then
    return new;
  end if;

  select coalesce(max(line_number), 0) + 1
    into new.line_number
    from public.invoice_items
   where invoice_id = new.invoice_id
     and deleted_at is null;

  return new;
end;
$$;

comment on function public.assign_invoice_item_line_number() is
  'Places a new line at the end of the document when no position was supplied.';

create trigger invoice_items_10_assign_line_number
  before insert on public.invoice_items
  for each row execute function public.assign_invoice_item_line_number();

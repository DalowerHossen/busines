-- supabase/migrations/00030_create_products.sql
-- The catalogue of items and services that appear on documents.
--
-- Prices are stored with four decimal places so that unit rates such as
-- 0.0825 per unit stay exact; document totals are rounded to the currency
-- scale by the money helpers, never by the catalogue.

create table public.products (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  category_id uuid,
  unit_of_measure_id uuid,

  sku text,
  barcode text,
  name text not null,
  description text,
  product_type public.product_type not null default 'service',
  status public.product_status not null default 'active',

  -- Selling side.
  unit_price numeric(18, 4) not null default 0,
  currency char(3),
  tax_rate_id uuid,
  tax_group_id uuid,
  is_tax_inclusive_price boolean not null default false,
  allow_price_override boolean not null default true,
  minimum_price numeric(18, 4),

  -- Buying side, used by purchase orders and by margin reporting.
  cost_price numeric(18, 4),
  preferred_supplier_name text,

  -- Services and time billing.
  is_billable_by_time boolean not null default false,
  default_hours numeric(10, 2),

  -- Stock control. Quantities are maintained by the inventory module; the
  -- catalogue only states whether an item participates in stock control.
  track_inventory boolean not null default false,
  low_stock_threshold numeric(14, 3),
  opening_stock_quantity numeric(14, 3) not null default 0,

  -- International trade and accounting hooks.
  hs_code text,
  income_account_code text,
  expense_account_code text,

  image_url text,
  image_storage_key text,
  internal_notes text,
  is_featured boolean not null default false,
  sort_order smallint not null default 0,
  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint products_name_check
    check (length(btrim(name)) between 1 and 200),
  constraint products_sku_check
    check (sku is null or length(btrim(sku)) between 1 and 60),
  constraint products_unit_price_check
    check (unit_price >= 0),
  constraint products_minimum_price_check
    check (minimum_price is null or (minimum_price >= 0 and minimum_price <= unit_price)),
  constraint products_cost_price_check
    check (cost_price is null or cost_price >= 0),
  constraint products_currency_check
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint products_tax_selection_check
    check (tax_rate_id is null or tax_group_id is null),
  constraint products_inventory_type_check
    check (not track_inventory or product_type = 'goods'),
  constraint products_low_stock_check
    check (low_stock_threshold is null or low_stock_threshold >= 0),
  constraint products_default_hours_check
    check (default_hours is null or default_hours > 0)
);

comment on table public.products is
  'Items and services that can be placed on an invoice, estimate or order.';
comment on column public.products.unit_price is
  'Price per unit with four decimals; document totals are rounded separately.';
comment on column public.products.track_inventory is
  'Only stock items participate in inventory movements and low stock alerts.';

create unique index products_sku_unique
  on public.products (company_id, sku)
  where sku is not null and deleted_at is null;

create unique index products_barcode_unique
  on public.products (company_id, barcode)
  where barcode is not null and deleted_at is null;

create index products_company_status_idx
  on public.products (company_id, status)
  where deleted_at is null and archived_at is null;

create index products_category_idx
  on public.products (category_id)
  where deleted_at is null;

create index products_name_trgm_idx
  on public.products using gin (name extensions.gin_trgm_ops);

create index products_inventory_idx
  on public.products (company_id)
  where track_inventory and deleted_at is null;

-- Resolves the price a specific client pays for an item, applying the price
-- list assigned to that client and falling back to the catalogue price.
create or replace function public.resolve_product_price(
  p_product_id uuid,
  p_client_id uuid default null,
  p_quantity numeric default 1
)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_base_price numeric;
  v_price_list_id uuid;
  v_method public.price_list_method;
  v_adjustment numeric;
  v_fixed_price numeric;
  v_item_adjustment numeric;
begin
  select company_id, unit_price
    into v_company_id, v_base_price
    from public.products
   where id = p_product_id
     and deleted_at is null;

  if v_base_price is null then
    raise exception 'Product % was not found', p_product_id
      using errcode = 'P0002';
  end if;

  if p_client_id is null then
    return round(v_base_price, 4);
  end if;

  select c.default_price_list_id
    into v_price_list_id
    from public.clients as c
   where c.id = p_client_id
     and c.company_id = v_company_id
     and c.deleted_at is null;

  if v_price_list_id is null then
    return round(v_base_price, 4);
  end if;

  select l.method, l.adjustment_percentage
    into v_method, v_adjustment
    from public.price_lists as l
   where l.id = v_price_list_id
     and l.deleted_at is null
     and l.archived_at is null
     and (l.effective_from is null or l.effective_from <= current_date)
     and (l.effective_to is null or l.effective_to >= current_date);

  if v_method is null then
    return round(v_base_price, 4);
  end if;

  select i.fixed_price, i.adjustment_percentage
    into v_fixed_price, v_item_adjustment
    from public.price_list_items as i
   where i.price_list_id = v_price_list_id
     and i.product_id = p_product_id
     and i.deleted_at is null
     and coalesce(p_quantity, 1) >= i.minimum_quantity
   order by i.minimum_quantity desc
   limit 1;

  if v_fixed_price is not null then
    return round(v_fixed_price, 4);
  end if;

  if v_item_adjustment is not null then
    v_adjustment := v_item_adjustment;
  end if;

  if v_method = 'discount_percentage' then
    return round(v_base_price * (1 - coalesce(v_adjustment, 0) / 100), 4);
  elsif v_method = 'markup_percentage' then
    return round(v_base_price * (1 + coalesce(v_adjustment, 0) / 100), 4);
  end if;

  return round(v_base_price, 4);
end;
$$;

comment on function public.resolve_product_price(uuid, uuid, numeric) is
  'Returns the unit price a client pays, honouring the assigned price list.';

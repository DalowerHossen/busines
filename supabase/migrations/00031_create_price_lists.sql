-- supabase/migrations/00031_create_price_lists.sql
-- Client specific pricing.
--
-- A price list either sets an explicit price for an item or shifts the
-- catalogue price by a percentage. Quantity breaks are supported through the
-- minimum quantity on each entry.

create table public.price_lists (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  name text not null,
  description text,
  method public.price_list_method not null default 'discount_percentage',

  -- Used when the method is a percentage and the entry does not override it.
  adjustment_percentage numeric(7, 4) not null default 0,

  currency char(3),
  effective_from date,
  effective_to date,
  is_default boolean not null default false,
  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint price_lists_name_check
    check (length(btrim(name)) between 1 and 100),
  constraint price_lists_currency_check
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint price_lists_adjustment_check
    check (adjustment_percentage between -100 and 1000),
  constraint price_lists_period_check
    check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

comment on table public.price_lists is
  'Named pricing rules assigned to clients, such as wholesale or partner rates.';

create unique index price_lists_name_unique
  on public.price_lists (company_id, name)
  where deleted_at is null;

create unique index price_lists_default_unique
  on public.price_lists (company_id)
  where is_default and deleted_at is null and archived_at is null;

create index price_lists_company_idx
  on public.price_lists (company_id)
  where deleted_at is null and archived_at is null;

create table public.price_list_items (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  price_list_id uuid not null,
  product_id uuid not null,

  -- Either an explicit price or a percentage that overrides the list default.
  fixed_price numeric(18, 4),
  adjustment_percentage numeric(7, 4),
  minimum_quantity numeric(14, 3) not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint price_list_items_value_check
    check (fixed_price is not null or adjustment_percentage is not null),
  constraint price_list_items_fixed_price_check
    check (fixed_price is null or fixed_price >= 0),
  constraint price_list_items_adjustment_check
    check (adjustment_percentage is null or adjustment_percentage between -100 and 1000),
  constraint price_list_items_quantity_check
    check (minimum_quantity > 0)
);

comment on table public.price_list_items is
  'Per item overrides inside a price list, including quantity breaks.';

create unique index price_list_items_unique
  on public.price_list_items (price_list_id, product_id, minimum_quantity)
  where deleted_at is null;

create index price_list_items_product_idx
  on public.price_list_items (product_id)
  where deleted_at is null;

create index price_list_items_company_idx
  on public.price_list_items (company_id)
  where deleted_at is null;

create or replace function public.demote_other_default_price_lists()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.is_default and new.deleted_at is null and new.archived_at is null then
    update public.price_lists
       set is_default = false,
           updated_at = now()
     where company_id = new.company_id
       and id <> new.id
       and is_default
       and deleted_at is null;
  end if;

  return new;
end;
$$;

comment on function public.demote_other_default_price_lists() is
  'Keeps a single default price list per company when another one is promoted.';

create trigger price_lists_single_default
  before insert or update of is_default on public.price_lists
  for each row execute function public.demote_other_default_price_lists();

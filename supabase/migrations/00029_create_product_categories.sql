-- supabase/migrations/00029_create_product_categories.sql
-- Catalogue categories and units of measure.
--
-- Categories are a shallow tree: a category may have one parent, which is
-- enough for reporting without turning the catalogue into a hierarchy the user
-- has to maintain.

create table public.product_categories (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  parent_category_id uuid,

  name text not null,
  slug text not null,
  description text,
  color text,
  sort_order smallint not null default 0,
  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint product_categories_name_check
    check (length(btrim(name)) between 1 and 80),
  constraint product_categories_slug_check
    check (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  constraint product_categories_color_check
    check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint product_categories_self_parent_check
    check (parent_category_id is distinct from id)
);

comment on table public.product_categories is
  'Grouping of catalogue items for navigation and reporting.';

create unique index product_categories_slug_unique
  on public.product_categories (company_id, slug)
  where deleted_at is null;

create index product_categories_parent_idx
  on public.product_categories (parent_category_id)
  where deleted_at is null;

create index product_categories_company_idx
  on public.product_categories (company_id, sort_order)
  where deleted_at is null and archived_at is null;

-- A category tree is one level deep, so a child cannot itself become a parent.
create or replace function public.enforce_category_depth()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_parent_has_parent boolean;
  v_has_children boolean;
begin
  if new.parent_category_id is null then
    return new;
  end if;

  select parent_category_id is not null
    into v_parent_has_parent
    from public.product_categories
   where id = new.parent_category_id;

  if coalesce(v_parent_has_parent, false) then
    raise exception 'A category tree may be only one level deep'
      using errcode = '23514';
  end if;

  select exists (
           select 1
             from public.product_categories
            where parent_category_id = new.id
              and deleted_at is null
         )
    into v_has_children;

  if v_has_children then
    raise exception 'A category that has children cannot be nested'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.enforce_category_depth() is
  'Keeps the catalogue category tree at a single level of nesting.';

create trigger product_categories_depth_guard
  before insert or update of parent_category_id on public.product_categories
  for each row execute function public.enforce_category_depth();

-- -----------------------------------------------------------------------------
-- Units of measure
-- -----------------------------------------------------------------------------

create table public.units_of_measure (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  name text not null,
  abbreviation text not null,
  -- Decimal places allowed on a quantity, for example 2 for hours and 0 for
  -- items that cannot be sold in fractions.
  quantity_precision smallint not null default 2,
  is_default boolean not null default false,
  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint units_of_measure_name_check
    check (length(btrim(name)) between 1 and 40),
  constraint units_of_measure_abbreviation_check
    check (length(btrim(abbreviation)) between 1 and 12),
  constraint units_of_measure_precision_check
    check (quantity_precision between 0 and 4)
);

comment on table public.units_of_measure is
  'Units a quantity can be expressed in, such as hours, items or kilograms.';

create unique index units_of_measure_abbreviation_unique
  on public.units_of_measure (company_id, abbreviation)
  where deleted_at is null;

create unique index units_of_measure_default_unique
  on public.units_of_measure (company_id)
  where is_default and deleted_at is null;

create index units_of_measure_company_idx
  on public.units_of_measure (company_id)
  where deleted_at is null and archived_at is null;

-- supabase/migrations/00067_product_categories.sql
-- Tenant-scoped product and service categories. Categories may be nested so
-- a company can organise a large catalogue into parent and child groups.

create table public.product_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name text not null,
  parent_category_id uuid null references public.product_categories (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint product_categories_name_not_blank check (length(btrim(name)) > 0),
  constraint product_categories_not_self_parent check (
    parent_category_id is null or parent_category_id <> id
  )
);

create unique index product_categories_company_name_key
  on public.product_categories (company_id, lower(name))
  where deleted_at is null;
create index product_categories_parent_id_idx
  on public.product_categories (parent_category_id)
  where parent_category_id is not null and deleted_at is null;
create index product_categories_company_id_idx
  on public.product_categories (company_id)
  where deleted_at is null;

comment on table public.product_categories is
  'A tenant-scoped, optionally nested category for products and services.';

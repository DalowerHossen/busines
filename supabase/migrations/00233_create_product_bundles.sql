-- supabase/migrations/00233_create_product_bundles.sql
-- Fixed price bundles of catalogue items.
--
-- A bundle is a sellable catalogue entry composed of one or more products or
-- services. The components live in product_bundle_items so a bundle can be
-- repriced without touching the products it contains.

create table public.product_bundles (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null references public.companies (id),

  name text not null,
  description text,
  currency_code char(3) not null default 'USD',
  bundle_price_amount numeric(18, 4) not null default 0,
  is_archived boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint product_bundles_name_not_blank check (length(btrim(name)) > 0),
  constraint product_bundles_price_non_negative check (bundle_price_amount >= 0)
);

create unique index product_bundles_company_name_key
  on public.product_bundles (company_id, lower(name))
  where deleted_at is null;
create index product_bundles_company_id_idx
  on public.product_bundles (company_id)
  where deleted_at is null;

comment on table public.product_bundles is
  'A tenant scoped fixed price bundle of products and services.';

create table public.product_bundle_items (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null references public.companies (id),
  bundle_id uuid not null references public.product_bundles (id) on delete cascade,
  product_id uuid not null references public.products (id),

  quantity numeric(18, 4) not null default 1,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint product_bundle_items_quantity_positive check (quantity > 0),
  constraint product_bundle_items_sort_order_non_negative check (sort_order >= 0)
);

create unique index product_bundle_items_bundle_product_key
  on public.product_bundle_items (bundle_id, product_id)
  where deleted_at is null;
create index product_bundle_items_company_id_idx
  on public.product_bundle_items (company_id)
  where deleted_at is null;
create index product_bundle_items_product_id_idx
  on public.product_bundle_items (product_id)
  where deleted_at is null;

comment on table public.product_bundle_items is
  'One product or service component and its quantity within a product bundle.';

select public.install_timestamp_trigger('product_bundles');
select public.install_timestamp_trigger('product_bundle_items');
select public.install_audit_trigger('product_bundles');
select public.install_audit_trigger('product_bundle_items');

alter table public.product_bundles enable row level security;
alter table public.product_bundle_items enable row level security;
alter table public.product_bundles force row level security;
alter table public.product_bundle_items force row level security;

select public.install_tenant_policies('product_bundles');
select public.install_tenant_policies('product_bundle_items');

-- Components are replaced wholesale when a bundle is edited, so the write
-- roles also need delete on the join rows.
create policy product_bundle_items_delete on public.product_bundle_items
  for delete to authenticated
  using (public.can_write_company_data(company_id));

grant select, insert, update on public.product_bundles to authenticated;
grant select, insert, update, delete on public.product_bundle_items to authenticated;

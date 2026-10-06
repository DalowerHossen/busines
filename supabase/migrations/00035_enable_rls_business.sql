-- supabase/migrations/00035_enable_rls_business.sql
-- Row level security for the client directory, the catalogue and pricing.
--
-- Reading follows public.has_company_access, so an accountant with a grant can
-- see the records they need for bookkeeping. Writing follows
-- public.can_write_company_data, which excludes accountants, resellers and
-- affiliates entirely.

alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.client_addresses enable row level security;
alter table public.tax_rates enable row level security;
alter table public.tax_groups enable row level security;
alter table public.tax_group_members enable row level security;
alter table public.product_categories enable row level security;
alter table public.units_of_measure enable row level security;
alter table public.products enable row level security;
alter table public.price_lists enable row level security;
alter table public.price_list_items enable row level security;
alter table public.tags enable row level security;
alter table public.taggings enable row level security;
alter table public.saved_views enable row level security;

alter table public.clients force row level security;
alter table public.client_contacts force row level security;
alter table public.client_addresses force row level security;
alter table public.tax_rates force row level security;
alter table public.tax_groups force row level security;
alter table public.tax_group_members force row level security;
alter table public.product_categories force row level security;
alter table public.units_of_measure force row level security;
alter table public.products force row level security;
alter table public.price_lists force row level security;
alter table public.price_list_items force row level security;
alter table public.tags force row level security;
alter table public.taggings force row level security;
alter table public.saved_views force row level security;

-- Installs the standard tenant policies on a table that carries company_id,
-- deleted_at and the usual audit columns.
create or replace function public.install_tenant_policies(
  p_table text,
  p_schema text default 'public'
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  execute format('drop policy if exists %I on %I.%I', p_table || '_select', p_schema, p_table);
  execute format('drop policy if exists %I on %I.%I', p_table || '_insert', p_schema, p_table);
  execute format('drop policy if exists %I on %I.%I', p_table || '_update', p_schema, p_table);

  execute format(
    'create policy %I on %I.%I
       for select to authenticated
       using (deleted_at is null and public.has_company_access(company_id))',
    p_table || '_select', p_schema, p_table
  );

  execute format(
    'create policy %I on %I.%I
       for insert to authenticated
       with check (public.can_write_company_data(company_id))',
    p_table || '_insert', p_schema, p_table
  );

  execute format(
    'create policy %I on %I.%I
       for update to authenticated
       using (public.can_write_company_data(company_id))
       with check (public.can_write_company_data(company_id))',
    p_table || '_update', p_schema, p_table
  );
end;
$$;

comment on function public.install_tenant_policies(text, text) is
  'Installs the standard read and write policies on a tenant scoped table.';

select public.install_tenant_policies('clients');
select public.install_tenant_policies('client_contacts');
select public.install_tenant_policies('client_addresses');
select public.install_tenant_policies('tax_rates');
select public.install_tenant_policies('tax_groups');
select public.install_tenant_policies('product_categories');
select public.install_tenant_policies('units_of_measure');
select public.install_tenant_policies('products');
select public.install_tenant_policies('price_lists');
select public.install_tenant_policies('price_list_items');
select public.install_tenant_policies('tags');

-- Join tables have no deleted_at column, so they carry their own policies.
create policy tax_group_members_select on public.tax_group_members
  for select to authenticated
  using (public.has_company_access(company_id));

create policy tax_group_members_insert on public.tax_group_members
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy tax_group_members_update on public.tax_group_members
  for update to authenticated
  using (public.can_write_company_data(company_id))
  with check (public.can_write_company_data(company_id));

create policy tax_group_members_delete on public.tax_group_members
  for delete to authenticated
  using (public.can_write_company_data(company_id));

create policy taggings_select on public.taggings
  for select to authenticated
  using (public.has_company_access(company_id));

create policy taggings_insert on public.taggings
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy taggings_delete on public.taggings
  for delete to authenticated
  using (public.can_write_company_data(company_id));

-- A saved view is either private to its owner or shared with the company.
create policy saved_views_select on public.saved_views
  for select to authenticated
  using (
    deleted_at is null
    and public.has_company_access(company_id)
    and (is_shared or owner_user_id = public.current_user_id())
  );

create policy saved_views_insert on public.saved_views
  for insert to authenticated
  with check (
    public.has_company_access(company_id)
    and (owner_user_id = public.current_user_id() or public.is_company_owner(company_id))
  );

create policy saved_views_update on public.saved_views
  for update to authenticated
  using (
    deleted_at is null
    and public.has_company_access(company_id)
    and (owner_user_id = public.current_user_id() or public.is_company_owner(company_id))
  )
  with check (
    public.has_company_access(company_id)
    and (owner_user_id = public.current_user_id() or public.is_company_owner(company_id))
  );

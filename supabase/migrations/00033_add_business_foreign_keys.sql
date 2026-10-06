-- supabase/migrations/00033_add_business_foreign_keys.sql
-- Relationships between the client directory, the catalogue and pricing.
--
-- Everything that belongs to a tenant cascades from the company. References
-- that documents depend on are restricted instead, so a record that has been
-- invoiced cannot disappear from under a document.

alter table public.clients
  add constraint clients_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.clients
  add constraint clients_merged_into_fkey
  foreign key (merged_into_client_id) references public.clients (id) on delete set null;

alter table public.clients
  add constraint clients_default_price_list_fkey
  foreign key (default_price_list_id) references public.price_lists (id) on delete set null;

alter table public.clients
  add constraint clients_default_tax_rate_fkey
  foreign key (default_tax_rate_id) references public.tax_rates (id) on delete set null;

alter table public.clients
  add constraint clients_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.clients
  add constraint clients_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.client_contacts
  add constraint client_contacts_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.client_contacts
  add constraint client_contacts_client_fkey
  foreign key (client_id) references public.clients (id) on delete cascade;

alter table public.client_contacts
  add constraint client_contacts_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.client_contacts
  add constraint client_contacts_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.client_addresses
  add constraint client_addresses_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.client_addresses
  add constraint client_addresses_client_fkey
  foreign key (client_id) references public.clients (id) on delete cascade;

alter table public.client_addresses
  add constraint client_addresses_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.client_addresses
  add constraint client_addresses_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.tax_rates
  add constraint tax_rates_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.tax_rates
  add constraint tax_rates_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.tax_rates
  add constraint tax_rates_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.tax_groups
  add constraint tax_groups_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.tax_groups
  add constraint tax_groups_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.tax_groups
  add constraint tax_groups_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.tax_group_members
  add constraint tax_group_members_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.tax_group_members
  add constraint tax_group_members_group_fkey
  foreign key (tax_group_id) references public.tax_groups (id) on delete cascade;

alter table public.tax_group_members
  add constraint tax_group_members_rate_fkey
  foreign key (tax_rate_id) references public.tax_rates (id) on delete restrict;

alter table public.product_categories
  add constraint product_categories_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.product_categories
  add constraint product_categories_parent_fkey
  foreign key (parent_category_id) references public.product_categories (id) on delete set null;

alter table public.product_categories
  add constraint product_categories_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.product_categories
  add constraint product_categories_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.units_of_measure
  add constraint units_of_measure_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.units_of_measure
  add constraint units_of_measure_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.units_of_measure
  add constraint units_of_measure_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.products
  add constraint products_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.products
  add constraint products_category_fkey
  foreign key (category_id) references public.product_categories (id) on delete set null;

alter table public.products
  add constraint products_unit_fkey
  foreign key (unit_of_measure_id) references public.units_of_measure (id) on delete set null;

alter table public.products
  add constraint products_tax_rate_fkey
  foreign key (tax_rate_id) references public.tax_rates (id) on delete set null;

alter table public.products
  add constraint products_tax_group_fkey
  foreign key (tax_group_id) references public.tax_groups (id) on delete set null;

alter table public.products
  add constraint products_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.products
  add constraint products_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.price_lists
  add constraint price_lists_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.price_lists
  add constraint price_lists_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.price_lists
  add constraint price_lists_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.price_list_items
  add constraint price_list_items_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.price_list_items
  add constraint price_list_items_list_fkey
  foreign key (price_list_id) references public.price_lists (id) on delete cascade;

alter table public.price_list_items
  add constraint price_list_items_product_fkey
  foreign key (product_id) references public.products (id) on delete cascade;

alter table public.price_list_items
  add constraint price_list_items_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.price_list_items
  add constraint price_list_items_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.tags
  add constraint tags_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.tags
  add constraint tags_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.tags
  add constraint tags_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.taggings
  add constraint taggings_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.taggings
  add constraint taggings_tag_fkey
  foreign key (tag_id) references public.tags (id) on delete cascade;

alter table public.taggings
  add constraint taggings_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.saved_views
  add constraint saved_views_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.saved_views
  add constraint saved_views_owner_fkey
  foreign key (owner_user_id) references public.users (id) on delete cascade;

alter table public.saved_views
  add constraint saved_views_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.saved_views
  add constraint saved_views_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

-- A price list, tax rate or product referenced by a client must belong to the
-- same tenant. The composite unique keys below let the database prove it.
create unique index clients_company_scope_key
  on public.clients (id, company_id);

create unique index price_lists_company_scope_key
  on public.price_lists (id, company_id);

create unique index products_company_scope_key
  on public.products (id, company_id);

create unique index tax_rates_company_scope_key
  on public.tax_rates (id, company_id);

-- Tenant scoped relationships. These constraints make it impossible to point a
-- record at a price list, product or tax rate that belongs to another company,
-- even if the application layer is bypassed. The single column constraints
-- above already define what happens when the parent row disappears.
alter table public.clients
  add constraint clients_price_list_same_company_fkey
  foreign key (default_price_list_id, company_id)
  references public.price_lists (id, company_id);

alter table public.clients
  add constraint clients_tax_rate_same_company_fkey
  foreign key (default_tax_rate_id, company_id)
  references public.tax_rates (id, company_id);

alter table public.products
  add constraint products_tax_rate_same_company_fkey
  foreign key (tax_rate_id, company_id)
  references public.tax_rates (id, company_id);

alter table public.price_list_items
  add constraint price_list_items_product_same_company_fkey
  foreign key (product_id, company_id)
  references public.products (id, company_id);

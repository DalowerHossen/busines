-- supabase/migrations/00036_grant_business_privileges.sql
-- Table privileges for the client directory, the catalogue and pricing.
-- Row level security still decides which rows each caller may touch.

grant select, insert, update on public.clients to authenticated;
grant select, insert, update on public.client_contacts to authenticated;
grant select, insert, update on public.client_addresses to authenticated;
grant select, insert, update on public.tax_rates to authenticated;
grant select, insert, update on public.tax_groups to authenticated;
grant select, insert, update, delete on public.tax_group_members to authenticated;
grant select, insert, update on public.product_categories to authenticated;
grant select, insert, update on public.units_of_measure to authenticated;
grant select, insert, update on public.products to authenticated;
grant select, insert, update on public.price_lists to authenticated;
grant select, insert, update on public.price_list_items to authenticated;
grant select, insert, update on public.tags to authenticated;
grant select, insert, delete on public.taggings to authenticated;
grant select, insert, update on public.saved_views to authenticated;

grant execute on function public.find_duplicate_clients(uuid, text, text, text, uuid)
  to authenticated;
grant execute on function public.merge_clients(uuid, uuid) to authenticated;
grant execute on function public.resolve_product_price(uuid, uuid, numeric) to authenticated;
grant execute on function public.effective_tax_group_rate(uuid) to authenticated;

-- Policy installation is a schema level operation and stays with the owner.
revoke all on function public.install_tenant_policies(text, text) from anon, authenticated;

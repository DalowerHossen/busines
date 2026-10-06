-- supabase/migrations/00172_enable_rls_partners.sql
-- Row level security for partners, the marketplace and developer apps.
--
-- The rule that matters most in this file is negative: a white label partner
-- can see that an account exists and what it owes them, and nothing else.
-- No policy here grants a partner access to a row in any tenant table, and
-- the partner facing policies below are deliberately confined to the five
-- partner tables.

alter table public.reseller_price_books enable row level security;
alter table public.reseller_plan_prices enable row level security;
alter table public.reseller_tenant_links enable row level security;
alter table public.reseller_commissions enable row level security;
alter table public.reseller_payouts enable row level security;
alter table public.reseller_domains enable row level security;
alter table public.marketplace_vendors enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_listing_versions enable row level security;
alter table public.marketplace_reviews enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_installs enable row level security;
alter table public.marketplace_vendor_earnings enable row level security;
alter table public.marketplace_vendor_payouts enable row level security;
alter table public.developer_apps enable row level security;
alter table public.developer_app_redirect_uris enable row level security;
alter table public.developer_app_installs enable row level security;
alter table public.developer_auth_codes enable row level security;
alter table public.developer_access_tokens enable row level security;
alter table public.developer_app_capabilities enable row level security;

alter table public.reseller_price_books force row level security;
alter table public.reseller_plan_prices force row level security;
alter table public.reseller_tenant_links force row level security;
alter table public.reseller_commissions force row level security;
alter table public.reseller_payouts force row level security;
alter table public.reseller_domains force row level security;
alter table public.marketplace_vendors force row level security;
alter table public.marketplace_listings force row level security;
alter table public.marketplace_listing_versions force row level security;
alter table public.marketplace_reviews force row level security;
alter table public.marketplace_orders force row level security;
alter table public.marketplace_installs force row level security;
alter table public.marketplace_vendor_earnings force row level security;
alter table public.marketplace_vendor_payouts force row level security;
alter table public.developer_apps force row level security;
alter table public.developer_app_redirect_uris force row level security;
alter table public.developer_app_installs force row level security;
alter table public.developer_auth_codes force row level security;
alter table public.developer_access_tokens force row level security;
alter table public.developer_app_capabilities force row level security;

-- -----------------------------------------------------------------------------
-- White label partners
-- -----------------------------------------------------------------------------

create policy reseller_price_books_select on public.reseller_price_books
  for select to authenticated
  using (public.is_super_admin() or public.is_reseller_owner(reseller_id));

create policy reseller_price_books_insert on public.reseller_price_books
  for insert to authenticated
  with check (public.is_super_admin() or public.is_reseller_owner(reseller_id));

create policy reseller_price_books_update on public.reseller_price_books
  for update to authenticated
  using (public.is_super_admin() or public.is_reseller_owner(reseller_id))
  with check (public.is_super_admin() or public.is_reseller_owner(reseller_id));

create policy reseller_plan_prices_select on public.reseller_plan_prices
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1
        from public.reseller_price_books as b
       where b.id = price_book_id
         and public.is_reseller_owner(b.reseller_id)
    )
  );

create policy reseller_plan_prices_insert on public.reseller_plan_prices
  for insert to authenticated
  with check (
    public.is_super_admin()
    or exists (
      select 1
        from public.reseller_price_books as b
       where b.id = price_book_id
         and public.is_reseller_owner(b.reseller_id)
    )
  );

create policy reseller_plan_prices_update on public.reseller_plan_prices
  for update to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1
        from public.reseller_price_books as b
       where b.id = price_book_id
         and public.is_reseller_owner(b.reseller_id)
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1
        from public.reseller_price_books as b
       where b.id = price_book_id
         and public.is_reseller_owner(b.reseller_id)
    )
  );

-- A partner sees the link row, which carries a name, a state and a total.
-- It carries nothing that was typed inside the account.
create policy reseller_tenant_links_select on public.reseller_tenant_links
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_reseller_owner(reseller_id)
    or public.has_company_access(company_id)
  );

create policy reseller_tenant_links_update on public.reseller_tenant_links
  for update to authenticated
  using (public.is_super_admin() or public.is_reseller_owner(reseller_id))
  with check (public.is_super_admin() or public.is_reseller_owner(reseller_id));

create policy reseller_commissions_select on public.reseller_commissions
  for select to authenticated
  using (public.is_super_admin() or public.is_reseller_owner(reseller_id));

create policy reseller_payouts_select on public.reseller_payouts
  for select to authenticated
  using (public.is_super_admin() or public.is_reseller_owner(reseller_id));

create policy reseller_payouts_insert on public.reseller_payouts
  for insert to authenticated
  with check (public.is_super_admin());

create policy reseller_payouts_update on public.reseller_payouts
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy reseller_domains_select on public.reseller_domains
  for select to authenticated
  using (public.is_super_admin() or public.is_reseller_owner(reseller_id));

create policy reseller_domains_insert on public.reseller_domains
  for insert to authenticated
  with check (public.is_super_admin() or public.is_reseller_owner(reseller_id));

create policy reseller_domains_update on public.reseller_domains
  for update to authenticated
  using (public.is_super_admin() or public.is_reseller_owner(reseller_id))
  with check (public.is_super_admin() or public.is_reseller_owner(reseller_id));

-- -----------------------------------------------------------------------------
-- Marketplace
-- -----------------------------------------------------------------------------

-- An approved vendor profile is part of the shopfront, so anyone browsing
-- may read it.
create policy marketplace_vendors_public_select on public.marketplace_vendors
  for select to anon, authenticated
  using (status = 'approved' and deleted_at is null);

create policy marketplace_vendors_own_select on public.marketplace_vendors
  for select to authenticated
  using (
    public.is_super_admin()
    or (company_id is not null and public.has_company_access(company_id))
    or (reseller_id is not null and public.is_reseller_owner(reseller_id))
  );

create policy marketplace_vendors_insert on public.marketplace_vendors
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (company_id is not null and public.is_company_owner(company_id))
    or (reseller_id is not null and public.is_reseller_owner(reseller_id))
  );

create policy marketplace_vendors_update on public.marketplace_vendors
  for update to authenticated
  using (
    public.is_super_admin()
    or (company_id is not null and public.is_company_owner(company_id))
    or (reseller_id is not null and public.is_reseller_owner(reseller_id))
  )
  with check (
    public.is_super_admin()
    or (company_id is not null and public.is_company_owner(company_id))
    or (reseller_id is not null and public.is_reseller_owner(reseller_id))
  );

create policy marketplace_listings_public_select on public.marketplace_listings
  for select to anon, authenticated
  using (status = 'published' and deleted_at is null);

create policy marketplace_listings_vendor_select on public.marketplace_listings
  for select to authenticated
  using (public.is_super_admin() or public.is_marketplace_vendor(vendor_id));

create policy marketplace_listings_insert on public.marketplace_listings
  for insert to authenticated
  with check (public.is_super_admin() or public.is_marketplace_vendor(vendor_id));

create policy marketplace_listings_update on public.marketplace_listings
  for update to authenticated
  using (public.is_super_admin() or public.is_marketplace_vendor(vendor_id))
  with check (public.is_super_admin() or public.is_marketplace_vendor(vendor_id));

create policy marketplace_listing_versions_select
  on public.marketplace_listing_versions
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1
        from public.marketplace_listings as l
       where l.id = listing_id
         and (l.status = 'published' or public.is_marketplace_vendor(l.vendor_id))
    )
  );

create policy marketplace_reviews_public_select on public.marketplace_reviews
  for select to anon, authenticated
  using (is_visible and deleted_at is null);

create policy marketplace_reviews_own_select on public.marketplace_reviews
  for select to authenticated
  using (public.is_super_admin() or public.has_company_access(company_id));

create policy marketplace_reviews_update on public.marketplace_reviews
  for update to authenticated
  using (
    public.is_super_admin()
    or public.is_company_owner(company_id)
    or exists (
      select 1
        from public.marketplace_listings as l
       where l.id = listing_id
         and public.is_marketplace_vendor(l.vendor_id)
    )
  )
  with check (
    public.is_super_admin()
    or public.is_company_owner(company_id)
    or exists (
      select 1
        from public.marketplace_listings as l
       where l.id = listing_id
         and public.is_marketplace_vendor(l.vendor_id)
    )
  );

-- A buyer reads their own orders. A vendor reads the orders for their own
-- listings, because that is their revenue, and nothing more of the buyer.
create policy marketplace_orders_select on public.marketplace_orders
  for select to authenticated
  using (
    public.is_super_admin()
    or public.has_company_access(company_id)
    or public.is_marketplace_vendor(vendor_id)
  );

create policy marketplace_installs_select on public.marketplace_installs
  for select to authenticated
  using (public.is_super_admin() or public.has_company_access(company_id));

create policy marketplace_installs_update on public.marketplace_installs
  for update to authenticated
  using (public.is_super_admin() or public.is_company_owner(company_id))
  with check (public.is_super_admin() or public.is_company_owner(company_id));

create policy marketplace_vendor_earnings_select
  on public.marketplace_vendor_earnings
  for select to authenticated
  using (public.is_super_admin() or public.is_marketplace_vendor(vendor_id));

create policy marketplace_vendor_payouts_select
  on public.marketplace_vendor_payouts
  for select to authenticated
  using (public.is_super_admin() or public.is_marketplace_vendor(vendor_id));

-- -----------------------------------------------------------------------------
-- Developer platform
-- -----------------------------------------------------------------------------

-- A public application is listed in the directory for everyone, but its
-- secret columns are withheld by the grants in the next file.
create policy developer_apps_directory_select on public.developer_apps
  for select to anon, authenticated
  using (distribution = 'public' and status = 'approved' and deleted_at is null);

create policy developer_apps_own_select on public.developer_apps
  for select to authenticated
  using (public.can_manage_developer_app(id));

create policy developer_apps_insert on public.developer_apps
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (owner_company_id is not null
        and public.is_company_owner(owner_company_id))
    or (owner_reseller_id is not null
        and public.is_reseller_owner(owner_reseller_id))
  );

create policy developer_apps_update on public.developer_apps
  for update to authenticated
  using (public.can_manage_developer_app(id))
  with check (public.can_manage_developer_app(id));

create policy developer_app_redirect_uris_select
  on public.developer_app_redirect_uris
  for select to authenticated
  using (public.can_manage_developer_app(app_id));

create policy developer_app_redirect_uris_insert
  on public.developer_app_redirect_uris
  for insert to authenticated
  with check (public.can_manage_developer_app(app_id));

create policy developer_app_redirect_uris_update
  on public.developer_app_redirect_uris
  for update to authenticated
  using (public.can_manage_developer_app(app_id))
  with check (public.can_manage_developer_app(app_id));

-- A connection is visible to the account that made it and to the developer
-- whose application it is, because both sides need the audit.
create policy developer_app_installs_select on public.developer_app_installs
  for select to authenticated
  using (
    public.is_super_admin()
    or public.has_company_access(company_id)
    or public.can_manage_developer_app(app_id)
  );

create policy developer_app_installs_update on public.developer_app_installs
  for update to authenticated
  using (public.is_super_admin() or public.is_company_owner(company_id))
  with check (public.is_super_admin() or public.is_company_owner(company_id));

-- Codes and tokens belong to the platform alone. Nobody reads them back.
create policy developer_auth_codes_service_only on public.developer_auth_codes
  for select to authenticated
  using (public.is_super_admin());

create policy developer_access_tokens_service_only
  on public.developer_access_tokens
  for select to authenticated
  using (public.is_super_admin());

create policy developer_app_capabilities_select
  on public.developer_app_capabilities
  for select to anon, authenticated
  using (
    is_active
    and exists (
      select 1
        from public.developer_apps as a
       where a.id = app_id
         and a.status = 'approved'
         and a.deleted_at is null
    )
  );

create policy developer_app_capabilities_manage
  on public.developer_app_capabilities
  for all to authenticated
  using (public.can_manage_developer_app(app_id))
  with check (public.can_manage_developer_app(app_id));

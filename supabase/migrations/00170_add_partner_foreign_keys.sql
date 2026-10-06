-- supabase/migrations/00170_add_partner_foreign_keys.sql
-- The relationships of the reseller, marketplace and developer tables.
--
-- Money records are never cascaded away. A commission or an order is an
-- accounting fact: if the listing or the account behind it disappears, the
-- figure stays and the pointer is simply left alone.

-- -----------------------------------------------------------------------------
-- White label partners
-- -----------------------------------------------------------------------------

alter table public.reseller_price_books
  add constraint reseller_price_books_reseller_fk
    foreign key (reseller_id) references public.resellers (id) on delete cascade,
  add constraint reseller_price_books_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint reseller_price_books_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.reseller_plan_prices
  add constraint reseller_plan_prices_price_book_fk
    foreign key (price_book_id) references public.reseller_price_books (id)
      on delete cascade,
  add constraint reseller_plan_prices_plan_fk
    foreign key (plan_id) references public.subscription_plans (id) on delete cascade;

alter table public.reseller_tenant_links
  add constraint reseller_tenant_links_reseller_fk
    foreign key (reseller_id) references public.resellers (id) on delete cascade,
  add constraint reseller_tenant_links_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint reseller_tenant_links_price_book_fk
    foreign key (price_book_id) references public.reseller_price_books (id)
      on delete set null;

alter table public.reseller_commissions
  add constraint reseller_commissions_reseller_fk
    foreign key (reseller_id) references public.resellers (id) on delete cascade,
  add constraint reseller_commissions_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint reseller_commissions_payout_fk
    foreign key (payout_id) references public.reseller_payouts (id)
      on delete set null;

alter table public.reseller_payouts
  add constraint reseller_payouts_reseller_fk
    foreign key (reseller_id) references public.resellers (id) on delete cascade,
  add constraint reseller_payouts_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint reseller_payouts_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.reseller_domains
  add constraint reseller_domains_reseller_fk
    foreign key (reseller_id) references public.resellers (id) on delete cascade,
  add constraint reseller_domains_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Marketplace
-- -----------------------------------------------------------------------------

alter table public.marketplace_vendors
  add constraint marketplace_vendors_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint marketplace_vendors_reseller_fk
    foreign key (reseller_id) references public.resellers (id) on delete cascade,
  add constraint marketplace_vendors_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint marketplace_vendors_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.marketplace_listings
  add constraint marketplace_listings_vendor_fk
    foreign key (vendor_id) references public.marketplace_vendors (id)
      on delete cascade,
  add constraint marketplace_listings_reviewed_by_fk
    foreign key (reviewed_by) references public.users (id) on delete set null,
  add constraint marketplace_listings_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint marketplace_listings_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.marketplace_listing_versions
  add constraint marketplace_listing_versions_listing_fk
    foreign key (listing_id) references public.marketplace_listings (id)
      on delete cascade,
  add constraint marketplace_listing_versions_published_by_fk
    foreign key (published_by) references public.users (id) on delete set null;

alter table public.marketplace_reviews
  add constraint marketplace_reviews_listing_fk
    foreign key (listing_id) references public.marketplace_listings (id)
      on delete cascade,
  add constraint marketplace_reviews_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint marketplace_reviews_install_fk
    foreign key (install_id) references public.marketplace_installs (id)
      on delete set null;

alter table public.marketplace_orders
  add constraint marketplace_orders_listing_fk
    foreign key (listing_id) references public.marketplace_listings (id)
      on delete restrict,
  add constraint marketplace_orders_vendor_fk
    foreign key (vendor_id) references public.marketplace_vendors (id)
      on delete restrict,
  add constraint marketplace_orders_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint marketplace_orders_purchased_by_fk
    foreign key (purchased_by) references public.users (id) on delete set null;

alter table public.marketplace_installs
  add constraint marketplace_installs_listing_fk
    foreign key (listing_id) references public.marketplace_listings (id)
      on delete cascade,
  add constraint marketplace_installs_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint marketplace_installs_order_fk
    foreign key (order_id) references public.marketplace_orders (id)
      on delete set null,
  add constraint marketplace_installs_installed_by_fk
    foreign key (installed_by) references public.users (id) on delete set null;

alter table public.marketplace_vendor_earnings
  add constraint marketplace_vendor_earnings_vendor_fk
    foreign key (vendor_id) references public.marketplace_vendors (id)
      on delete cascade,
  add constraint marketplace_vendor_earnings_order_fk
    foreign key (order_id) references public.marketplace_orders (id)
      on delete cascade,
  add constraint marketplace_vendor_earnings_payout_fk
    foreign key (payout_id) references public.marketplace_vendor_payouts (id)
      on delete set null;

alter table public.marketplace_vendor_payouts
  add constraint marketplace_vendor_payouts_vendor_fk
    foreign key (vendor_id) references public.marketplace_vendors (id)
      on delete cascade;

-- -----------------------------------------------------------------------------
-- Developer platform
-- -----------------------------------------------------------------------------

alter table public.developer_apps
  add constraint developer_apps_owner_company_fk
    foreign key (owner_company_id) references public.companies (id)
      on delete cascade,
  add constraint developer_apps_owner_reseller_fk
    foreign key (owner_reseller_id) references public.resellers (id)
      on delete cascade,
  add constraint developer_apps_approved_by_fk
    foreign key (approved_by) references public.users (id) on delete set null,
  add constraint developer_apps_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint developer_apps_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.developer_app_redirect_uris
  add constraint developer_app_redirect_uris_app_fk
    foreign key (app_id) references public.developer_apps (id) on delete cascade,
  add constraint developer_app_redirect_uris_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null;

alter table public.developer_app_installs
  add constraint developer_app_installs_app_fk
    foreign key (app_id) references public.developer_apps (id) on delete cascade,
  add constraint developer_app_installs_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint developer_app_installs_installed_by_fk
    foreign key (installed_by) references public.users (id) on delete set null,
  add constraint developer_app_installs_revoked_by_fk
    foreign key (revoked_by) references public.users (id) on delete set null;

alter table public.developer_auth_codes
  add constraint developer_auth_codes_app_fk
    foreign key (app_id) references public.developer_apps (id) on delete cascade,
  add constraint developer_auth_codes_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint developer_auth_codes_user_fk
    foreign key (user_id) references public.users (id) on delete set null;

alter table public.developer_access_tokens
  add constraint developer_access_tokens_install_fk
    foreign key (install_id) references public.developer_app_installs (id)
      on delete cascade,
  add constraint developer_access_tokens_app_fk
    foreign key (app_id) references public.developer_apps (id) on delete cascade,
  add constraint developer_access_tokens_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint developer_access_tokens_replaced_by_fk
    foreign key (replaced_by_token_id)
    references public.developer_access_tokens (id) on delete set null;

alter table public.developer_app_capabilities
  add constraint developer_app_capabilities_app_fk
    foreign key (app_id) references public.developer_apps (id) on delete cascade;

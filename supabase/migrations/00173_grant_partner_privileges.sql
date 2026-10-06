-- supabase/migrations/00173_grant_partner_privileges.sql
-- Table, column and routine privileges for partners, marketplace and apps.
--
-- Secrets are withheld at the column level, in the same way as the social
-- connection tokens: an application owner may read every descriptive column
-- of their own application, but never the stored secret itself.

grant select, insert, update on public.reseller_price_books to authenticated;
grant select, insert, update on public.reseller_plan_prices to authenticated;
grant select, update on public.reseller_tenant_links to authenticated;
grant select on public.reseller_commissions to authenticated;
grant select on public.reseller_payouts to authenticated;
grant select, insert, update on public.reseller_domains to authenticated;

-- Payout details of a vendor are theirs alone, so the shopfront columns are
-- listed one by one.
grant select (
  id, company_id, reseller_id, vendor_name, vendor_slug, headline, bio,
  support_email, website_url, logo_path, status, listing_count, install_count,
  average_rating, approved_at, created_at, updated_at, deleted_at
) on public.marketplace_vendors to anon, authenticated;

grant select (
  revenue_share_percentage, payout_currency, payout_method, lifetime_earnings,
  suspended_at, suspension_reason, created_by, updated_by
) on public.marketplace_vendors to authenticated;

grant insert on public.marketplace_vendors to authenticated;
grant update (
  vendor_name, headline, bio, support_email, website_url, logo_path,
  payout_currency, payout_method, payout_details_encrypted, status,
  suspended_at, suspension_reason, listing_count, install_count,
  average_rating, lifetime_earnings, approved_at, deleted_at, updated_at,
  updated_by
) on public.marketplace_vendors to authenticated;
grant select on public.marketplace_listings to anon, authenticated;
grant insert, update on public.marketplace_listings to authenticated;
grant select on public.marketplace_listing_versions to authenticated;
grant select on public.marketplace_reviews to anon, authenticated;
grant update on public.marketplace_reviews to authenticated;
grant select on public.marketplace_orders to authenticated;
grant select, update on public.marketplace_installs to authenticated;
grant select on public.marketplace_vendor_earnings to authenticated;
grant select on public.marketplace_vendor_payouts to authenticated;

-- The stored secrets of an application are never selectable.
grant select (
  id, owner_company_id, owner_reseller_id, app_slug, app_name, tagline,
  description, logo_path, homepage_url, privacy_policy_url, support_email,
  app_type, distribution, client_id, client_secret_hint, secret_rotated_at,
  previous_secret_expires_at,
  requested_scopes, allowed_scopes, webhook_url, status, submitted_at,
  approved_at, approved_by, rejection_reason, suspended_at, suspension_reason,
  install_count, rate_limit_per_minute, created_at, updated_at, deleted_at,
  created_by, updated_by
) on public.developer_apps to anon, authenticated;

grant insert on public.developer_apps to authenticated;
grant update (
  app_name, tagline, description, logo_path, homepage_url, privacy_policy_url,
  support_email, distribution, requested_scopes, webhook_url, status,
  submitted_at, deleted_at, updated_at, updated_by
) on public.developer_apps to authenticated;

grant select, insert, update on public.developer_app_redirect_uris
  to authenticated;
grant select, update on public.developer_app_installs to authenticated;
grant select, insert, update, delete on public.developer_app_capabilities
  to authenticated;
grant select on public.developer_app_capabilities to anon;

-- The code and token tables are read through routines, never directly.
revoke all on public.developer_auth_codes from authenticated;
revoke all on public.developer_access_tokens from authenticated;
grant select on public.developer_auth_codes to service_role;
grant select on public.developer_access_tokens to service_role;

-- -----------------------------------------------------------------------------
-- Partner routines
-- -----------------------------------------------------------------------------

grant execute on function public.is_reseller_owner(uuid) to authenticated;
grant execute on function public.current_reseller_id() to authenticated;
grant execute on function public.reseller_price_margin(uuid) to authenticated;
grant execute on function public.effective_plan_price(
  uuid, uuid, public.billing_interval
) to authenticated;
grant execute on function public.provision_sub_tenant(
  uuid, text, text, text, text, uuid
) to authenticated;
grant execute on function public.set_sub_tenant_status(uuid, text, text)
  to authenticated;
grant execute on function public.reseller_statement(uuid, date, date)
  to authenticated;
grant execute on function public.reseller_accounts(uuid) to authenticated;

-- Commission and payout arithmetic belongs to the platform.
revoke execute on function public.accrue_reseller_commission(
  uuid, date, date, numeric, numeric, char, uuid
) from public, authenticated;
revoke execute on function public.confirm_reseller_commission(uuid)
  from public, authenticated;
revoke execute on function public.reverse_reseller_commission(uuid, text)
  from public, authenticated;
revoke execute on function public.build_reseller_payout(uuid, date, date, numeric)
  from public, authenticated;
revoke execute on function public.settle_reseller_payout(uuid, text, text)
  from public, authenticated;

grant execute on function public.accrue_reseller_commission(
  uuid, date, date, numeric, numeric, char, uuid
) to service_role;
grant execute on function public.confirm_reseller_commission(uuid)
  to service_role;
grant execute on function public.reverse_reseller_commission(uuid, text)
  to service_role;
grant execute on function public.build_reseller_payout(uuid, date, date, numeric)
  to service_role;
grant execute on function public.settle_reseller_payout(uuid, text, text)
  to service_role;

-- -----------------------------------------------------------------------------
-- Marketplace routines
-- -----------------------------------------------------------------------------

grant execute on function public.is_marketplace_vendor(uuid) to authenticated;
grant execute on function public.submit_listing_for_review(uuid) to authenticated;
grant execute on function public.purchase_listing(uuid, uuid, text)
  to authenticated;
grant execute on function public.install_listing(uuid, uuid, jsonb)
  to authenticated;
grant execute on function public.uninstall_listing(uuid, text) to authenticated;
grant execute on function public.review_listing(uuid, uuid, smallint, text, text)
  to authenticated;
grant execute on function public.vendor_earnings_summary(uuid) to authenticated;

revoke execute on function public.publish_listing(uuid, text)
  from public, authenticated;
revoke execute on function public.reject_listing(uuid, text)
  from public, authenticated;
revoke execute on function public.confirm_marketplace_order(uuid, text)
  from public, authenticated;
revoke execute on function public.refund_marketplace_order(uuid, text)
  from public, authenticated;
revoke execute on function public.release_vendor_earnings()
  from public, authenticated;

grant execute on function public.publish_listing(uuid, text) to service_role;
grant execute on function public.reject_listing(uuid, text) to service_role;
grant execute on function public.confirm_marketplace_order(uuid, text)
  to service_role;
grant execute on function public.refund_marketplace_order(uuid, text)
  to service_role;
grant execute on function public.release_vendor_earnings() to service_role;

-- -----------------------------------------------------------------------------
-- Developer routines
-- -----------------------------------------------------------------------------

grant execute on function public.can_manage_developer_app(uuid) to authenticated;
grant execute on function public.register_developer_app(
  text, text, text, text[], uuid
) to authenticated;
grant execute on function public.create_authorization_code(
  uuid, uuid, text, text[], text, text
) to authenticated;
grant execute on function public.revoke_app_install(uuid, text) to authenticated;
grant execute on function public.rotate_app_secret(uuid) to authenticated;
grant execute on function public.connected_apps(uuid) to authenticated;
grant execute on function public.developer_token_has_scope(uuid, text)
  to authenticated;

revoke execute on function public.approve_developer_app(uuid, text[])
  from public, authenticated;
revoke execute on function public.exchange_authorization_code(text, text, text)
  from public, authenticated;
revoke execute on function public.authenticate_developer_token(text)
  from public, authenticated;
revoke execute on function public.expire_developer_credentials()
  from public, authenticated;

grant execute on function public.approve_developer_app(uuid, text[])
  to service_role;
grant execute on function public.exchange_authorization_code(text, text, text)
  to service_role;
grant execute on function public.authenticate_developer_token(text)
  to service_role;
grant execute on function public.expire_developer_credentials() to service_role;

-- supabase/migrations/00075_enable_rls_subscriptions.sql
-- Row level security for plans, subscriptions, coupons, usage and referrals.
--
-- Three rules shape this file:
--   plans and public coupons are catalogue data that anyone may read;
--   a subscription, its invoices and its usage belong to one tenant;
--   an affiliate sees its own clicks, referrals and commissions and nothing
--   else, which is why no referral policy ever exposes a company row.

alter table public.subscription_plans enable row level security;
alter table public.plan_prices enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_changes enable row level security;
alter table public.subscription_invoices enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.company_entitlement_overrides enable row level security;
alter table public.usage_counters enable row level security;
alter table public.usage_events enable row level security;
alter table public.platform_invoice_counters enable row level security;
alter table public.affiliates enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_referrals enable row level security;
alter table public.affiliate_commissions enable row level security;

alter table public.subscription_plans force row level security;
alter table public.plan_prices force row level security;
alter table public.subscriptions force row level security;
alter table public.subscription_changes force row level security;
alter table public.subscription_invoices force row level security;
alter table public.coupons force row level security;
alter table public.coupon_redemptions force row level security;
alter table public.company_entitlement_overrides force row level security;
alter table public.usage_counters force row level security;
alter table public.usage_events force row level security;
alter table public.platform_invoice_counters force row level security;
alter table public.affiliates force row level security;
alter table public.affiliate_links force row level security;
alter table public.affiliate_clicks force row level security;
alter table public.affiliate_referrals force row level security;
alter table public.affiliate_commissions force row level security;

-- -----------------------------------------------------------------------------
-- Catalogue
-- -----------------------------------------------------------------------------

-- The pricing page is public, so the plan catalogue is readable without an
-- account. Only the platform team may change it.
create policy subscription_plans_select on public.subscription_plans
  for select to anon, authenticated
  using (deleted_at is null and (public.is_super_admin() or (is_public and not is_archived)));

create policy subscription_plans_insert on public.subscription_plans
  for insert to authenticated
  with check (public.is_super_admin());

create policy subscription_plans_update on public.subscription_plans
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

comment on policy subscription_plans_select on public.subscription_plans is
  'Published plans are readable by anyone; the platform team sees them all.';

create policy plan_prices_select on public.plan_prices
  for select to anon, authenticated
  using (
    deleted_at is null
    and (
      public.is_super_admin()
      or exists (
        select 1
          from public.subscription_plans as p
         where p.id = plan_prices.plan_id
           and p.is_public
           and not p.is_archived
           and p.deleted_at is null
      )
    )
  );

create policy plan_prices_insert on public.plan_prices
  for insert to authenticated
  with check (public.is_super_admin());

create policy plan_prices_update on public.plan_prices
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- Subscriptions
-- -----------------------------------------------------------------------------

create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (deleted_at is null and public.has_company_access(company_id));

create policy subscriptions_insert on public.subscriptions
  for insert to authenticated
  with check (public.is_super_admin() or public.is_company_owner(company_id));

create policy subscriptions_update on public.subscriptions
  for update to authenticated
  using (
    deleted_at is null
    and (public.is_super_admin() or public.is_company_owner(company_id))
  )
  with check (public.is_super_admin() or public.is_company_owner(company_id));

comment on policy subscriptions_update on public.subscriptions is
  'Only the account owner, or the platform team, may change the plan.';

create policy subscription_changes_select on public.subscription_changes
  for select to authenticated
  using (public.has_company_access(company_id));

create policy subscription_changes_insert on public.subscription_changes
  for insert to authenticated
  with check (public.is_super_admin() or public.is_company_owner(company_id));

create policy subscription_invoices_select on public.subscription_invoices
  for select to authenticated
  using (deleted_at is null and public.has_company_access(company_id));

create policy subscription_invoices_insert on public.subscription_invoices
  for insert to authenticated
  with check (public.is_super_admin());

create policy subscription_invoices_update on public.subscription_invoices
  for update to authenticated
  using (deleted_at is null and public.is_super_admin())
  with check (public.is_super_admin());

comment on policy subscription_invoices_select on public.subscription_invoices is
  'A tenant reads its own platform invoices but can never raise or edit one.';

-- The platform numbering series is never exposed to a tenant.
create policy platform_invoice_counters_select on public.platform_invoice_counters
  for select to authenticated
  using (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- Coupons
-- -----------------------------------------------------------------------------

-- A code is validated through a security definer function, so the table itself
-- stays closed to everyone except the platform team and the owning partner.
create policy coupons_select on public.coupons
  for select to authenticated
  using (
    deleted_at is null
    and (
      public.is_super_admin()
      or (affiliate_id is not null and exists (
            select 1
              from public.affiliates as a
             where a.id = coupons.affiliate_id
               and a.user_id = public.current_user_id()
          ))
    )
  );

create policy coupons_insert on public.coupons
  for insert to authenticated
  with check (public.is_super_admin());

create policy coupons_update on public.coupons
  for update to authenticated
  using (deleted_at is null and public.is_super_admin())
  with check (public.is_super_admin());

create policy coupon_redemptions_select on public.coupon_redemptions
  for select to authenticated
  using (public.is_super_admin() or public.has_company_access(company_id));

create policy coupon_redemptions_insert on public.coupon_redemptions
  for insert to authenticated
  with check (public.is_super_admin() or public.is_company_owner(company_id));

-- -----------------------------------------------------------------------------
-- Entitlements and usage
-- -----------------------------------------------------------------------------

-- An override is granted by the platform team, and the tenant may read what it
-- was given so the interface can explain the raised limit.
create policy entitlement_overrides_select on public.company_entitlement_overrides
  for select to authenticated
  using (deleted_at is null and public.has_company_access(company_id));

create policy entitlement_overrides_insert on public.company_entitlement_overrides
  for insert to authenticated
  with check (public.is_super_admin());

create policy entitlement_overrides_update on public.company_entitlement_overrides
  for update to authenticated
  using (deleted_at is null and public.is_super_admin())
  with check (public.is_super_admin());

create policy usage_counters_select on public.usage_counters
  for select to authenticated
  using (public.has_company_access(company_id));

create policy usage_events_select on public.usage_events
  for select to authenticated
  using (public.has_company_access(company_id));

-- -----------------------------------------------------------------------------
-- Referral programme
-- -----------------------------------------------------------------------------

create policy affiliates_select on public.affiliates
  for select to authenticated
  using (deleted_at is null and (public.is_super_admin() or user_id = public.current_user_id()));

create policy affiliates_insert on public.affiliates
  for insert to authenticated
  with check (public.is_super_admin() or user_id = public.current_user_id());

-- A partner edits its own profile; only the platform team may change the
-- commercial terms, which the grant file enforces column by column.
create policy affiliates_update on public.affiliates
  for update to authenticated
  using (deleted_at is null and (public.is_super_admin() or user_id = public.current_user_id()))
  with check (public.is_super_admin() or user_id = public.current_user_id());

comment on policy affiliates_select on public.affiliates is
  'A partner sees only its own programme record.';

create policy affiliate_links_select on public.affiliate_links
  for select to authenticated
  using (deleted_at is null and public.is_own_affiliate(affiliate_id));

create policy affiliate_links_insert on public.affiliate_links
  for insert to authenticated
  with check (public.is_own_affiliate(affiliate_id));

create policy affiliate_links_update on public.affiliate_links
  for update to authenticated
  using (deleted_at is null and public.is_own_affiliate(affiliate_id))
  with check (public.is_own_affiliate(affiliate_id));

create policy affiliate_clicks_select on public.affiliate_clicks
  for select to authenticated
  using (public.is_own_affiliate(affiliate_id));

-- The referred company identifier is deliberately withheld from the partner;
-- the application reads this table through a view that drops that column.
create policy affiliate_referrals_select on public.affiliate_referrals
  for select to authenticated
  using (public.is_super_admin());

create policy affiliate_commissions_select on public.affiliate_commissions
  for select to authenticated
  using (public.is_own_affiliate(affiliate_id));

comment on policy affiliate_commissions_select on public.affiliate_commissions is
  'A partner sees what it earned, never which tenant generated the payment.';

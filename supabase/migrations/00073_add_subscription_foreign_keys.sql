-- supabase/migrations/00073_add_subscription_foreign_keys.sql
-- Relationships for plans, subscriptions, coupons, usage and the referral
-- programme.
--
-- Billing history is never cascaded away. A closed account keeps its invoices
-- and its commission record, because both are needed long after the tenant
-- has gone.

-- Plans and prices ------------------------------------------------------------

alter table public.subscription_plans
  add constraint subscription_plans_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.subscription_plans
  add constraint subscription_plans_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.plan_prices
  add constraint plan_prices_plan_fkey
  foreign key (plan_id) references public.subscription_plans (id) on delete cascade;

alter table public.plan_prices
  add constraint plan_prices_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.plan_prices
  add constraint plan_prices_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

-- Subscriptions ---------------------------------------------------------------

alter table public.subscriptions
  add constraint subscriptions_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.subscriptions
  add constraint subscriptions_plan_fkey
  foreign key (plan_id) references public.subscription_plans (id) on delete restrict;

alter table public.subscriptions
  add constraint subscriptions_plan_price_fkey
  foreign key (plan_price_id) references public.plan_prices (id) on delete set null;

alter table public.subscriptions
  add constraint subscriptions_payment_method_fkey
  foreign key (client_payment_method_id)
  references public.client_payment_methods (id) on delete set null;

alter table public.subscriptions
  add constraint subscriptions_coupon_fkey
  foreign key (coupon_id) references public.coupons (id) on delete set null;

alter table public.subscriptions
  add constraint subscriptions_reseller_fkey
  foreign key (reseller_id) references public.resellers (id) on delete set null;

alter table public.subscriptions
  add constraint subscriptions_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.subscriptions
  add constraint subscriptions_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.subscription_changes
  add constraint subscription_changes_subscription_fkey
  foreign key (subscription_id) references public.subscriptions (id) on delete cascade;

alter table public.subscription_changes
  add constraint subscription_changes_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.subscription_changes
  add constraint subscription_changes_from_plan_fkey
  foreign key (from_plan_id) references public.subscription_plans (id) on delete set null;

alter table public.subscription_changes
  add constraint subscription_changes_to_plan_fkey
  foreign key (to_plan_id) references public.subscription_plans (id) on delete set null;

alter table public.subscription_changes
  add constraint subscription_changes_changed_by_fkey
  foreign key (changed_by) references public.users (id) on delete set null;

alter table public.subscription_invoices
  add constraint subscription_invoices_company_fkey
  foreign key (company_id) references public.companies (id) on delete restrict;

alter table public.subscription_invoices
  add constraint subscription_invoices_subscription_fkey
  foreign key (subscription_id) references public.subscriptions (id) on delete set null;

alter table public.subscription_invoices
  add constraint subscription_invoices_payment_fkey
  foreign key (payment_id) references public.payments (id) on delete set null;

alter table public.subscription_invoices
  add constraint subscription_invoices_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.subscription_invoices
  add constraint subscription_invoices_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

-- Coupons ---------------------------------------------------------------------

alter table public.coupons
  add constraint coupons_reseller_fkey
  foreign key (reseller_id) references public.resellers (id) on delete set null;

alter table public.coupons
  add constraint coupons_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.coupons
  add constraint coupons_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.coupon_redemptions
  add constraint coupon_redemptions_coupon_fkey
  foreign key (coupon_id) references public.coupons (id) on delete cascade;

alter table public.coupon_redemptions
  add constraint coupon_redemptions_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.coupon_redemptions
  add constraint coupon_redemptions_user_fkey
  foreign key (user_id) references public.users (id) on delete set null;

alter table public.coupon_redemptions
  add constraint coupon_redemptions_subscription_fkey
  foreign key (subscription_id) references public.subscriptions (id) on delete set null;

alter table public.coupon_redemptions
  add constraint coupon_redemptions_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

-- Entitlements and usage ------------------------------------------------------

alter table public.company_entitlement_overrides
  add constraint entitlement_overrides_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.company_entitlement_overrides
  add constraint entitlement_overrides_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.company_entitlement_overrides
  add constraint entitlement_overrides_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.usage_counters
  add constraint usage_counters_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.usage_events
  add constraint usage_events_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.usage_events
  add constraint usage_events_actor_fkey
  foreign key (actor_id) references public.users (id) on delete set null;

-- Referral programme ----------------------------------------------------------

alter table public.affiliates
  add constraint affiliates_user_fkey
  foreign key (user_id) references public.users (id) on delete cascade;

alter table public.affiliates
  add constraint affiliates_approved_by_fkey
  foreign key (approved_by) references public.users (id) on delete set null;

alter table public.affiliates
  add constraint affiliates_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.affiliates
  add constraint affiliates_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.coupons
  add constraint coupons_affiliate_fkey
  foreign key (affiliate_id) references public.affiliates (id) on delete set null;

alter table public.subscriptions
  add constraint subscriptions_affiliate_fkey
  foreign key (affiliate_id) references public.affiliates (id) on delete set null;

alter table public.affiliate_links
  add constraint affiliate_links_affiliate_fkey
  foreign key (affiliate_id) references public.affiliates (id) on delete cascade;

alter table public.affiliate_clicks
  add constraint affiliate_clicks_affiliate_fkey
  foreign key (affiliate_id) references public.affiliates (id) on delete cascade;

alter table public.affiliate_referrals
  add constraint affiliate_referrals_affiliate_fkey
  foreign key (affiliate_id) references public.affiliates (id) on delete cascade;

alter table public.affiliate_referrals
  add constraint affiliate_referrals_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.affiliate_referrals
  add constraint affiliate_referrals_click_fkey
  foreign key (click_id) references public.affiliate_clicks (id) on delete set null;

alter table public.affiliate_commissions
  add constraint affiliate_commissions_affiliate_fkey
  foreign key (affiliate_id) references public.affiliates (id) on delete restrict;

alter table public.affiliate_commissions
  add constraint affiliate_commissions_referral_fkey
  foreign key (referral_id) references public.affiliate_referrals (id) on delete restrict;

alter table public.affiliate_commissions
  add constraint affiliate_commissions_company_fkey
  foreign key (company_id) references public.companies (id) on delete restrict;

alter table public.affiliate_commissions
  add constraint affiliate_commissions_invoice_fkey
  foreign key (subscription_invoice_id)
  references public.subscription_invoices (id) on delete set null;

alter table public.affiliate_commissions
  add constraint affiliate_commissions_wallet_transaction_fkey
  foreign key (wallet_transaction_id)
  references public.wallet_transactions (id) on delete set null;

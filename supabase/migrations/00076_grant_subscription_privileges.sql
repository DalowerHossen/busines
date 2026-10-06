-- supabase/migrations/00076_grant_subscription_privileges.sql
-- Table, column and routine privileges for the subscription and referral
-- modules.
--
-- Commissions are granted column by column. The underlying row carries the
-- tenant that generated the payment, and a partner must never learn who that
-- tenant is, so the column simply is not readable by them.

grant select on public.subscription_plans to anon, authenticated;
grant select on public.plan_prices to anon, authenticated;
grant insert, update on public.subscription_plans to authenticated;
grant insert, update on public.plan_prices to authenticated;

grant select, insert, update on public.subscriptions to authenticated;
grant select, insert on public.subscription_changes to authenticated;
grant select, insert, update on public.subscription_invoices to authenticated;

grant select, insert, update on public.coupons to authenticated;
grant select, insert on public.coupon_redemptions to authenticated;

grant select, insert, update on public.company_entitlement_overrides to authenticated;
grant select on public.usage_counters to authenticated;
grant select on public.usage_events to authenticated;

grant select, insert, update on public.affiliates to authenticated;
grant select, insert, update on public.affiliate_links to authenticated;
grant select on public.affiliate_clicks to authenticated;

grant select (
  id, affiliate_id, amount, currency, commission_percentage, base_amount,
  period_start, period_end, status, available_on, approved_at, reversed_at,
  reversal_reason, created_at, updated_at
) on public.affiliate_commissions to authenticated;

comment on column public.affiliate_commissions.company_id is
  'Withheld from the partner by column level privileges; platform use only.';

-- -----------------------------------------------------------------------------
-- Routines the application may call
-- -----------------------------------------------------------------------------

grant execute on function public.plan_entitlements(uuid) to anon, authenticated;
grant execute on function public.company_entitlements(uuid) to authenticated;
grant execute on function public.has_feature(uuid, text) to authenticated;
grant execute on function public.usage_limit(uuid, text) to authenticated;

grant execute on function public.usage_period_key(text, date) to authenticated;
grant execute on function public.check_usage_limit(uuid, text, bigint) to authenticated;
grant execute on function public.consume_usage(uuid, text, bigint, text, uuid)
  to authenticated;
grant execute on function public.release_usage(uuid, text, bigint) to authenticated;
grant execute on function public.sync_storage_usage(uuid) to authenticated;

grant execute on function public.validate_coupon(text, uuid, text, numeric)
  to authenticated;
grant execute on function public.redeem_coupon(text, uuid, uuid, numeric)
  to authenticated;

grant execute on function public.change_subscription_plan(
  uuid, uuid, public.billing_interval, text
) to authenticated;
grant execute on function public.cancel_subscription(uuid, boolean, text)
  to authenticated;

grant execute on function public.is_own_affiliate(uuid) to authenticated;
grant execute on function public.record_affiliate_click(
  text, text, text, text, text, text, text, text, text
) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Reserved for the trusted server layer and the scheduled jobs
-- -----------------------------------------------------------------------------

revoke all on function public.start_default_subscription(uuid) from anon, authenticated;
revoke all on function public.process_expired_trials() from anon, authenticated;
revoke all on function public.process_scheduled_cancellations() from anon, authenticated;
revoke all on function public.next_platform_invoice_number(date) from anon, authenticated;
revoke all on function public.create_subscription_invoice(uuid, date)
  from anon, authenticated;
revoke all on function public.settle_subscription_invoice(uuid, numeric, uuid)
  from anon, authenticated;
revoke all on function public.run_subscription_renewals(integer) from anon, authenticated;
revoke all on function public.run_subscription_dunning(integer) from anon, authenticated;
revoke all on function public.record_affiliate_commission(uuid) from anon, authenticated;
revoke all on function public.release_due_commissions() from anon, authenticated;
revoke all on function public.attribute_affiliate_signup(uuid, text, text)
  from anon, authenticated;
revoke all on function public.deactivate_affiliate_referral(uuid, text)
  from anon, authenticated;
revoke all on function public.reverse_affiliate_commission(uuid, text)
  from anon, authenticated;

revoke all on public.platform_invoice_counters from anon, authenticated;
revoke all on public.affiliate_referrals from anon, authenticated;

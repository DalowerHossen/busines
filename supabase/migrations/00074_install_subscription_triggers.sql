-- supabase/migrations/00074_install_subscription_triggers.sql
-- Standard triggers, audit coverage and the guards that keep plan data honest.

select public.install_standard_triggers('subscription_plans');
select public.install_standard_triggers('plan_prices');
select public.install_standard_triggers('subscriptions');
select public.install_standard_triggers('subscription_invoices');
select public.install_standard_triggers('coupons');
select public.install_standard_triggers('company_entitlement_overrides');
select public.install_standard_triggers('affiliates');
select public.install_standard_triggers('affiliate_links');

select public.install_timestamp_trigger('coupon_redemptions');
select public.install_timestamp_trigger('usage_counters');
select public.install_timestamp_trigger('affiliate_referrals');
select public.install_timestamp_trigger('affiliate_commissions');
select public.install_timestamp_trigger('platform_invoice_counters');

-- Everything that decides what a tenant may do, or what it owes, is audited.
select public.install_audit_trigger('subscription_plans');
select public.install_audit_trigger('plan_prices');
select public.install_audit_trigger('subscriptions');
select public.install_audit_trigger('subscription_invoices');
select public.install_audit_trigger('coupons');
select public.install_audit_trigger('company_entitlement_overrides');
select public.install_audit_trigger('affiliates');
select public.install_audit_trigger('affiliate_commissions');

-- -----------------------------------------------------------------------------
-- Plan guards
-- -----------------------------------------------------------------------------

-- Keeps exactly one signup plan, and keeps it free of charge.
create or replace function public.guard_signup_plan()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_default_on_signup then
    if new.is_archived then
      raise exception 'An archived plan cannot be the signup plan'
        using errcode = '22023';
    end if;

    update public.subscription_plans
       set is_default_on_signup = false,
           updated_at = now()
     where id <> new.id
       and is_default_on_signup
       and deleted_at is null;
  end if;

  return new;
end;
$$;

comment on function public.guard_signup_plan() is
  'Keeps a single plan marked as the one new accounts start on.';

create trigger subscription_plans_10_signup_guard
  before insert or update of is_default_on_signup, is_archived
  on public.subscription_plans
  for each row execute function public.guard_signup_plan();

-- A plan that tenants are still on cannot be removed from under them.
create or replace function public.guard_plan_in_use()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    if exists (
      select 1
        from public.subscriptions
       where plan_id = new.id
         and deleted_at is null
         and status not in ('cancelled', 'expired')
    ) then
      raise exception 'This plan still has active subscribers and cannot be removed'
        using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.guard_plan_in_use() is
  'Blocks the removal of a plan that companies are still subscribed to.';

create trigger subscription_plans_20_in_use_guard
  before update of deleted_at on public.subscription_plans
  for each row execute function public.guard_plan_in_use();

-- -----------------------------------------------------------------------------
-- Subscription guards
-- -----------------------------------------------------------------------------

-- Keeps the cached amount in step with the price that was chosen.
create or replace function public.sync_subscription_amount()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_price public.plan_prices%rowtype;
begin
  if new.plan_price_id is null then
    return new;
  end if;

  select * into v_price from public.plan_prices where id = new.plan_price_id;

  if found then
    if v_price.plan_id <> new.plan_id then
      raise exception 'The chosen price belongs to a different plan'
        using errcode = '22023';
    end if;

    new.currency := v_price.currency;
    new.billing_interval := v_price.billing_interval;

    if tg_op = 'INSERT' or new.amount is null then
      new.amount := v_price.amount;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.sync_subscription_amount() is
  'Copies currency and interval from the chosen price onto the subscription.';

create trigger subscriptions_10_price_sync
  before insert or update of plan_price_id, plan_id
  on public.subscriptions
  for each row execute function public.sync_subscription_amount();

-- A platform invoice is a financial record, so its figures are frozen once it
-- has been paid.
create or replace function public.guard_paid_subscription_invoice()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'paid'
     and (new.total_amount is distinct from old.total_amount
          or new.subtotal_amount is distinct from old.subtotal_amount
          or new.tax_amount is distinct from old.tax_amount
          or new.invoice_number is distinct from old.invoice_number
          or new.line_items is distinct from old.line_items) then
    raise exception 'A paid platform invoice can no longer be altered'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_paid_subscription_invoice() is
  'Freezes the figures on a platform invoice once it has been paid.';

create trigger subscription_invoices_10_paid_guard
  before update on public.subscription_invoices
  for each row execute function public.guard_paid_subscription_invoice();

-- -----------------------------------------------------------------------------
-- Referral guards
-- -----------------------------------------------------------------------------

-- Normalises the referral code and only lets an approved partner earn.
create or replace function public.normalise_affiliate_record()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.referral_code := lower(btrim(new.referral_code));

  if new.status = 'approved' and new.approved_at is null then
    new.approved_at := now();
  end if;

  if new.status = 'suspended' and new.suspended_at is null then
    new.suspended_at := now();
  end if;

  return new;
end;
$$;

comment on function public.normalise_affiliate_record() is
  'Lower cases the referral code and stamps the approval and suspension dates.';

create trigger affiliates_10_normalise
  before insert or update on public.affiliates
  for each row execute function public.normalise_affiliate_record();

-- A commission that has already been paid out cannot be edited away.
create or replace function public.guard_paid_commission()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'approved'
     and new.status = 'approved'
     and new.amount is distinct from old.amount then
    raise exception 'An approved commission can no longer be re priced'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_paid_commission() is
  'Stops the amount of an approved commission from being changed.';

create trigger affiliate_commissions_10_amount_guard
  before update on public.affiliate_commissions
  for each row execute function public.guard_paid_commission();

-- Clicks are measurement data and are never rewritten.
create trigger affiliate_clicks_append_only
  before delete on public.affiliate_clicks
  for each row execute function public.block_audit_mutation();

-- supabase/migrations/00066_create_coupons.sql
-- Coupons and their redemptions.
--
-- A coupon can be limited globally, limited per account, restricted to certain
-- plans and given a validity window. Every redemption is recorded, which is
-- what makes the one per account rule and the abuse checks possible.

create table public.coupons (
  id uuid primary key default public.generate_uuid_v7(),

  code citext not null,
  name text not null,
  description text,

  coupon_type public.coupon_type not null default 'percentage',
  -- Percentage, fixed amount, or extra trial days depending on the type.
  value numeric(18, 4) not null,
  currency char(3),

  -- How long the discount keeps applying after it is redeemed.
  duration_months smallint,
  applies_to_first_payment_only boolean not null default false,

  max_redemptions integer,
  max_redemptions_per_account smallint not null default 1,
  redemption_count integer not null default 0,

  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  is_active boolean not null default true,

  -- Empty means every plan.
  allowed_plan_keys text[] not null default array[]::text[],
  minimum_amount numeric(18, 4),

  -- Set when the coupon belongs to a partner or an affiliate campaign.
  affiliate_id uuid,
  reseller_id uuid,
  campaign_name text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint coupons_code_check
    check (code ~ '^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$'),
  constraint coupons_name_check
    check (length(btrim(name)) between 1 and 80),
  constraint coupons_value_check
    check (value > 0),
  constraint coupons_percentage_check
    check (coupon_type <> 'percentage' or value <= 100),
  constraint coupons_currency_check
    check (coupon_type <> 'fixed_amount' or currency ~ '^[A-Z]{3}$'),
  constraint coupons_duration_check
    check (duration_months is null or duration_months between 1 and 120),
  constraint coupons_redemption_limits_check
    check ((max_redemptions is null or max_redemptions > 0)
           and max_redemptions_per_account between 1 and 10),
  constraint coupons_window_check
    check (valid_until is null or valid_until > valid_from)
);

comment on table public.coupons is
  'Discount codes for platform plans, with their limits and validity window.';

create unique index coupons_code_unique
  on public.coupons (code)
  where deleted_at is null;

create index coupons_active_idx
  on public.coupons (valid_until)
  where is_active and deleted_at is null;

create index coupons_affiliate_idx
  on public.coupons (affiliate_id)
  where affiliate_id is not null and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Redemptions
-- -----------------------------------------------------------------------------

create table public.coupon_redemptions (
  id uuid primary key default public.generate_uuid_v7(),
  coupon_id uuid not null,
  company_id uuid not null,
  user_id uuid,
  subscription_id uuid,

  discount_amount numeric(18, 4) not null default 0,
  currency char(3),
  applied_at timestamptz not null default now(),
  expires_at timestamptz,
  reverted_at timestamptz,
  revert_reason text,

  -- Signals used by the abuse checks.
  ip_address inet,
  device_fingerprint text,

  created_at timestamptz not null default now(),
  created_by uuid,

  constraint coupon_redemptions_amount_check
    check (discount_amount >= 0)
);

comment on table public.coupon_redemptions is
  'Every use of a coupon, which enforces the per account limit.';

create unique index coupon_redemptions_company_unique
  on public.coupon_redemptions (coupon_id, company_id)
  where reverted_at is null;

create index coupon_redemptions_coupon_idx
  on public.coupon_redemptions (coupon_id, applied_at desc);

create index coupon_redemptions_company_idx
  on public.coupon_redemptions (company_id, applied_at desc);

-- Reports whether a coupon can be used by a company right now, and why not
-- when it cannot. The reason is shown to the user, so it is written as a
-- sentence rather than a code.
create or replace function public.validate_coupon(
  p_code text,
  p_company_id uuid,
  p_plan_key text default null,
  p_amount numeric default null
)
returns table (is_valid boolean, coupon_id uuid, reason text, discount_amount numeric)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_coupon public.coupons%rowtype;
  v_used integer;
  v_discount numeric := 0;
begin
  select * into v_coupon
    from public.coupons
   where code = p_code::citext
     and deleted_at is null;

  if not found then
    return query select false, null::uuid, 'This code was not recognised', 0::numeric;
    return;
  end if;

  if not v_coupon.is_active then
    return query select false, v_coupon.id, 'This code is no longer active', 0::numeric;
    return;
  end if;

  if v_coupon.valid_from > now() then
    return query select false, v_coupon.id, 'This code is not active yet', 0::numeric;
    return;
  end if;

  if v_coupon.valid_until is not null and v_coupon.valid_until <= now() then
    return query select false, v_coupon.id, 'This code has expired', 0::numeric;
    return;
  end if;

  if v_coupon.max_redemptions is not null
     and v_coupon.redemption_count >= v_coupon.max_redemptions then
    return query select false, v_coupon.id, 'This code has been fully claimed', 0::numeric;
    return;
  end if;

  select count(*)
    into v_used
    from public.coupon_redemptions as cr
   where cr.coupon_id = v_coupon.id
     and cr.company_id = p_company_id
     and cr.reverted_at is null;

  if v_used >= v_coupon.max_redemptions_per_account then
    return query select false, v_coupon.id,
                        'This code has already been used on this account', 0::numeric;
    return;
  end if;

  if array_length(v_coupon.allowed_plan_keys, 1) is not null
     and p_plan_key is not null
     and not (p_plan_key = any (v_coupon.allowed_plan_keys)) then
    return query select false, v_coupon.id,
                        'This code does not apply to the selected plan', 0::numeric;
    return;
  end if;

  if v_coupon.minimum_amount is not null
     and coalesce(p_amount, 0) < v_coupon.minimum_amount then
    return query select false, v_coupon.id,
                        'This code needs a larger order to apply', 0::numeric;
    return;
  end if;

  if p_amount is not null then
    if v_coupon.coupon_type = 'percentage' then
      v_discount := round(p_amount * v_coupon.value / 100, 4);
    elsif v_coupon.coupon_type = 'fixed_amount' then
      v_discount := least(v_coupon.value, p_amount);
    end if;
  end if;

  return query select true, v_coupon.id, 'This code is valid', v_discount;
end;
$$;

comment on function public.validate_coupon(text, uuid, text, numeric) is
  'Checks a coupon against every limit and returns the discount it would give.';

-- Records a redemption and moves the counter, refusing anything the validator
-- would have rejected.
create or replace function public.redeem_coupon(
  p_code text,
  p_company_id uuid,
  p_subscription_id uuid default null,
  p_amount numeric default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_check record;
  v_redemption_id uuid;
  v_duration smallint;
begin
  select * into v_check
    from public.validate_coupon(
      p_code,
      p_company_id,
      (select p.plan_key
         from public.subscriptions as s
         join public.subscription_plans as p on p.id = s.plan_id
        where s.id = p_subscription_id),
      p_amount
    );

  if not v_check.is_valid then
    raise exception '%', v_check.reason using errcode = '22023';
  end if;

  select duration_months into v_duration from public.coupons where id = v_check.coupon_id;

  insert into public.coupon_redemptions (
    coupon_id, company_id, user_id, subscription_id, discount_amount, expires_at
  )
  values (
    v_check.coupon_id, p_company_id, public.current_user_id(), p_subscription_id,
    v_check.discount_amount,
    case when v_duration is not null
         then now() + make_interval(months => v_duration)
         else null
    end
  )
  returning id into v_redemption_id;

  update public.coupons
     set redemption_count = redemption_count + 1,
         updated_at = now()
   where id = v_check.coupon_id;

  if p_subscription_id is not null then
    update public.subscriptions
       set coupon_id = v_check.coupon_id,
           discount_amount = v_check.discount_amount,
           updated_at = now()
     where id = p_subscription_id;
  end if;

  return v_redemption_id;
end;
$$;

comment on function public.redeem_coupon(text, uuid, uuid, numeric) is
  'Applies a coupon to a subscription once every limit has been checked.';

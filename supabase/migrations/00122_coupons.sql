-- supabase/migrations/00122_coupons.sql
-- Platform coupon definitions. Coupon redemption limits are enforced by
-- coupon_redemptions and application transactions, not by client-side code.

create table public.coupons (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null,
  display_name text not null,
  description text null,
  discount_type coupon_discount_type not null,
  discount_value numeric(18, 4) not null,
  currency_code text not null default 'USD',
  status coupon_status not null default 'draft',
  applicable_plan_id uuid null references public.plans (id),
  max_redemptions integer null,
  max_redemptions_per_company integer null,
  redemption_count integer not null default 0,
  valid_from timestamptz null,
  valid_until timestamptz null,
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint coupons_code_not_blank check (length(btrim(code)) > 0),
  constraint coupons_display_name_not_blank check (length(btrim(display_name)) > 0),
  constraint coupons_discount_value_valid check (
    (discount_type = 'percentage' and discount_value > 0 and discount_value <= 100)
    or (discount_type = 'fixed_amount' and discount_value > 0)
  ),
  constraint coupons_redemption_limits_valid check (
    (max_redemptions is null or max_redemptions > 0)
    and (max_redemptions_per_company is null or max_redemptions_per_company > 0)
    and redemption_count >= 0
  ),
  constraint coupons_valid_window check (
    valid_until is null or valid_from is null or valid_until > valid_from
  )
);

create unique index coupons_code_key
  on public.coupons (lower(code))
  where deleted_at is null;
create index coupons_status_window_idx
  on public.coupons (status, valid_from, valid_until)
  where deleted_at is null;
create index coupons_plan_idx
  on public.coupons (applicable_plan_id)
  where applicable_plan_id is not null and deleted_at is null;

comment on table public.coupons is
  'A platform-managed subscription coupon with bounded discount and redemption rules.';

-- supabase/migrations/00123_coupon_redemptions.sql
-- One immutable redemption record per company and coupon. The discount is
-- snapshotted so later coupon edits cannot alter billing history.

create table public.coupon_redemptions (
  id uuid primary key default extensions.gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id),
  company_id uuid not null references public.companies (id),
  subscription_id uuid not null references public.subscriptions (id),
  redeemed_by_user_id uuid not null references public.users (id),
  discount_type coupon_discount_type not null,
  discount_value numeric(18, 4) not null,
  applied_amount numeric(18, 4) not null,
  currency_code text not null default 'USD',
  redeemed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint coupon_redemptions_values_valid check (
    discount_value > 0 and applied_amount >= 0
  )
);

create unique index coupon_redemptions_coupon_company_key
  on public.coupon_redemptions (coupon_id, company_id);
create index coupon_redemptions_company_idx
  on public.coupon_redemptions (company_id, redeemed_at desc);
create index coupon_redemptions_subscription_idx
  on public.coupon_redemptions (subscription_id);

comment on table public.coupon_redemptions is
  'A company coupon redemption and immutable applied-discount snapshot.';

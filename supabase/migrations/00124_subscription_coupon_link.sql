-- supabase/migrations/00124_subscription_coupon_link.sql
-- Link the subscription history to the coupon used for that billing period.
-- coupon_code_snapshot preserves the visible code even if the coupon is later
-- archived or edited.

alter table public.subscriptions
  add column coupon_id uuid null references public.coupons (id),
  add column coupon_code_snapshot text null;

alter table public.subscriptions
  add constraint subscriptions_coupon_code_snapshot_not_blank check (
    coupon_code_snapshot is null or length(btrim(coupon_code_snapshot)) > 0
  );

create index subscriptions_coupon_id_idx
  on public.subscriptions (coupon_id)
  where coupon_id is not null;

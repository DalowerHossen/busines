-- supabase/migrations/00118_affiliate_profiles.sql
-- Blind affiliate profile. Affiliates receive only their own referral,
-- commission, and payout statistics.

create table public.affiliate_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  affiliate_user_id uuid not null references public.users (id),
  status affiliate_status not null default 'pending',
  affiliate_code text not null,
  commission_percent numeric(7, 4) not null default 0,
  minimum_payout_amount numeric(18, 4) not null default 0,
  payout_currency_code text not null default 'USD',
  approved_by_user_id uuid null references public.users (id),
  approved_at timestamptz null,
  suspended_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint affiliate_profiles_code_not_blank check (length(btrim(affiliate_code)) > 0),
  constraint affiliate_profiles_commission_valid check (commission_percent between 0 and 100),
  constraint affiliate_profiles_minimum_payout_non_negative check (minimum_payout_amount >= 0)
);

create unique index affiliate_profiles_user_key
  on public.affiliate_profiles (affiliate_user_id)
  where deleted_at is null;
create unique index affiliate_profiles_code_key
  on public.affiliate_profiles (lower(affiliate_code))
  where deleted_at is null;
create index affiliate_profiles_status_idx
  on public.affiliate_profiles (status)
  where deleted_at is null;

comment on table public.affiliate_profiles is
  'A platform-level affiliate profile. Referral data is blind to referred company and client records.';

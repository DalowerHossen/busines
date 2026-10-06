-- supabase/migrations/00120_affiliate_commissions.sql
-- Commission entries are immutable financial snapshots of an eligible
-- referral event. Reversals are represented by a new status or compensating
-- entry in later application logic.

create table public.affiliate_commissions (
  id uuid primary key default extensions.gen_random_uuid(),
  affiliate_profile_id uuid not null references public.affiliate_profiles (id),
  referral_id uuid not null references public.affiliate_referrals (id),
  referred_company_id uuid not null references public.companies (id),
  subscription_id uuid null references public.subscriptions (id),
  source_reference text not null,
  currency_code text not null default 'USD',
  source_amount numeric(18, 4) not null,
  commission_percent numeric(7, 4) not null,
  commission_amount numeric(18, 4) not null,
  status affiliate_commission_status not null default 'pending',
  available_at timestamptz null,
  paid_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint affiliate_commissions_source_reference_not_blank check (
    length(btrim(source_reference)) > 0
  ),
  constraint affiliate_commissions_amounts_valid check (
    source_amount >= 0 and commission_percent between 0 and 100 and commission_amount >= 0
  ),
  constraint affiliate_commissions_paid_at_valid check (
    (status = 'paid' and paid_at is not null) or status <> 'paid'
  )
);

create unique index affiliate_commissions_source_reference_key
  on public.affiliate_commissions (affiliate_profile_id, source_reference);
create index affiliate_commissions_affiliate_status_idx
  on public.affiliate_commissions (affiliate_profile_id, status, created_at desc);
create index affiliate_commissions_company_idx
  on public.affiliate_commissions (referred_company_id, created_at desc);

comment on table public.affiliate_commissions is
  'A commission snapshot for an affiliate referral event, visible to the affiliate only through scoped aggregates.';

-- supabase/migrations/00119_affiliate_tracking.sql
-- Referral clicks and attributed signups. Raw IP addresses are not stored;
-- only application-generated hashes may be retained for fraud controls.

create table public.affiliate_clicks (
  id uuid primary key default extensions.gen_random_uuid(),
  affiliate_profile_id uuid not null references public.affiliate_profiles (id),
  click_id text not null,
  landing_path text null,
  referrer_url text null,
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  ip_hash text null,
  user_agent_hash text null,
  clicked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index affiliate_clicks_click_id_key
  on public.affiliate_clicks (click_id);
create index affiliate_clicks_affiliate_time_idx
  on public.affiliate_clicks (affiliate_profile_id, clicked_at desc);

comment on table public.affiliate_clicks is
  'An append-only affiliate referral click record using privacy-preserving request hashes.';

create table public.affiliate_referrals (
  id uuid primary key default extensions.gen_random_uuid(),
  affiliate_profile_id uuid not null references public.affiliate_profiles (id),
  click_id uuid null references public.affiliate_clicks (id),
  referred_user_id uuid null references public.users (id),
  referred_company_id uuid null references public.companies (id),
  status affiliate_referral_status not null default 'clicked',
  registered_at timestamptz null,
  converted_at timestamptz null,
  fraud_reason text null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint affiliate_referrals_conversion_fields_valid check (
    (status = 'converted' and converted_at is not null and referred_company_id is not null)
    or status <> 'converted'
  )
);

create unique index affiliate_referrals_referred_user_key
  on public.affiliate_referrals (referred_user_id)
  where referred_user_id is not null and deleted_at is null;
create unique index affiliate_referrals_click_id_key
  on public.affiliate_referrals (click_id)
  where click_id is not null and deleted_at is null;
create index affiliate_referrals_affiliate_status_idx
  on public.affiliate_referrals (affiliate_profile_id, status, created_at desc)
  where deleted_at is null;
create index affiliate_referrals_company_idx
  on public.affiliate_referrals (referred_company_id)
  where referred_company_id is not null and deleted_at is null;

comment on table public.affiliate_referrals is
  'An attributed affiliate referral lifecycle. Affiliate-facing queries must expose only the affiliate-owned aggregate fields.';

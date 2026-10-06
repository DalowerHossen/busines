-- supabase/migrations/00168_platform_fee_card_tiers.sql
-- Configurable card-fee tiers. The platform defaults are domestic US standard
-- at 2.7% + 0.25 USD and premium/international/corporate at 3.7% + 0.25
-- USD; application code uses the database rows first so a super_admin change
-- applies automatically to the next payment in that tier.

create type platform_fee_tier as enum (
  'domestic_us_standard',
  'premium_international_corporate'
);

alter table public.platform_fee_rules
  add column card_fee_tier platform_fee_tier not null default 'domestic_us_standard';

drop index if exists platform_fee_rules_platform_name_key;
drop index if exists platform_fee_rules_company_name_key;

create unique index platform_fee_rules_platform_tier_name_key
  on public.platform_fee_rules (lower(rule_name), card_fee_tier)
  where company_id is null and deleted_at is null;
create unique index platform_fee_rules_company_tier_name_key
  on public.platform_fee_rules (company_id, lower(rule_name), card_fee_tier)
  where company_id is not null and deleted_at is null;

create index platform_fee_rules_tier_active_idx
  on public.platform_fee_rules (company_id, card_fee_tier, is_active, effective_from desc)
  where is_active = true and deleted_at is null;

comment on column public.platform_fee_rules.card_fee_tier is
  'The trusted gateway-card classification that selects this versioned fee policy. Super-admin edits apply to later payments in the same tier.';

-- supabase/migrations/00114_partner_coupon_audit_enums.sql
-- Shared enums for affiliate, reseller, accountant, coupon, and audit
-- records introduced in this migration group.

create type affiliate_status as enum (
  'pending',
  'active',
  'suspended',
  'rejected'
);

create type affiliate_referral_status as enum (
  'clicked',
  'registered',
  'converted',
  'expired',
  'fraud'
);

create type affiliate_commission_status as enum (
  'pending',
  'approved',
  'paid',
  'reversed'
);

create type affiliate_payout_status as enum (
  'requested',
  'under_review',
  'paid',
  'rejected',
  'failed',
  'cancelled'
);

create type reseller_status as enum (
  'pending',
  'active',
  'suspended',
  'terminated'
);

create type coupon_discount_type as enum (
  'percentage',
  'fixed_amount'
);

create type coupon_status as enum (
  'draft',
  'active',
  'paused',
  'expired'
);

create type audit_severity as enum (
  'info',
  'warning',
  'critical'
);

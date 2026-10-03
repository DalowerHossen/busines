-- supabase/migrations/00039_payment_enums.sql
-- Enum types shared by the payment-family tables created in this
-- migration group, mirroring src/types/payment.ts exactly.

-- Every payment gateway the platform ships an adapter for, plus the two
-- configurable local payment rails and a generic custom-gateway slot.
-- Gateway identifiers are internal/config values only and must never be
-- printed as a specific provider brand name in public-facing UI copy
-- (see docs/planning/ARCHITECTURE-DECISIONS.md section 4).
create type gateway_id as enum (
  'stripe',
  'paypal',
  'paddle',
  'nmi',
  'two_checkout',
  'adyen_for_platforms',
  'nium',
  'local_rail_1',
  'local_rail_2',
  'manual_bank_transfer',
  'custom'
);

-- Whether a payment was collected through the owner's own gateway keys
-- (the default path) or the platform's Merchant-of-Record gateway
-- (KYC-gated opt-in).
create type settlement_path as enum (
  'own_gateway',
  'platform_mor'
);

create type payment_status as enum (
  'pending',
  'authorized',
  'captured',
  'failed',
  'refunded',
  'partially_refunded',
  'disputed',
  'cancelled'
);

create type refund_status as enum (
  'pending',
  'processing',
  'succeeded',
  'failed'
);

create type chargeback_status as enum (
  'open',
  'evidence_submitted',
  'won',
  'lost'
);

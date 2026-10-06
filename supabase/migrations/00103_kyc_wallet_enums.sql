-- supabase/migrations/00103_kyc_wallet_enums.sql
-- Shared enums for manual KYC review, Merchant of Record settlement,
-- wallet accounting, holds, fees, and payout processing.

create type kyc_document_type as enum (
  'id_front',
  'id_back',
  'business_registration'
);

create type kyc_document_status as enum (
  'pending',
  'accepted',
  'rejected'
);

create type wallet_transaction_type as enum (
  'payment_capture',
  'platform_fee',
  'hold_created',
  'hold_released',
  'payout',
  'refund',
  'chargeback',
  'chargeback_reversal',
  'adjustment'
);

create type wallet_transaction_status as enum (
  'pending',
  'posted',
  'reversed',
  'failed'
);

create type payment_hold_status as enum (
  'held',
  'partially_released',
  'released',
  'cancelled'
);

create type payout_status as enum (
  'requested',
  'under_review',
  'approved',
  'processing',
  'paid',
  'rejected',
  'failed',
  'cancelled'
);

create type payout_destination_status as enum (
  'pending',
  'verified',
  'disabled'
);

create type mor_agreement_status as enum (
  'pending',
  'active',
  'suspended',
  'terminated',
  'expired'
);

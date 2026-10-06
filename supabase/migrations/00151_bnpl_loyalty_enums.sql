-- supabase/migrations/00151_bnpl_loyalty_enums.sql
-- Shared enums for installment financing and loyalty/review automation.

create type bnpl_application_status as enum (
  'pending',
  'eligible',
  'approved',
  'declined',
  'cancelled',
  'settled'
);

create type bnpl_installment_status as enum (
  'scheduled',
  'paid',
  'overdue',
  'failed',
  'cancelled'
);

create type loyalty_transaction_type as enum (
  'earned',
  'redeemed',
  'adjusted',
  'expired',
  'reversed'
);

create type review_request_status as enum (
  'queued',
  'sent',
  'clicked',
  'completed',
  'declined',
  'expired'
);

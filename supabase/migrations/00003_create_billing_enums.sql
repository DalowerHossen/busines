-- supabase/migrations/00003_create_billing_enums.sql
-- Enumerated types that describe documents, money movement and subscriptions.

create type public.document_type as enum (
  'invoice',
  'estimate',
  'credit_note',
  'debit_note',
  'proforma_invoice',
  'deposit_invoice',
  'recurring_invoice',
  'purchase_order',
  'supplier_bill',
  'delivery_note',
  'contract',
  'payment_receipt'
);

create type public.invoice_status as enum (
  'draft',
  'scheduled',
  'sent',
  'viewed',
  'partially_paid',
  'paid',
  'overdue',
  'disputed',
  'written_off',
  'cancelled'
);

create type public.estimate_status as enum (
  'draft',
  'sent',
  'viewed',
  'approved',
  'declined',
  'expired',
  'converted',
  'cancelled'
);

create type public.tax_mode as enum (
  'exclusive',
  'inclusive',
  'none'
);

create type public.discount_type as enum (
  'percentage',
  'fixed_amount'
);

create type public.discount_stage as enum (
  'before_tax',
  'after_tax'
);

create type public.rounding_mode as enum (
  'half_up',
  'half_even',
  'half_down',
  'ceiling',
  'floor'
);

create type public.recurrence_frequency as enum (
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
  'custom'
);

create type public.payment_status as enum (
  'pending',
  'requires_action',
  'authorized',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
  'partially_refunded',
  'refunded',
  'disputed',
  'charged_back'
);

create type public.payment_method_type as enum (
  'card',
  'bank_transfer',
  'mobile_money',
  'digital_wallet',
  'buy_now_pay_later',
  'cash',
  'cheque',
  'platform_wallet',
  'other'
);

create type public.gateway_provider as enum (
  'stripe',
  'paypal',
  'paddle',
  'nmi',
  'twocheckout',
  'bkash',
  'nagad',
  'manual',
  'bnpl_partner',
  'custom'
);

create type public.gateway_mode as enum (
  'test',
  'live'
);

create type public.gateway_owner_type as enum (
  'platform',
  'company'
);

create type public.refund_status as enum (
  'requested',
  'processing',
  'succeeded',
  'failed',
  'cancelled'
);

create type public.dispute_status as enum (
  'open',
  'evidence_required',
  'evidence_submitted',
  'under_review',
  'won',
  'lost',
  'withdrawn'
);

create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'paused',
  'cancelled',
  'expired'
);

create type public.billing_interval as enum (
  'monthly',
  'annual',
  'lifetime'
);

create type public.coupon_type as enum (
  'percentage',
  'fixed_amount',
  'free_trial_extension'
);

create type public.wallet_transaction_type as enum (
  'credit',
  'debit',
  'platform_fee',
  'gateway_fee',
  'hold',
  'release',
  'payout',
  'payout_reversal',
  'refund',
  'chargeback',
  'commission',
  'adjustment'
);

create type public.payout_method as enum (
  'bank_transfer',
  'bkash',
  'nagad',
  'paypal',
  'wallet_credit'
);

create type public.payout_status as enum (
  'requested',
  'under_review',
  'approved',
  'processing',
  'completed',
  'failed',
  'rejected',
  'cancelled'
);

create type public.payment_hold_status as enum (
  'held',
  'released',
  'extended',
  'forfeited'
);

create type public.kyc_status as enum (
  'not_started',
  'in_progress',
  'submitted',
  'under_review',
  'verified',
  'rejected',
  'expired'
);

create type public.risk_level as enum (
  'low',
  'medium',
  'high',
  'critical'
);

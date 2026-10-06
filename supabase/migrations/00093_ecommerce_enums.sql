-- supabase/migrations/00093_ecommerce_enums.sql
-- Shared enums for store connections, order synchronisation, and the
-- hosted direct-checkout bridge.

create type ecommerce_platform as enum (
  'shopify',
  'woocommerce'
);

create type ecommerce_connection_status as enum (
  'pending',
  'connected',
  'error',
  'disabled',
  'disconnected'
);

create type ecommerce_order_status as enum (
  'pending',
  'paid',
  'fulfilled',
  'cancelled',
  'refunded',
  'failed'
);

create type ecommerce_sync_status as enum (
  'queued',
  'processing',
  'succeeded',
  'failed',
  'retrying'
);

create type ecommerce_webhook_status as enum (
  'received',
  'processing',
  'processed',
  'failed',
  'ignored'
);

create type direct_checkout_environment as enum (
  'sandbox',
  'live'
);

create type direct_checkout_key_status as enum (
  'active',
  'revoked',
  'expired'
);

create type direct_checkout_session_status as enum (
  'created',
  'pending_payment',
  'paid',
  'failed',
  'expired',
  'cancelled'
);

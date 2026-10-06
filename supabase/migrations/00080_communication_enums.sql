-- supabase/migrations/00080_communication_enums.sql
-- Shared communication enums. Provider credentials remain encrypted in
-- trusted server code; these values describe routing and delivery state only.

create type communication_channel as enum (
  'in_app',
  'email',
  'whatsapp',
  'sms',
  'telegram',
  'viber'
);

create type channel_connection_status as enum (
  'pending',
  'connected',
  'error',
  'disabled'
);

create type message_direction as enum (
  'outbound',
  'inbound'
);

create type message_status as enum (
  'queued',
  'sending',
  'sent',
  'delivered',
  'read',
  'failed',
  'cancelled'
);

create type notification_type as enum (
  'invoice_viewed',
  'invoice_paid',
  'invoice_overdue',
  'payment_failed',
  'estimate_approved',
  'estimate_declined',
  'staff_invited',
  'kyc_status_changed',
  'payout_processed',
  'low_stock_alert',
  'subscription_renewal_due',
  'system_announcement'
);

create type whatsapp_template_category as enum (
  'authentication',
  'marketing',
  'utility'
);

create type whatsapp_template_status as enum (
  'draft',
  'pending',
  'approved',
  'rejected',
  'disabled'
);

create type communication_campaign_status as enum (
  'draft',
  'scheduled',
  'running',
  'paused',
  'completed',
  'cancelled'
);

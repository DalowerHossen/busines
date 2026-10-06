-- supabase/migrations/00004_create_operations_enums.sql
-- Enumerated types that describe operations, communication and platform jobs.

create type public.account_type as enum (
  'asset',
  'liability',
  'equity',
  'income',
  'expense'
);

create type public.journal_entry_status as enum (
  'draft',
  'posted',
  'reversed'
);

create type public.expense_status as enum (
  'draft',
  'submitted',
  'approved',
  'rejected',
  'reimbursed'
);

create type public.stock_movement_type as enum (
  'opening_balance',
  'purchase',
  'sale',
  'sales_return',
  'purchase_return',
  'transfer_in',
  'transfer_out',
  'adjustment_increase',
  'adjustment_decrease',
  'damage',
  'write_off'
);

create type public.purchase_order_status as enum (
  'draft',
  'sent',
  'confirmed',
  'partially_received',
  'received',
  'billed',
  'cancelled'
);

create type public.project_status as enum (
  'planning',
  'active',
  'on_hold',
  'completed',
  'cancelled'
);

create type public.time_entry_status as enum (
  'running',
  'draft',
  'submitted',
  'approved',
  'rejected',
  'invoiced'
);

create type public.contract_status as enum (
  'draft',
  'sent',
  'partially_signed',
  'signed',
  'declined',
  'expired',
  'cancelled'
);

create type public.message_channel as enum (
  'email',
  'whatsapp',
  'sms',
  'telegram',
  'viber',
  'in_app'
);

create type public.message_status as enum (
  'queued',
  'scheduled',
  'sending',
  'sent',
  'delivered',
  'read',
  'failed',
  'bounced',
  'complained',
  'suppressed'
);

create type public.notification_type as enum (
  'invoice_sent',
  'invoice_viewed',
  'invoice_paid',
  'invoice_overdue',
  'estimate_approved',
  'estimate_declined',
  'payment_received',
  'payment_failed',
  'payout_processed',
  'kyc_status_changed',
  'subscription_changed',
  'low_stock',
  'team_invitation',
  'support_reply',
  'system_announcement',
  'security_alert'
);

create type public.audit_action as enum (
  'insert',
  'update',
  'soft_delete',
  'restore',
  'hard_delete',
  'login',
  'logout',
  'login_failed',
  'password_change',
  'two_factor_change',
  'permission_change',
  'impersonation_start',
  'impersonation_end',
  'export',
  'import',
  'send',
  'view_sensitive',
  'download',
  'approve',
  'reject',
  'settings_change',
  'secret_change'
);

create type public.ticket_status as enum (
  'open',
  'pending_customer',
  'pending_support',
  'resolved',
  'closed'
);

create type public.ticket_priority as enum (
  'low',
  'normal',
  'high',
  'urgent'
);

create type public.content_status as enum (
  'draft',
  'scheduled',
  'published',
  'archived'
);

create type public.social_platform as enum (
  'facebook_page',
  'instagram',
  'linkedin',
  'x',
  'threads',
  'telegram',
  'pinterest'
);

create type public.storage_provider as enum (
  'supabase',
  'cloudflare_r2',
  'aws_s3',
  'backblaze_b2',
  'wasabi',
  'local_disk'
);

create type public.file_visibility as enum (
  'public',
  'private',
  'signed_link'
);

create type public.link_token_status as enum (
  'active',
  'expired',
  'revoked',
  'consumed'
);

create type public.consent_type as enum (
  'terms_of_service',
  'privacy_policy',
  'refund_policy',
  'merchant_agreement',
  'data_processing_agreement',
  'payment_authorization',
  'goods_received',
  'cookie_preferences',
  'marketing_optin'
);

create type public.approval_status as enum (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);

create type public.job_status as enum (
  'queued',
  'reserved',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'dead_letter'
);

create type public.webhook_delivery_status as enum (
  'pending',
  'delivered',
  'failed',
  'exhausted'
);

create type public.api_key_status as enum (
  'active',
  'revoked',
  'expired'
);

create type public.import_status as enum (
  'uploaded',
  'mapping',
  'validating',
  'ready',
  'importing',
  'completed',
  'failed',
  'rolled_back'
);

create type public.integration_status as enum (
  'disconnected',
  'connected',
  'error',
  'paused'
);

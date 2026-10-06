-- supabase/migrations/00126_cms_enums.sql
-- Shared content, support, project, contract, and compliance enums for the
-- final pre-hardening database migration group.

create type content_status as enum (
  'draft',
  'published',
  'scheduled',
  'archived'
);

create type support_ticket_status as enum (
  'open',
  'pending_customer',
  'pending_agent',
  'resolved',
  'closed'
);

create type support_ticket_priority as enum (
  'low',
  'normal',
  'high',
  'urgent'
);

create type gdpr_request_type as enum (
  'data_export',
  'account_deletion'
);

create type gdpr_request_status as enum (
  'requested',
  'in_progress',
  'completed',
  'rejected',
  'cancelled'
);

create type backup_status as enum (
  'queued',
  'running',
  'completed',
  'failed',
  'expired'
);

create type project_status as enum (
  'planning',
  'active',
  'on_hold',
  'completed',
  'cancelled'
);

create type time_entry_status as enum (
  'draft',
  'submitted',
  'approved',
  'rejected',
  'billed'
);

create type contract_status as enum (
  'draft',
  'sent',
  'partially_signed',
  'signed',
  'declined',
  'expired',
  'cancelled'
);

create type signer_status as enum (
  'pending',
  'viewed',
  'signed',
  'declined',
  'expired'
);

create type signature_event_type as enum (
  'sent',
  'viewed',
  'signed',
  'declined',
  'downloaded',
  'expired'
);

-- supabase/migrations/00037_create_document_enums.sql
-- Enumerated types used by invoices, estimates, credit notes and the signed
-- links clients open their documents with.

-- The kind of line a document row represents. Only item and service lines
-- carry a quantity and a price; the others shape the printed document.
create type public.document_line_type as enum (
  'item',
  'service',
  'time_entry',
  'expense',
  'discount',
  'shipping',
  'text'
);

create type public.credit_note_status as enum (
  'draft',
  'issued',
  'partially_applied',
  'applied',
  'refunded',
  'cancelled'
);

-- How a credit note was settled.
create type public.credit_note_reason as enum (
  'correction',
  'return',
  'cancellation',
  'discount_after_issue',
  'write_off',
  'other'
);

create type public.recurring_schedule_status as enum (
  'draft',
  'active',
  'paused',
  'completed',
  'cancelled'
);

-- The record a signed client link points at. Clients never hold an account, so
-- every client facing page is reached through one of these.
create type public.shared_document_type as enum (
  'invoice',
  'estimate',
  'credit_note',
  'statement',
  'receipt',
  'contract'
);

-- What the recipient did with a document, recorded for the evidence chain.
create type public.document_event_type as enum (
  'created',
  'issued',
  'sent',
  'delivered',
  'opened',
  'viewed',
  'downloaded',
  'printed',
  'paid',
  'approved',
  'declined',
  'commented',
  'reminder_sent',
  'link_expired',
  'link_revoked'
);

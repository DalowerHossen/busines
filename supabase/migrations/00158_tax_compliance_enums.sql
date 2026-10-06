-- supabase/migrations/00158_tax_compliance_enums.sql
-- Shared lifecycle enums for Merchant of Record tax identity, nexus,
-- withholding, and annual U.S. information-return preparation.

create type tax_identity_document_type as enum (
  'w9',
  'w8ben',
  'w8bene',
  'w8eci',
  'w8imy'
);

create type tax_identity_status as enum (
  'not_started',
  'submitted',
  'verified',
  'rejected',
  'expired'
);

create type tax_registration_status as enum (
  'not_registered',
  'pending',
  'active',
  'suspended',
  'closed'
);

create type tax_return_status as enum (
  'not_started',
  'prepared',
  'ready_for_review',
  'filed',
  'accepted',
  'rejected',
  'amended'
);

create type tax_document_run_status as enum (
  'draft',
  'validating',
  'ready',
  'exported',
  'filed',
  'failed'
);

create type tax_reporting_form as enum (
  '1099_k',
  '1099_nec',
  '1099_misc'
);

create type tax_compliance_event_type as enum (
  'settings_changed',
  'tax_identity_submitted',
  'tax_identity_verified',
  'tax_identity_rejected',
  'tax_registration_changed',
  'tax_document_run_created',
  'tax_document_run_exported',
  'tax_document_run_filed',
  'tax_document_run_failed'
);

-- supabase/migrations/00049_dispute_audit_events.sql
-- V3. Tamper-Proof Audit Chain. A full event timeline (email sent/
-- delivered, invoice viewed, payment page visited, consent recorded, and
-- similar) for one invoice or estimate, hash-chained so any row's content
-- cannot be altered after the fact without breaking every later row's
-- hash. This is intentionally broader than the simple view-log added in
-- Phase 6 (client_access_logs), which only records tokenized-link views;
-- this table is the complete cross-channel evidence timeline.
--
-- event_hash/previous_event_hash are computed and verified by application
-- code (sha256 of previous_event_hash + canonical event_data +
-- occurred_at), not a database trigger -- consistent with every other
-- generic trigger being deferred to Phase 19. event_type is a free text
-- column validated against a TypeScript union at the application layer,
-- the same pattern already used for company_memberships.permissions,
-- rather than an enum that would need a migration every time a new event
-- type is introduced.

create table public.dispute_audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  document_type evidence_document_type not null,
  document_id uuid not null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  -- V3.4 / V3.5
  ip_address inet null,
  user_agent text null,
  occurred_at timestamptz not null default now(),
  -- V3.7
  previous_event_hash text null,
  event_hash text not null,
  created_at timestamptz not null default now()
);

create index dispute_audit_events_document_idx
  on public.dispute_audit_events (document_type, document_id, occurred_at);
create index dispute_audit_events_company_id_idx on public.dispute_audit_events (company_id);

comment on table public.dispute_audit_events is
  'V3: the full, tamper-evident, hash-chained event timeline for one invoice or estimate. Append-only -- never updated or deleted once written.';

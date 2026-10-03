-- supabase/migrations/00048_delivery_acceptance_records.sql
-- V2. Delivery & Acceptance Proof. One evidence record per invoice or
-- estimate (polymorphic, same pattern as 00047), built up incrementally
-- over the document's lifecycle (tracking added, then delivery confirmed,
-- then client acknowledges) -- unlike the pre-payment consent record this
-- is not a single immutable write, so updated_at exists; deleted_at does
-- not, since this evidence must be retained (V6.5).

create table public.delivery_acceptance_records (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  document_type evidence_document_type not null,
  document_id uuid not null,
  -- V2.1
  delivery_confirmed_at timestamptz null,
  -- V2.6
  tracking_number text null,
  -- V2.7
  service_completed_at date null,
  -- V2.2: owner marks the work complete and the client acknowledges it.
  client_acknowledged_at timestamptz null,
  -- V2.8: client explicitly confirms acceptance via a tokenized link.
  client_accepted_via_link_at timestamptz null,
  -- V2.3 (optional)
  client_esignature_provider_file_id text null,
  -- V2.5: owner-uploaded proof (photo, signed receipt, etc.)
  delivery_proof_provider_file_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index delivery_acceptance_records_document_key
  on public.delivery_acceptance_records (document_type, document_id);
create index delivery_acceptance_records_company_id_idx
  on public.delivery_acceptance_records (company_id);

comment on table public.delivery_acceptance_records is
  'V2: delivery and client-acceptance evidence for one invoice or estimate. V2.4 (estimate approval record) is this same table with document_type = estimate.';

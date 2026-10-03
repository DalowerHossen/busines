-- supabase/migrations/00047_payment_consent_records.sql
-- V1. Pre-Payment Consent Evidence. An immutable (V1.11) record of exactly
-- what a client was shown and agreed to before paying, captured on the
-- tokenized pay page at the moment of consent -- not after the fact.
--
-- document_id has NO foreign key: evidence_document_type decides whether
-- it points at invoices(id) or estimates(id), the same polymorphic
-- pattern already used by client_access_tokens.document_id in Phase 6.
-- payment_id starts null (consent happens before a payment attempt
-- exists) and is filled in once the resulting payment is created.

create type evidence_document_type as enum (
  'invoice',
  'estimate'
);

create table public.payment_consent_records (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  document_type evidence_document_type not null,
  document_id uuid not null,
  client_id uuid not null references public.clients (id),
  payment_id uuid null references public.payments (id),
  -- V1.1
  consent_checkbox_accepted boolean not null default false,
  -- V1.2
  received_goods_or_services_confirmed boolean not null default false,
  -- V1.3
  invoice_details_read_confirmed boolean not null default false,
  -- V1.10: the exact wording shown next to the checkbox at consent time.
  consent_text_snapshot text not null,
  -- V1.4: versioned terms snapshot (version number + exact text shown).
  terms_version text null,
  terms_text_snapshot text null,
  -- V1.5: versioned refund-policy snapshot.
  refund_policy_version text null,
  refund_policy_text_snapshot text null,
  -- V1.7 (always UTC -- timestamptz is stored and compared in UTC).
  consented_at timestamptz not null default now(),
  -- V1.8
  ip_address inet null,
  geo_country_code text null,
  geo_region text null,
  geo_city text null,
  -- V1.9
  user_agent text null,
  device_fingerprint text null,
  created_at timestamptz not null default now()
);

create index payment_consent_records_company_id_idx on public.payment_consent_records (company_id);
create index payment_consent_records_document_idx
  on public.payment_consent_records (document_type, document_id);
create index payment_consent_records_client_id_idx on public.payment_consent_records (client_id);
create index payment_consent_records_payment_id_idx
  on public.payment_consent_records (payment_id)
  where payment_id is not null;

comment on table public.payment_consent_records is
  'V1.11: an immutable pre-payment consent record. No updated_at or deleted_at columns exist on this table -- rows are never edited or removed once written.';

-- supabase/migrations/00050_dispute_evidence_packs.sql
-- V4. One-Click Dispute Evidence Pack. One row per generated evidence
-- bundle (invoice + consent + timeline, rendered as a PDF and stored
-- through the configured storage provider) for a chargeback case. A
-- chargeback may have more than one generated pack over time (V4.8 "per-
-- dispute case file" keeps every generation, not just the latest).

create table public.dispute_evidence_packs (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  chargeback_id uuid not null references public.chargebacks (id),
  generated_by_user_id uuid not null references public.users (id),
  -- V4.3: a format tailored to the gateway's own dispute-evidence upload
  -- shape, or a generic human-readable PDF.
  format text not null default 'generic',
  provider_file_id text not null,
  generated_at timestamptz not null default now(),
  sent_at timestamptz null,
  sent_to text null,
  created_at timestamptz not null default now(),
  constraint dispute_evidence_packs_format_valid check (format in ('generic', 'stripe', 'paypal'))
);

create index dispute_evidence_packs_chargeback_id_idx
  on public.dispute_evidence_packs (chargeback_id);
create index dispute_evidence_packs_company_id_idx on public.dispute_evidence_packs (company_id);

comment on table public.dispute_evidence_packs is
  'V4: a generated dispute evidence bundle for a chargeback. Supports the super_admin dispute center (V6.6) and keeps every past generation (V4.8).';

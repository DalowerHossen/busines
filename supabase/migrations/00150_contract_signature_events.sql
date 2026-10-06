-- supabase/migrations/00150_contract_signature_events.sql
-- Append-only legal signature audit trail with timestamp and privacy-safe
-- request identity hashes.

create table public.contract_signature_events (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  signer_id uuid null references public.contract_signers (id) on delete set null,
  event_type signature_event_type not null,
  ip_hash text null,
  user_agent_hash text null,
  event_metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint contract_signature_events_metadata_object check (
    jsonb_typeof(event_metadata) = 'object'
  )
);

create index contract_signature_events_contract_time_idx
  on public.contract_signature_events (contract_id, occurred_at);
create index contract_signature_events_signer_time_idx
  on public.contract_signature_events (signer_id, occurred_at)
  where signer_id is not null;

comment on table public.contract_signature_events is
  'Append-only contract signature and access evidence with timestamp and hashed request identity.';

-- supabase/migrations/00148_contracts.sql
-- Contract instance sent to one or more signers. Documents are stored in
-- Google Drive and linked by provider file reference.

create table public.contracts (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  client_id uuid null references public.clients (id),
  project_id uuid null references public.projects (id),
  invoice_id uuid null references public.invoices (id),
  template_id uuid null references public.contract_templates (id),
  contract_number text not null,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  status contract_status not null default 'draft',
  provider_file_id text null,
  signed_provider_file_id text null,
  expires_at timestamptz null,
  sent_at timestamptz null,
  fully_signed_at timestamptz null,
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint contracts_number_not_blank check (length(btrim(contract_number)) > 0),
  constraint contracts_title_not_blank check (length(btrim(title)) > 0),
  constraint contracts_content_object check (jsonb_typeof(content) = 'object'),
  constraint contracts_signed_fields_valid check (
    (status = 'signed' and fully_signed_at is not null and signed_provider_file_id is not null)
    or status <> 'signed'
  )
);

create unique index contracts_company_number_key
  on public.contracts (company_id, contract_number)
  where deleted_at is null;
create index contracts_client_status_idx
  on public.contracts (company_id, client_id, status)
  where deleted_at is null;
create index contracts_expiry_idx
  on public.contracts (expires_at)
  where expires_at is not null and deleted_at is null;

comment on table public.contracts is
  'A tenant contract instance with signer workflow, expiry, storage references, and optional invoice/project linkage.';

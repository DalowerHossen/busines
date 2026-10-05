-- supabase/migrations/00018_client_attachments.sql
-- A file attached to a client record (for example a signed contract).
-- Only a reference to the configured storage provider (Google Drive by
-- default) is kept here; the binary content itself never touches
-- Supabase, per the storage-provider rule.

create table public.client_attachments (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  client_id uuid not null references public.clients (id),
  uploaded_by_user_id uuid not null references public.users (id),
  provider_file_id text not null,
  file_name text not null,
  mime_type text not null,
  size_in_bytes bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index client_attachments_company_id_idx on public.client_attachments (company_id) where deleted_at is null;
create index client_attachments_client_id_idx on public.client_attachments (client_id) where deleted_at is null;

comment on table public.client_attachments is
  'A file attached to a client record. Stores only a provider_file_id reference; binary content lives in the configured storage provider (Google Drive by default), never in Supabase.';

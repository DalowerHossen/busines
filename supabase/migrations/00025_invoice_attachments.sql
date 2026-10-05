-- supabase/migrations/00025_invoice_attachments.sql
-- A file attached to an invoice. Only a provider_file_id reference is
-- kept here; binary content lives in the configured storage provider
-- (Google Drive by default), never in Supabase.

create table public.invoice_attachments (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  invoice_id uuid not null references public.invoices (id),
  provider_file_id text not null,
  file_name text not null,
  mime_type text not null,
  size_in_bytes bigint not null,
  uploaded_by_user_id uuid not null references public.users (id),
  uploaded_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index invoice_attachments_invoice_id_idx
  on public.invoice_attachments (invoice_id)
  where deleted_at is null;
create index invoice_attachments_company_id_idx on public.invoice_attachments (company_id);

comment on table public.invoice_attachments is
  'A file attached to an invoice. Stores only a provider_file_id reference; binary content never touches Supabase.';

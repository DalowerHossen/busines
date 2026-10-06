-- supabase/migrations/00172_phase21_storage_provider_folders.sql
-- Server-only mapping between a tenant, a configured storage provider, and
-- that provider's root folder/container. Binary content never enters this
-- table or Postgres.

create table public.storage_provider_folders (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider_id text not null,
  provider_folder_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storage_provider_folders_provider_valid check (
    provider_id in ('google_drive', 'supabase', 'r2', 's3', 'b2', 'wasabi', 'local')
  ),
  constraint storage_provider_folders_id_not_blank check (length(btrim(provider_folder_id)) > 0)
);

create unique index storage_provider_folders_company_provider_key
  on public.storage_provider_folders (company_id, provider_id);
create unique index storage_provider_folders_provider_folder_key
  on public.storage_provider_folders (provider_id, provider_folder_id);

alter table public.storage_provider_folders enable row level security;
alter table public.storage_provider_folders force row level security;
revoke all privileges on table public.storage_provider_folders from public, anon, authenticated;

create trigger storage_provider_folders_updated_at
before update on public.storage_provider_folders
for each row execute function public.touch_updated_at();

create trigger storage_provider_folders_audit
after insert or update or delete on public.storage_provider_folders
for each row execute function public.create_audit_log();

comment on table public.storage_provider_folders is
  'Server-only tenant storage folder mapping. File binaries remain in the configured external provider.';

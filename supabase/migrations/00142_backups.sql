-- supabase/migrations/00142_backups.sql
-- Metadata for encrypted database or tenant backup artifacts. Binary backup
-- files are stored outside Postgres through the configured storage provider.

create table public.backups (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid null references public.companies (id),
  backup_type text not null,
  status backup_status not null default 'queued',
  provider_file_id text null,
  size_bytes bigint null,
  content_sha256 text null,
  encryption_key_version text null,
  created_by_user_id uuid null references public.users (id),
  started_at timestamptz null,
  completed_at timestamptz null,
  expires_at timestamptz null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint backups_type_not_blank check (length(btrim(backup_type)) > 0),
  constraint backups_size_non_negative check (size_bytes is null or size_bytes >= 0),
  constraint backups_completed_fields_valid check (
    (status = 'completed' and provider_file_id is not null and completed_at is not null)
    or status <> 'completed'
  )
);

create index backups_company_time_idx
  on public.backups (company_id, created_at desc);
create index backups_queue_idx
  on public.backups (status, created_at)
  where status in ('queued', 'running');
create index backups_expiry_idx
  on public.backups (expires_at)
  where expires_at is not null and status = 'completed';

comment on table public.backups is
  'Encrypted backup artifact metadata; database rows never contain the backup binary.';

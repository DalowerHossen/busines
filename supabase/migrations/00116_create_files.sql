-- supabase/migrations/00116_create_files.sql
-- The file register: one row for every object the platform holds.
--
-- The row is the record of truth about a file; the object store only holds
-- bytes. Content is identified by its SHA-256 digest, so the same receipt
-- uploaded twice is stored once and counted once against the quota.

create table public.files (
  id uuid primary key default public.generate_uuid_v7(),
  -- Null for platform assets that belong to no tenant.
  company_id uuid,
  storage_target_id uuid,

  storage_key text not null,
  file_name text not null,
  -- What the person called it, kept for the download header.
  original_file_name text,
  mime_type text not null default 'application/octet-stream',
  byte_size bigint not null default 0,
  content_hash text,

  -- What the file is for, which drives retention and who may read it.
  file_purpose text not null default 'attachment',
  visibility public.file_visibility not null default 'private',

  -- What it is attached to, kept loose so any module can use the register.
  owner_type text,
  owner_id uuid,

  -- Image and document detail, filled by the optimiser.
  width integer,
  height integer,
  page_count integer,
  duration_seconds integer,
  is_optimized boolean not null default false,
  has_exif_stripped boolean not null default false,
  blurhash text,
  alt_text text,

  -- Versioning. A new upload over the same logical file becomes version two.
  version smallint not null default 1,
  replaces_file_id uuid,
  is_current boolean not null default true,

  -- Lifecycle.
  storage_tier text not null default 'hot',
  uploaded_at timestamptz,
  last_accessed_at timestamptz,
  access_count integer not null default 0,
  scan_status text not null default 'pending',
  scan_result text,
  expires_at timestamptz,
  archived_at timestamptz,
  -- Set when the object itself has gone, while the record stays as evidence.
  purged_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint files_key_check
    check (length(btrim(storage_key)) between 3 and 400),
  constraint files_name_check
    check (length(btrim(file_name)) between 1 and 255),
  constraint files_size_check
    check (byte_size >= 0),
  constraint files_hash_check
    check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),
  constraint files_purpose_check
    check (file_purpose in ('attachment', 'invoice_pdf', 'receipt', 'logo',
                            'avatar', 'kyc_document', 'contract', 'signature',
                            'import', 'export', 'backup', 'product_image',
                            'email_asset', 'marketing_asset')),
  constraint files_owner_check
    check ((owner_type is null) = (owner_id is null)),
  constraint files_dimensions_check
    check ((width is null or width > 0) and (height is null or height > 0)),
  constraint files_version_check
    check (version between 1 and 999),
  constraint files_tier_check
    check (storage_tier in ('hot', 'cold', 'archive')),
  constraint files_scan_check
    check (scan_status in ('pending', 'clean', 'infected', 'skipped', 'failed'))
);

comment on table public.files is
  'Every object the platform stores, with what it is, where it is and who owns it.';

comment on column public.files.content_hash is
  'SHA-256 of the bytes, used to store identical uploads only once.';

create unique index files_storage_key_unique
  on public.files (storage_key);

create index files_company_idx
  on public.files (company_id, created_at desc)
  where deleted_at is null;

create index files_owner_idx
  on public.files (owner_type, owner_id)
  where owner_id is not null and deleted_at is null;

create index files_hash_idx
  on public.files (company_id, content_hash)
  where content_hash is not null and deleted_at is null;

create index files_purpose_idx
  on public.files (company_id, file_purpose)
  where deleted_at is null;

-- The cleanup job reads these two.
create index files_orphan_idx
  on public.files (created_at)
  where owner_id is null and deleted_at is null;

create index files_expiring_idx
  on public.files (expires_at)
  where expires_at is not null and purged_at is null;

-- -----------------------------------------------------------------------------
-- Derived renditions
-- -----------------------------------------------------------------------------

create table public.file_variants (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,
  file_id uuid not null,

  variant_key text not null,
  storage_key text not null,
  mime_type text not null,
  byte_size bigint not null default 0,
  width integer,
  height integer,

  created_at timestamptz not null default now(),

  constraint file_variants_key_check
    check (variant_key ~ '^[a-z][a-z0-9_]{1,30}$'),
  constraint file_variants_size_check
    check (byte_size >= 0)
);

comment on table public.file_variants is
  'Resized or reformatted copies of an image, such as a thumbnail in AVIF.';

create unique index file_variants_unique
  on public.file_variants (file_id, variant_key);

create index file_variants_company_idx
  on public.file_variants (company_id);

-- -----------------------------------------------------------------------------
-- Reading is evidence too
-- -----------------------------------------------------------------------------

create table public.file_access_logs (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,
  file_id uuid not null,

  action text not null default 'download',
  actor_user_id uuid,
  -- Set when a client reached the file through a signed link.
  document_link_id uuid,
  ip_hash text,
  user_agent text,
  referrer text,
  was_allowed boolean not null default true,
  denial_reason text,

  created_at timestamptz not null default now(),

  constraint file_access_logs_action_check
    check (action in ('view', 'download', 'print', 'share', 'delete',
                      'signed_url')),
  constraint file_access_logs_ip_check
    check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  constraint file_access_logs_denied_check
    check (was_allowed or denial_reason is not null)
);

comment on table public.file_access_logs is
  'Who opened which file, kept because sensitive documents need a read trail.';

create index file_access_logs_file_idx
  on public.file_access_logs (file_id, created_at desc);

create index file_access_logs_company_idx
  on public.file_access_logs (company_id, created_at desc);

create index file_access_logs_actor_idx
  on public.file_access_logs (actor_user_id, created_at desc)
  where actor_user_id is not null;

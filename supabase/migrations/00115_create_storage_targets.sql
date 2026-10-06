-- supabase/migrations/00115_create_storage_targets.sql
-- Where files are kept, and how the platform talks to that place.
--
-- Storage is pluggable on purpose: the default is an object store behind a
-- CDN, but a self hosted deployment may point at local disk and an enterprise
-- tenant may bring its own bucket. Nothing above this layer knows which one
-- is in use; it only ever asks for a target and gets back a key.

create table public.storage_targets (
  id uuid primary key default public.generate_uuid_v7(),
  -- Null for the platform wide target every tenant falls back to.
  company_id uuid,

  name text not null,
  provider public.storage_provider not null default 'cloudflare_r2',
  is_default boolean not null default false,
  is_active boolean not null default true,

  bucket_name text not null,
  region text,
  endpoint_url text,
  -- Prefix every key is written under, which keeps tenants apart inside one
  -- bucket.
  path_prefix text,
  -- Public base used to build a delivery URL, normally a CDN host.
  public_base_url text,
  force_path_style boolean not null default false,

  -- Credentials follow the same pattern as the payment gateways: encrypted at
  -- rest, resolved at runtime, rotatable without a redeploy.
  credentials_encrypted text,
  credentials_key_version smallint not null default 1,
  credentials_fingerprint text,
  previous_credentials_encrypted text,
  previous_credentials_valid_until timestamptz,

  -- Delivery policy.
  signed_url_ttl_seconds integer not null default 900,
  max_upload_bytes bigint not null default 26214400,
  allowed_mime_types text[] not null default array[
    'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic',
    'application/pdf', 'text/csv', 'text/plain'
  ],

  -- Health, so the admin screen can show something truthful.
  last_used_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  last_verified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint storage_targets_name_check
    check (length(btrim(name)) between 2 and 60),
  constraint storage_targets_bucket_check
    check (bucket_name ~ '^[a-z0-9][a-z0-9._-]{1,62}$'),
  constraint storage_targets_prefix_check
    check (path_prefix is null or path_prefix ~ '^[A-Za-z0-9][A-Za-z0-9/_-]{0,80}$'),
  constraint storage_targets_url_check
    check (public_base_url is null or public_base_url ~ '^https://'),
  constraint storage_targets_endpoint_check
    check (endpoint_url is null or endpoint_url ~ '^https://'),
  constraint storage_targets_ttl_check
    check (signed_url_ttl_seconds between 60 and 604800),
  constraint storage_targets_size_check
    check (max_upload_bytes between 1024 and 5368709120),
  constraint storage_targets_fingerprint_check
    check (credentials_fingerprint is null
           or credentials_fingerprint ~ '^[0-9a-f]{64}$')
);

comment on table public.storage_targets is
  'A configured place to store files, platform wide or belonging to a tenant.';

comment on column public.storage_targets.previous_credentials_valid_until is
  'Grace window during which the replaced key still works, so a rotation never drops an upload.';

create unique index storage_targets_platform_default
  on public.storage_targets ((true))
  where company_id is null and is_default and deleted_at is null;

create unique index storage_targets_company_default
  on public.storage_targets (company_id)
  where company_id is not null and is_default and deleted_at is null;

create index storage_targets_company_idx
  on public.storage_targets (company_id)
  where deleted_at is null;

-- The platform ships with one working target so that the first upload of a
-- fresh installation has somewhere to land.
insert into public.storage_targets (
  company_id, name, provider, is_default, bucket_name, path_prefix,
  public_base_url
)
values (
  null, 'Platform object storage', 'cloudflare_r2', true, 'kdsolutionit-files',
  'tenants', 'https://assets.kdsolutionit.com'
);

-- -----------------------------------------------------------------------------
-- Resolving a target
-- -----------------------------------------------------------------------------

-- Returns the target a tenant should write to: its own if it has one, the
-- platform target otherwise.
create or replace function public.resolve_storage_target(p_company_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id
    from public.storage_targets
   where deleted_at is null
     and is_active
     and (company_id = p_company_id or company_id is null)
   order by (company_id is not null) desc, is_default desc, created_at
   limit 1;
$$;

comment on function public.resolve_storage_target(uuid) is
  'Returns the storage target a tenant writes to, falling back to the platform one.';

-- Builds the key a file is written under. Keys are opaque, scoped by tenant
-- and never guessable, because a leaked key must not be a leaked document.
create or replace function public.build_storage_key(
  p_company_id uuid,
  p_folder text,
  p_file_name text
)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text;
  v_extension text;
  v_slug text;
begin
  select coalesce(path_prefix, 'tenants') into v_prefix
    from public.storage_targets
   where id = public.resolve_storage_target(p_company_id);

  v_extension := lower(coalesce(nullif(regexp_replace(p_file_name, '^.*\.', ''), p_file_name), ''));
  v_slug := public.slugify(regexp_replace(p_file_name, '\.[A-Za-z0-9]+$', ''));

  return coalesce(v_prefix, 'tenants')
    || '/' || coalesce(p_company_id::text, 'platform')
    || '/' || coalesce(nullif(public.slugify(p_folder), ''), 'files')
    || '/' || to_char(now(), 'YYYY/MM')
    || '/' || replace(public.generate_uuid_v7()::text, '-', '')
    || case when v_slug = '' then '' else '-' || left(v_slug, 48) end
    || case when v_extension = '' then '' else '.' || v_extension end;
end;
$$;

comment on function public.build_storage_key(uuid, text, text) is
  'Builds an opaque, tenant scoped object key for a new file.';

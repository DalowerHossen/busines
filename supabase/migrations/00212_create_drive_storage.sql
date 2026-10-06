-- supabase/migrations/00212_create_drive_storage.sql
-- Keeping the documents of a business in its own cloud drive.
--
-- The database holds text: who the client is, what the invoice says, what
-- was paid. The heavy things a business accumulates, the scanned receipts,
-- the signed contracts, the logo, do not belong in a database at all. A
-- business that connects its own drive keeps every one of those files inside
-- an account it owns, which is the honest answer to the question of who
-- holds the documents.
--
-- Nothing already configured stops working. A drive becomes the default for
-- that tenant and the platform store stays behind it as the fallback, so a
-- tenant that connects nothing behaves exactly as it did before.

alter type public.storage_provider add value if not exists 'google_drive';

-- A drive gives a file its own identifier rather than letting us choose a
-- key, so the identifier it hands back has to be kept beside ours.
alter table public.files
  add column if not exists external_object_id text;

alter table public.upload_sessions
  add column if not exists external_object_id text;

create index if not exists files_external_object_idx
  on public.files (external_object_id)
  where external_object_id is not null;

comment on column public.files.external_object_id is
  'Identifier the external drive gave this object, when the store assigns its own.';

-- -----------------------------------------------------------------------------
-- Recording what the drive called the file
-- -----------------------------------------------------------------------------

create or replace function public.set_file_external_id(
  p_file_id uuid,
  p_external_id text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_service_role() then
    raise exception 'Only the server records where a drive put a file'
      using errcode = '42501';
  end if;

  if coalesce(btrim(p_external_id), '') = '' then
    raise exception 'The drive gave no identifier for that file'
      using errcode = '22023';
  end if;

  update public.files
     set external_object_id = btrim(p_external_id),
         updated_at = now()
   where id = p_file_id
     and deleted_at is null;

  return found;
end;
$$;

comment on function public.set_file_external_id(uuid, text) is
  'Stores the identifier an external drive gave one uploaded file.';

-- -----------------------------------------------------------------------------
-- The readers, now that a file may live somewhere that names it itself
-- -----------------------------------------------------------------------------

create or replace function public.upload_session_target(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.upload_sessions%rowtype;
  v_target public.storage_targets%rowtype;
begin
  if not public.is_service_role() then
    raise exception 'Only the server may read storage credentials'
      using errcode = '42501';
  end if;

  select * into v_session
    from public.upload_sessions
   where id = p_session_id;

  if not found then
    raise exception 'That upload was not found' using errcode = 'P0002';
  end if;

  select * into v_target
    from public.storage_targets
   where id = v_session.storage_target_id;

  if not found then
    raise exception 'No storage has been configured' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'session_id', v_session.id,
    'company_id', v_session.company_id,
    'storage_key', v_session.storage_key,
    'file_name', v_session.file_name,
    'mime_type', v_session.mime_type,
    'declared_byte_size', v_session.declared_byte_size,
    'status', v_session.status,
    'expires_at', v_session.expires_at,
    'target_id', v_target.id,
    'provider', v_target.provider::text,
    'bucket_name', v_target.bucket_name,
    'region', v_target.region,
    'endpoint_url', v_target.endpoint_url,
    'path_prefix', v_target.path_prefix,
    'public_base_url', v_target.public_base_url,
    'force_path_style', v_target.force_path_style,
    'signed_url_ttl_seconds', v_target.signed_url_ttl_seconds,
    'max_upload_bytes', v_target.max_upload_bytes,
    'credentials_encrypted', v_target.credentials_encrypted,
    'previous_credentials_encrypted', v_target.previous_credentials_encrypted,
    'previous_credentials_valid_until', v_target.previous_credentials_valid_until
  );
end;
$$;

create or replace function public.file_storage_target(p_file_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_file public.files%rowtype;
  v_target public.storage_targets%rowtype;
begin
  if not public.is_service_role() then
    raise exception 'Only the server may read storage credentials'
      using errcode = '42501';
  end if;

  select * into v_file
    from public.files
   where id = p_file_id
     and deleted_at is null;

  if not found then
    raise exception 'That file was not found' using errcode = 'P0002';
  end if;

  select * into v_target
    from public.storage_targets
   where id = v_file.storage_target_id;

  if not found then
    raise exception 'No storage has been configured' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'file_id', v_file.id,
    'company_id', v_file.company_id,
    'storage_key', v_file.storage_key,
    'external_object_id', v_file.external_object_id,
    'file_name', v_file.file_name,
    'mime_type', v_file.mime_type,
    'purged_at', v_file.purged_at,
    'target_id', v_target.id,
    'provider', v_target.provider::text,
    'bucket_name', v_target.bucket_name,
    'region', v_target.region,
    'endpoint_url', v_target.endpoint_url,
    'path_prefix', v_target.path_prefix,
    'public_base_url', v_target.public_base_url,
    'force_path_style', v_target.force_path_style,
    'signed_url_ttl_seconds', v_target.signed_url_ttl_seconds,
    'credentials_encrypted', v_target.credentials_encrypted,
    'previous_credentials_encrypted', v_target.previous_credentials_encrypted,
    'previous_credentials_valid_until', v_target.previous_credentials_valid_until
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Connecting and disconnecting a drive
-- -----------------------------------------------------------------------------

-- Points a tenant at a folder in its own drive. The permission to write
-- there is a refresh token, which is encrypted before it arrives here, and
-- the folder is recorded as the prefix every key of that tenant sits under.
create or replace function public.connect_company_drive(
  p_company_id uuid,
  p_folder_id text,
  p_folder_name text,
  p_credentials_encrypted text,
  p_fingerprint text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_id uuid;
begin
  if not (public.is_service_role() or public.is_company_owner(p_company_id)) then
    raise exception 'Only the account owner may connect a drive'
      using errcode = '42501';
  end if;

  if coalesce(btrim(p_folder_id), '') = '' then
    raise exception 'A drive connection needs a folder' using errcode = '22023';
  end if;

  select id into v_target_id
    from public.storage_targets
   where company_id = p_company_id
     and provider = 'google_drive'
     and deleted_at is null
   limit 1;

  if v_target_id is null then
    insert into public.storage_targets (
      company_id, name, provider, is_default, is_active, bucket_name,
      path_prefix, signed_url_ttl_seconds, max_upload_bytes,
      credentials_encrypted, credentials_fingerprint, last_verified_at,
      created_by, updated_by
    )
    values (
      p_company_id,
      left(coalesce(nullif(btrim(p_folder_name), ''), 'Connected drive'), 60),
      'google_drive', true, true, 'google-drive',
      left(btrim(p_folder_id), 80), 900, 1073741824,
      p_credentials_encrypted, p_fingerprint, now(),
      public.current_user_id(), public.current_user_id()
    )
    returning id into v_target_id;

    return v_target_id;
  end if;

  update public.storage_targets
     set name = left(coalesce(nullif(btrim(p_folder_name), ''), name), 60),
         path_prefix = left(btrim(p_folder_id), 80),
         previous_credentials_encrypted = credentials_encrypted,
         previous_credentials_valid_until =
           case
             when credentials_encrypted is null then null
             else now() + interval '5 minutes'
           end,
         credentials_encrypted = coalesce(p_credentials_encrypted, credentials_encrypted),
         credentials_fingerprint = coalesce(p_fingerprint, credentials_fingerprint),
         credentials_key_version = credentials_key_version + 1,
         is_active = true,
         is_default = true,
         last_verified_at = now(),
         last_error = null,
         last_error_at = null,
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = v_target_id;

  return v_target_id;
end;
$$;

comment on function public.connect_company_drive(uuid, text, text, text, text) is
  'Points a tenant at a folder in its own drive and stores the permission to write there.';

-- Disconnecting never deletes anything. The files already in the drive stay
-- in the drive, and new uploads go back to the platform store.
create or replace function public.disconnect_company_storage(p_company_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_company_owner(p_company_id)) then
    raise exception 'Only the account owner may disconnect the drive'
      using errcode = '42501';
  end if;

  update public.storage_targets
     set is_active = false,
         is_default = false,
         deleted_at = now(),
         credentials_encrypted = null,
         previous_credentials_encrypted = null,
         previous_credentials_valid_until = null,
         updated_at = now(),
         updated_by = public.current_user_id()
   where company_id = p_company_id
     and deleted_at is null;

  return found;
end;
$$;

comment on function public.disconnect_company_storage(uuid) is
  'Stops using the drive of a tenant, leaving every file already in it untouched.';

-- What the settings screen shows: where files are going, and how many have
-- gone there, with nothing secret in it.
create or replace function public.company_storage_target(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_target public.storage_targets%rowtype;
  v_own boolean;
  v_files integer;
  v_bytes bigint;
begin
  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You do not have permission to read this setting'
      using errcode = '42501';
  end if;

  select * into v_target
    from public.storage_targets
   where id = public.resolve_storage_target(p_company_id);

  if not found then
    return jsonb_build_object('is_configured', false);
  end if;

  v_own := v_target.company_id is not null;

  select count(*)::int, coalesce(sum(byte_size), 0)::bigint
    into v_files, v_bytes
    from public.files
   where company_id = p_company_id
     and storage_target_id = v_target.id
     and deleted_at is null
     and purged_at is null;

  return jsonb_build_object(
    'is_configured', true,
    'is_own_storage', v_own,
    'target_id', v_target.id,
    'name', v_target.name,
    'provider', v_target.provider::text,
    'folder_reference', case when v_own then v_target.path_prefix else null end,
    'max_upload_bytes', v_target.max_upload_bytes,
    'last_verified_at', v_target.last_verified_at,
    'last_error', v_target.last_error,
    'last_error_at', v_target.last_error_at,
    'file_count', coalesce(v_files, 0),
    'stored_bytes', coalesce(v_bytes, 0)
  );
end;
$$;

comment on function public.company_storage_target(uuid) is
  'Reports where the files of one tenant are being kept, without any secret.';

-- -----------------------------------------------------------------------------
-- The platform list, now that a drive is one of the choices
-- -----------------------------------------------------------------------------

create or replace function public.save_storage_target(
  p_name text,
  p_provider text,
  p_bucket_name text,
  p_target_id uuid default null,
  p_region text default null,
  p_endpoint_url text default null,
  p_path_prefix text default null,
  p_public_base_url text default null,
  p_force_path_style boolean default false,
  p_signed_url_ttl_seconds integer default 900,
  p_max_upload_bytes bigint default 26214400,
  p_is_active boolean default true,
  p_is_default boolean default false
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_id uuid;
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may change the storage settings'
      using errcode = '42501';
  end if;

  if p_provider not in ('supabase', 'cloudflare_r2', 'aws_s3', 'backblaze_b2',
                        'wasabi', 'local_disk', 'google_drive') then
    raise exception 'That storage provider is not one we support'
      using errcode = '22023';
  end if;

  if p_is_default then
    update public.storage_targets
       set is_default = false, updated_at = now()
     where company_id is null
       and deleted_at is null
       and (p_target_id is null or id <> p_target_id);
  end if;

  if p_target_id is null then
    insert into public.storage_targets (
      company_id, name, provider, is_default, is_active, bucket_name, region,
      endpoint_url, path_prefix, public_base_url, force_path_style,
      signed_url_ttl_seconds, max_upload_bytes, created_by, updated_by
    )
    values (
      null, btrim(p_name), p_provider::public.storage_provider, p_is_default,
      p_is_active, lower(btrim(p_bucket_name)),
      nullif(btrim(coalesce(p_region, '')), ''),
      nullif(btrim(coalesce(p_endpoint_url, '')), ''),
      nullif(btrim(coalesce(p_path_prefix, '')), ''),
      nullif(btrim(coalesce(p_public_base_url, '')), ''),
      coalesce(p_force_path_style, false),
      coalesce(p_signed_url_ttl_seconds, 900),
      coalesce(p_max_upload_bytes, 26214400),
      public.current_user_id(), public.current_user_id()
    )
    returning id into v_target_id;

    return v_target_id;
  end if;

  update public.storage_targets
     set name = btrim(p_name),
         provider = p_provider::public.storage_provider,
         bucket_name = lower(btrim(p_bucket_name)),
         region = nullif(btrim(coalesce(p_region, '')), ''),
         endpoint_url = nullif(btrim(coalesce(p_endpoint_url, '')), ''),
         path_prefix = nullif(btrim(coalesce(p_path_prefix, '')), ''),
         public_base_url = nullif(btrim(coalesce(p_public_base_url, '')), ''),
         force_path_style = coalesce(p_force_path_style, false),
         signed_url_ttl_seconds = coalesce(p_signed_url_ttl_seconds, 900),
         max_upload_bytes = coalesce(p_max_upload_bytes, 26214400),
         is_active = coalesce(p_is_active, true),
         is_default = coalesce(p_is_default, is_default),
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_target_id
     and deleted_at is null;

  if not found then
    raise exception 'That store was not found' using errcode = 'P0002';
  end if;

  return p_target_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- The drive as something the platform can be connected to
-- -----------------------------------------------------------------------------

insert into public.integration_providers (
  provider_key, name, category, summary, configurable_by, field_schema,
  supports_test_mode, supports_connection_test, test_endpoint,
  documentation_url, logo_slug, is_built_in, is_active, sort_order
)
values (
  'google_drive',
  'Cloud drive storage',
  'storage',
  'Keeps uploaded documents in the cloud drive of the business rather than on platform storage.',
  'both',
  jsonb_build_array(
    jsonb_build_object(
      'key', 'client_id', 'label', 'Application identifier', 'type', 'text',
      'required', true, 'secret', false, 'env_var', 'GOOGLE_DRIVE_CLIENT_ID'
    ),
    jsonb_build_object(
      'key', 'client_secret', 'label', 'Application secret', 'type', 'password',
      'required', true, 'secret', true, 'env_var', 'GOOGLE_DRIVE_CLIENT_SECRET'
    )
  ),
  false, true, 'https://www.googleapis.com/drive/v3/about',
  'https://developers.google.com/drive/api/guides/about-sdk',
  'cloud-drive', true, true, 170
)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.set_file_external_id(uuid, text)
  from public, authenticated;
revoke execute on function public.connect_company_drive(uuid, text, text, text, text)
  from public, authenticated;
revoke execute on function public.disconnect_company_storage(uuid)
  from public, authenticated;
revoke execute on function public.company_storage_target(uuid)
  from public, authenticated;

grant execute on function public.set_file_external_id(uuid, text) to service_role;
grant execute on function public.connect_company_drive(uuid, text, text, text, text)
  to authenticated, service_role;
grant execute on function public.disconnect_company_storage(uuid)
  to authenticated, service_role;
grant execute on function public.company_storage_target(uuid)
  to authenticated, service_role;

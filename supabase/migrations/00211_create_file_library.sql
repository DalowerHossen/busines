-- supabase/migrations/00211_create_file_library.sql
-- The screens and the server layer that sit on top of stored files.
--
-- The tables, the upload sessions and the quotas already exist. What is
-- missing is everything the application needs to work with them safely: a
-- way to list what a tenant holds, a way to see how much room is left, a way
-- to rename or remove one file, and a way for the trusted server layer to
-- read the credentials of a storage target so it can sign an upload. The
-- credentials are the sensitive part, so exactly one function returns them
-- and only the service role may call it.

-- -----------------------------------------------------------------------------
-- What a tenant holds
-- -----------------------------------------------------------------------------

create or replace function public.company_files(
  p_company_id uuid,
  p_purpose text default null,
  p_search text default null,
  p_limit integer default 60
)
returns table (
  file_id uuid,
  file_name text,
  mime_type text,
  byte_size bigint,
  file_purpose text,
  visibility text,
  owner_type text,
  owner_id uuid,
  version smallint,
  is_current boolean,
  storage_tier text,
  scan_status text,
  alt_text text,
  access_count integer,
  uploaded_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You do not have permission to read these files'
      using errcode = '42501';
  end if;

  return query
    select f.id,
           f.file_name,
           f.mime_type,
           f.byte_size,
           f.file_purpose,
           f.visibility::text,
           f.owner_type,
           f.owner_id,
           f.version,
           f.is_current,
           f.storage_tier,
           f.scan_status,
           f.alt_text,
           f.access_count,
           f.uploaded_at,
           f.created_at
      from public.files as f
     where f.company_id = p_company_id
       and f.deleted_at is null
       and f.purged_at is null
       and (p_purpose is null or f.file_purpose = p_purpose)
       and (
         p_search is null
         or btrim(p_search) = ''
         or f.file_name ilike '%' || btrim(p_search) || '%'
       )
     order by f.created_at desc
     limit greatest(coalesce(p_limit, 60), 1);
end;
$$;

comment on function public.company_files(uuid, text, text, integer) is
  'Lists the files of a tenant, newest first, optionally filtered.';

-- One row of numbers for the storage screen.
create or replace function public.company_storage_summary(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_quota bigint;
  v_used bigint;
  v_count integer;
  v_archived integer;
  v_orphans integer;
  v_open_uploads integer;
begin
  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You do not have permission to read this storage'
      using errcode = '42501';
  end if;

  v_quota := public.storage_quota_bytes(p_company_id);

  select coalesce(sum(f.byte_size), 0)::bigint,
         count(*)::integer,
         (count(*) filter (where f.storage_tier <> 'hot'))::int,
         (count(*) filter (where f.owner_id is null))::int
    into v_used, v_count, v_archived, v_orphans
    from public.files as f
   where f.company_id = p_company_id
     and f.deleted_at is null
     and f.purged_at is null;

  select (count(*) filter (where u.status in ('pending', 'uploading')))::int
    into v_open_uploads
    from public.upload_sessions as u
   where u.company_id = p_company_id;

  return jsonb_build_object(
    'quota_bytes', coalesce(v_quota, 0),
    'used_bytes', coalesce(v_used, 0),
    'file_count', coalesce(v_count, 0),
    'archived_count', coalesce(v_archived, 0),
    'orphan_count', coalesce(v_orphans, 0),
    'open_upload_count', coalesce(v_open_uploads, 0),
    'used_percentage',
      case
        when coalesce(v_quota, 0) = 0 then 0
        else round(100.0 * coalesce(v_used, 0) / v_quota, 2)
      end
  );
end;
$$;

comment on function public.company_storage_summary(uuid) is
  'Reports what a tenant is storing and how much of its allowance is gone.';

-- Who opened one file, which is the part an auditor asks for.
create or replace function public.file_access_history(
  p_file_id uuid,
  p_limit integer default 50
)
returns table (
  entry_id uuid,
  action text,
  actor_user_id uuid,
  was_allowed boolean,
  denial_reason text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  -- A removed file still has a trail, so this lookup ignores the removal.
  select f.company_id into v_company_id
    from public.files as f
   where f.id = p_file_id;

  if v_company_id is null then
    raise exception 'That file was not found' using errcode = 'P0002';
  end if;

  if not (public.is_service_role() or public.has_company_access(v_company_id)) then
    raise exception 'You do not have permission to read this trail'
      using errcode = '42501';
  end if;

  return query
    select l.id,
           l.action,
           l.actor_user_id,
           l.was_allowed,
           l.denial_reason,
           l.created_at
      from public.file_access_logs as l
     where l.file_id = p_file_id
     order by l.created_at desc
     limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

comment on function public.file_access_history(uuid, integer) is
  'Returns who opened one file and whether they were allowed to.';

-- -----------------------------------------------------------------------------
-- Changing one file
-- -----------------------------------------------------------------------------

create or replace function public.describe_file(p_file_id uuid)
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
  select * into v_file
    from public.files
   where id = p_file_id
     and deleted_at is null;

  if not found then
    raise exception 'That file was not found' using errcode = 'P0002';
  end if;

  if v_file.company_id is not null
     and not (public.is_service_role()
              or public.has_company_access(v_file.company_id)) then
    raise exception 'You do not have permission to read this file'
      using errcode = '42501';
  end if;

  select * into v_target
    from public.storage_targets
   where id = v_file.storage_target_id;

  return jsonb_build_object(
    'file_id', v_file.id,
    'company_id', v_file.company_id,
    'storage_key', v_file.storage_key,
    'file_name', v_file.file_name,
    'mime_type', v_file.mime_type,
    'byte_size', v_file.byte_size,
    'file_purpose', v_file.file_purpose,
    'visibility', v_file.visibility::text,
    'purged_at', v_file.purged_at,
    'provider', coalesce(v_target.provider::text, 'local_disk'),
    'bucket_name', v_target.bucket_name,
    'region', v_target.region,
    'endpoint_url', v_target.endpoint_url,
    'public_base_url', v_target.public_base_url,
    'force_path_style', coalesce(v_target.force_path_style, false),
    'signed_url_ttl_seconds', coalesce(v_target.signed_url_ttl_seconds, 900)
  );
end;
$$;

comment on function public.describe_file(uuid) is
  'Returns one file with the delivery settings of the store it lives in.';

create or replace function public.rename_file(
  p_file_id uuid,
  p_file_name text,
  p_alt_text text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id
    from public.files
   where id = p_file_id
     and deleted_at is null;

  if v_company_id is null then
    raise exception 'That file was not found' using errcode = 'P0002';
  end if;

  if not (public.is_service_role()
          or public.can_write_company_data(v_company_id)) then
    raise exception 'You do not have permission to change this file'
      using errcode = '42501';
  end if;

  if coalesce(btrim(p_file_name), '') = '' then
    raise exception 'A file needs a name' using errcode = '22023';
  end if;

  update public.files
     set file_name = btrim(p_file_name),
         alt_text = nullif(btrim(coalesce(p_alt_text, '')), ''),
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_file_id;

  return true;
end;
$$;

comment on function public.rename_file(uuid, text, text) is
  'Renames a file and sets the wording a screen reader will announce.';

-- Takes a file out of the library without destroying the evidence that it
-- existed. The object itself is removed later by the purge routine.
create or replace function public.delete_file(
  p_file_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_file public.files%rowtype;
begin
  select * into v_file
    from public.files
   where id = p_file_id
     and deleted_at is null;

  if not found then
    raise exception 'That file was not found' using errcode = 'P0002';
  end if;

  if not (public.is_service_role()
          or public.can_write_company_data(v_file.company_id)) then
    raise exception 'You do not have permission to remove this file'
      using errcode = '42501';
  end if;

  if v_file.file_purpose in ('invoice_pdf', 'kyc_document', 'contract') then
    raise exception 'Files of this kind are kept as a record and cannot be removed'
      using errcode = '22023';
  end if;

  update public.files
     set deleted_at = now(),
         is_current = false,
         updated_at = now(),
         updated_by = public.current_user_id(),
         metadata = metadata || jsonb_build_object(
           'removal_reason', coalesce(nullif(btrim(coalesce(p_reason, '')), ''),
                                      'Removed from the file library')
         )
   where id = p_file_id;

  insert into public.file_access_logs (
    company_id, file_id, action, actor_user_id, was_allowed
  )
  values (
    v_file.company_id, p_file_id, 'delete', public.current_user_id(), true
  );

  perform public.recalculate_storage_usage(v_file.company_id);

  return true;
end;
$$;

comment on function public.delete_file(uuid, text) is
  'Soft deletes a file, refusing the kinds that have to be kept as a record.';

-- -----------------------------------------------------------------------------
-- What the upload layer needs
-- -----------------------------------------------------------------------------

-- Returns the target an upload session writes to, credentials included. This
-- is the only route to the credentials and it is closed to everyone except
-- the trusted server layer.
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

comment on function public.upload_session_target(uuid) is
  'Returns the storage settings and credentials behind one upload session.';

-- The same credentials, reached from a file rather than an upload, so a
-- download can be signed.
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
    'file_name', v_file.file_name,
    'mime_type', v_file.mime_type,
    'purged_at', v_file.purged_at,
    'target_id', v_target.id,
    'provider', v_target.provider::text,
    'bucket_name', v_target.bucket_name,
    'region', v_target.region,
    'endpoint_url', v_target.endpoint_url,
    'public_base_url', v_target.public_base_url,
    'force_path_style', v_target.force_path_style,
    'signed_url_ttl_seconds', v_target.signed_url_ttl_seconds,
    'credentials_encrypted', v_target.credentials_encrypted,
    'previous_credentials_encrypted', v_target.previous_credentials_encrypted,
    'previous_credentials_valid_until', v_target.previous_credentials_valid_until
  );
end;
$$;

comment on function public.file_storage_target(uuid) is
  'Returns the storage settings and credentials behind one stored file.';

-- What the browser is allowed to know before it picks a file: the size limit
-- and the types that will be accepted, never a credential.
create or replace function public.storage_upload_policy(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_target public.storage_targets%rowtype;
begin
  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You do not have permission to upload for this account'
      using errcode = '42501';
  end if;

  select * into v_target
    from public.storage_targets
   where id = public.resolve_storage_target(p_company_id);

  if not found then
    raise exception 'No storage has been configured' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'provider', v_target.provider::text,
    'max_upload_bytes', v_target.max_upload_bytes,
    'allowed_mime_types', to_jsonb(v_target.allowed_mime_types),
    'signed_url_ttl_seconds', v_target.signed_url_ttl_seconds,
    'is_configured', v_target.credentials_encrypted is not null
                     or v_target.provider = 'local_disk'
  );
end;
$$;

comment on function public.storage_upload_policy(uuid) is
  'Tells the browser what it may upload before it asks for a session.';

-- -----------------------------------------------------------------------------
-- Running the stores themselves
-- -----------------------------------------------------------------------------

create or replace function public.platform_storage_targets()
returns table (
  target_id uuid,
  company_id uuid,
  name text,
  provider text,
  is_default boolean,
  is_active boolean,
  bucket_name text,
  region text,
  endpoint_url text,
  path_prefix text,
  public_base_url text,
  force_path_style boolean,
  signed_url_ttl_seconds integer,
  max_upload_bytes bigint,
  has_credentials boolean,
  credentials_fingerprint text,
  last_used_at timestamptz,
  last_verified_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  file_count integer,
  stored_bytes bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may read the storage settings'
      using errcode = '42501';
  end if;

  return query
    select t.id,
           t.company_id,
           t.name,
           t.provider::text,
           t.is_default,
           t.is_active,
           t.bucket_name,
           t.region,
           t.endpoint_url,
           t.path_prefix,
           t.public_base_url,
           t.force_path_style,
           t.signed_url_ttl_seconds,
           t.max_upload_bytes,
           t.credentials_encrypted is not null,
           t.credentials_fingerprint,
           t.last_used_at,
           t.last_verified_at,
           t.last_error,
           t.last_error_at,
           coalesce(f.file_count, 0)::int,
           coalesce(f.stored_bytes, 0)::bigint
      from public.storage_targets as t
      left join lateral (
        select count(*)::int as file_count,
               coalesce(sum(byte_size), 0)::bigint as stored_bytes
          from public.files
         where storage_target_id = t.id
           and deleted_at is null
           and purged_at is null
      ) as f on true
     where t.deleted_at is null
     order by t.company_id nulls first, t.is_default desc, t.created_at;
end;
$$;

comment on function public.platform_storage_targets() is
  'Lists every configured store with its health and what it is holding.';

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
                        'wasabi', 'local_disk') then
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

comment on function public.save_storage_target(
  text, text, text, uuid, text, text, text, text, boolean, integer, bigint,
  boolean, boolean
) is 'Creates or edits a platform wide storage target.';

-- Rotating the keys of a store. The replaced pair keeps working for a short
-- grace period so an upload already in flight is never dropped.
create or replace function public.set_storage_target_credentials(
  p_target_id uuid,
  p_credentials_encrypted text,
  p_fingerprint text,
  p_grace_minutes integer default 5
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may change the storage keys'
      using errcode = '42501';
  end if;

  update public.storage_targets
     set previous_credentials_encrypted = credentials_encrypted,
         previous_credentials_valid_until =
           case
             when credentials_encrypted is null then null
             else now() + make_interval(mins => greatest(coalesce(p_grace_minutes, 5), 1))
           end,
         credentials_encrypted = p_credentials_encrypted,
         credentials_fingerprint = p_fingerprint,
         credentials_key_version = credentials_key_version + 1,
         last_error = null,
         last_error_at = null,
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_target_id
     and deleted_at is null;

  if not found then
    raise exception 'That store was not found' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

comment on function public.set_storage_target_credentials(uuid, text, text, integer) is
  'Stores new storage keys, keeping the old pair alive for a short grace period.';

create or replace function public.record_storage_target_health(
  p_target_id uuid,
  p_succeeded boolean,
  p_message text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  update public.storage_targets
     set last_verified_at = case when p_succeeded then now() else last_verified_at end,
         last_error = case when p_succeeded then null
                           else left(coalesce(p_message, 'The store could not be reached'), 500)
                      end,
         last_error_at = case when p_succeeded then null else now() end,
         updated_at = now()
   where id = p_target_id
     and deleted_at is null;

  return found;
end;
$$;

comment on function public.record_storage_target_health(uuid, boolean, text) is
  'Writes down whether the last call to a store worked.';

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.company_files(uuid, text, text, integer)
  from public, authenticated;
revoke execute on function public.company_storage_summary(uuid)
  from public, authenticated;
revoke execute on function public.file_access_history(uuid, integer)
  from public, authenticated;
revoke execute on function public.describe_file(uuid)
  from public, authenticated;
revoke execute on function public.rename_file(uuid, text, text)
  from public, authenticated;
revoke execute on function public.delete_file(uuid, text)
  from public, authenticated;
revoke execute on function public.upload_session_target(uuid)
  from public, authenticated;
revoke execute on function public.file_storage_target(uuid)
  from public, authenticated;
revoke execute on function public.storage_upload_policy(uuid)
  from public, authenticated;
revoke execute on function public.platform_storage_targets()
  from public, authenticated;
revoke execute on function public.save_storage_target(
  text, text, text, uuid, text, text, text, text, boolean, integer, bigint,
  boolean, boolean
) from public, authenticated;
revoke execute on function public.set_storage_target_credentials(
  uuid, text, text, integer
) from public, authenticated;
revoke execute on function public.record_storage_target_health(uuid, boolean, text)
  from public, authenticated;

grant execute on function public.company_files(uuid, text, text, integer)
  to authenticated, service_role;
grant execute on function public.company_storage_summary(uuid)
  to authenticated, service_role;
grant execute on function public.file_access_history(uuid, integer)
  to authenticated, service_role;
grant execute on function public.describe_file(uuid)
  to authenticated, service_role;
grant execute on function public.rename_file(uuid, text, text)
  to authenticated, service_role;
grant execute on function public.delete_file(uuid, text)
  to authenticated, service_role;
grant execute on function public.upload_session_target(uuid) to service_role;
grant execute on function public.file_storage_target(uuid) to service_role;
grant execute on function public.storage_upload_policy(uuid)
  to authenticated, service_role;
grant execute on function public.platform_storage_targets()
  to authenticated, service_role;
grant execute on function public.save_storage_target(
  text, text, text, uuid, text, text, text, text, boolean, integer, bigint,
  boolean, boolean
) to authenticated, service_role;
grant execute on function public.set_storage_target_credentials(
  uuid, text, text, integer
) to authenticated, service_role;
grant execute on function public.record_storage_target_health(uuid, boolean, text)
  to authenticated, service_role;

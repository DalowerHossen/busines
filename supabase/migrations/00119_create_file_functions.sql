-- supabase/migrations/00119_create_file_functions.sql
-- Attaching, versioning, reading and retiring files.
--
-- A file is cheap to create and expensive to lose track of, so everything
-- here is about keeping the register truthful: what a file belongs to, which
-- version is current, who read it, and what may safely be deleted.

-- Registers a file the server already wrote, for the paths that do not go
-- through a browser upload, such as a generated invoice PDF.
create or replace function public.register_file(
  p_company_id uuid,
  p_storage_key text,
  p_file_name text,
  p_mime_type text,
  p_byte_size bigint,
  p_file_purpose text default 'attachment',
  p_owner_type text default null,
  p_owner_id uuid default null,
  p_content_hash text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_file_id uuid;
begin
  insert into public.files (
    company_id, storage_target_id, storage_key, file_name, original_file_name,
    mime_type, byte_size, content_hash, file_purpose, owner_type, owner_id,
    uploaded_at, created_by
  )
  values (
    p_company_id, public.resolve_storage_target(p_company_id), p_storage_key,
    p_file_name, p_file_name, p_mime_type, coalesce(p_byte_size, 0),
    p_content_hash, p_file_purpose, p_owner_type, p_owner_id, now(),
    public.current_user_id()
  )
  returning id into v_file_id;

  if p_company_id is not null then
    perform public.recalculate_storage_usage(p_company_id);
  end if;

  return v_file_id;
end;
$$;

comment on function public.register_file(
  uuid, text, text, text, bigint, text, text, uuid, text
) is 'Records a file the server wrote directly into storage.';

-- Ties a loose file to the record it belongs to, which is what takes it out
-- of the orphan queue.
create or replace function public.attach_file(
  p_file_id uuid,
  p_owner_type text,
  p_owner_id uuid
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
  select * into v_file from public.files where id = p_file_id and deleted_at is null;

  if not found then
    raise exception 'File % was not found', p_file_id using errcode = 'P0002';
  end if;

  if v_file.company_id is not null
     and not (public.is_service_role()
              or public.can_write_company_data(v_file.company_id)) then
    raise exception 'You do not have permission to use this file'
      using errcode = '42501';
  end if;

  update public.files
     set owner_type = p_owner_type,
         owner_id = p_owner_id,
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_file_id;

  return true;
end;
$$;

comment on function public.attach_file(uuid, text, uuid) is
  'Attaches an uploaded file to the record it belongs to.';

-- Replaces a file with a newer upload while keeping the old one readable.
-- Nothing is overwritten in the store, because the previous version is often
-- the one somebody needs to prove a point with.
create or replace function public.create_file_version(
  p_file_id uuid,
  p_storage_key text,
  p_file_name text,
  p_byte_size bigint,
  p_content_hash text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_current public.files%rowtype;
  v_new_id uuid;
begin
  select * into v_current
    from public.files
   where id = p_file_id and deleted_at is null for update;

  if not found then
    raise exception 'File % was not found', p_file_id using errcode = 'P0002';
  end if;

  if v_current.company_id is not null
     and not (public.is_service_role()
              or public.can_write_company_data(v_current.company_id)) then
    raise exception 'You do not have permission to replace this file'
      using errcode = '42501';
  end if;

  if v_current.version >= 999 then
    raise exception 'This file has been replaced too many times'
      using errcode = '22023';
  end if;

  insert into public.files (
    company_id, storage_target_id, storage_key, file_name, original_file_name,
    mime_type, byte_size, content_hash, file_purpose, visibility, owner_type,
    owner_id, version, replaces_file_id, is_current, uploaded_at, created_by
  )
  values (
    v_current.company_id, v_current.storage_target_id, p_storage_key,
    p_file_name, p_file_name, v_current.mime_type, coalesce(p_byte_size, 0),
    p_content_hash, v_current.file_purpose, v_current.visibility,
    v_current.owner_type, v_current.owner_id, (v_current.version + 1)::smallint,
    p_file_id, true, now(), public.current_user_id()
  )
  returning id into v_new_id;

  update public.files
     set is_current = false, updated_at = now()
   where id = p_file_id;

  if v_current.company_id is not null then
    perform public.recalculate_storage_usage(v_current.company_id);
  end if;

  return v_new_id;
end;
$$;

comment on function public.create_file_version(uuid, text, text, bigint, text) is
  'Adds a newer version of a file and keeps the previous one readable.';

-- Records a read. Sensitive documents need to show who looked at them, so
-- this is called on every signed URL and every download.
create or replace function public.record_file_access(
  p_file_id uuid,
  p_action text default 'download',
  p_document_link_id uuid default null,
  p_ip_hash text default null,
  p_user_agent text default null,
  p_was_allowed boolean default true,
  p_denial_reason text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_log_id uuid;
begin
  select company_id into v_company_id from public.files where id = p_file_id;

  insert into public.file_access_logs (
    company_id, file_id, action, actor_user_id, document_link_id, ip_hash,
    user_agent, was_allowed, denial_reason
  )
  values (
    v_company_id, p_file_id, p_action, public.current_user_id(),
    p_document_link_id, p_ip_hash, p_user_agent, p_was_allowed, p_denial_reason
  )
  returning id into v_log_id;

  if p_was_allowed then
    update public.files
       set access_count = access_count + 1,
           last_accessed_at = now()
     where id = p_file_id;
  end if;

  return v_log_id;
end;
$$;

comment on function public.record_file_access(
  uuid, text, uuid, text, text, boolean, text
) is 'Writes the read trail entry for one access to a file.';

-- Moves files nobody has touched for a long time to the cheap tier.
create or replace function public.archive_cold_files(
  p_older_than_days integer default 365,
  p_limit integer default 500
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  with cold as (
    select id
      from public.files
     where deleted_at is null
       and purged_at is null
       and storage_tier = 'hot'
       and file_purpose in ('attachment', 'receipt', 'import', 'export',
                            'backup', 'invoice_pdf')
       and coalesce(last_accessed_at, uploaded_at, created_at)
           < now() - make_interval(days => greatest(p_older_than_days, 30))
     order by coalesce(last_accessed_at, created_at)
     limit greatest(coalesce(p_limit, 500), 1)
  )
  update public.files as f
     set storage_tier = 'archive',
         archived_at = now(),
         updated_at = now()
    from cold
   where f.id = cold.id;

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

comment on function public.archive_cold_files(integer, integer) is
  'Moves files nobody has opened in a long time to the archive tier.';

-- Lists files that were uploaded and never attached to anything. The job
-- that deletes the objects reads this, never a guess.
create or replace function public.orphaned_files(
  p_older_than_hours integer default 24,
  p_limit integer default 500
)
returns table (
  file_id uuid,
  company_id uuid,
  storage_key text,
  byte_size bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id, company_id, storage_key, byte_size, created_at
    from public.files
   where deleted_at is null
     and purged_at is null
     and owner_id is null
     and file_purpose not in ('logo', 'avatar', 'marketing_asset', 'email_asset')
     and created_at < now() - make_interval(hours => greatest(p_older_than_hours, 1))
   order by created_at
   limit greatest(coalesce(p_limit, 500), 1);
$$;

comment on function public.orphaned_files(integer, integer) is
  'Lists uploads that were never attached to a record and can be deleted.';

-- Marks the object as gone while the record stays. A file may be referenced
-- by an audit entry long after the bytes are no longer needed.
create or replace function public.purge_file(
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
  select * into v_file from public.files where id = p_file_id for update;

  if not found then
    return false;
  end if;

  if not (public.is_service_role()
          or v_file.company_id is null
          or public.can_write_company_data(v_file.company_id)) then
    raise exception 'You do not have permission to delete this file'
      using errcode = '42501';
  end if;

  if v_file.purged_at is not null then
    return false;
  end if;

  update public.files
     set purged_at = now(),
         deleted_at = coalesce(deleted_at, now()),
         metadata = metadata || jsonb_build_object(
           'purge_reason', coalesce(p_reason, 'No longer needed')
         ),
         updated_at = now()
   where id = p_file_id;

  if v_file.company_id is not null then
    perform public.recalculate_storage_usage(v_file.company_id);
  end if;

  return true;
end;
$$;

comment on function public.purge_file(uuid, text) is
  'Marks a stored object as deleted while keeping its record as evidence.';

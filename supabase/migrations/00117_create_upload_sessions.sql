-- supabase/migrations/00117_create_upload_sessions.sql
-- Direct and resumable uploads.
--
-- Bytes never pass through the application server: the browser is handed a
-- short lived signed instruction and uploads straight to the store. The
-- session row is what makes that safe, because it records in advance exactly
-- what was agreed to and the completion is checked against it.

create table public.upload_sessions (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,
  storage_target_id uuid,

  storage_key text not null,
  file_name text not null,
  mime_type text not null,
  declared_byte_size bigint not null default 0,
  file_purpose text not null default 'attachment',
  owner_type text,
  owner_id uuid,

  status text not null default 'pending',
  -- Multipart state for a resumable upload.
  is_multipart boolean not null default false,
  provider_upload_id text,
  part_size_bytes integer,
  total_parts integer,
  completed_parts integer not null default 0,
  received_byte_size bigint not null default 0,

  file_id uuid,
  content_hash text,
  failure_reason text,

  requested_by uuid,
  client_ip_hash text,
  expires_at timestamptz not null default now() + interval '2 hours',
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint upload_sessions_name_check
    check (length(btrim(file_name)) between 1 and 255),
  constraint upload_sessions_size_check
    check (declared_byte_size >= 0 and received_byte_size >= 0),
  constraint upload_sessions_status_check
    check (status in ('pending', 'uploading', 'completed', 'expired',
                      'aborted', 'failed')),
  constraint upload_sessions_parts_check
    check (not is_multipart
           or (part_size_bytes >= 5242880 and total_parts between 1 and 10000)),
  constraint upload_sessions_completed_parts_check
    check (completed_parts >= 0
           and (total_parts is null or completed_parts <= total_parts)),
  constraint upload_sessions_hash_check
    check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),
  constraint upload_sessions_completed_check
    check (status <> 'completed' or file_id is not null),
  constraint upload_sessions_failed_check
    check (status <> 'failed' or failure_reason is not null)
);

comment on table public.upload_sessions is
  'An agreed, time limited permission for a browser to upload one object.';

create unique index upload_sessions_key_unique
  on public.upload_sessions (storage_key);

create index upload_sessions_company_idx
  on public.upload_sessions (company_id, created_at desc);

create index upload_sessions_open_idx
  on public.upload_sessions (expires_at)
  where status in ('pending', 'uploading');

-- -----------------------------------------------------------------------------
-- Starting, finishing and abandoning an upload
-- -----------------------------------------------------------------------------

-- Opens a session. The checks that matter happen here, before any byte is
-- accepted: the type must be allowed, the size must be within the limit of
-- the target, and the tenant must still have room.
create or replace function public.begin_upload_session(
  p_company_id uuid,
  p_file_name text,
  p_mime_type text,
  p_byte_size bigint,
  p_file_purpose text default 'attachment',
  p_owner_type text default null,
  p_owner_id uuid default null,
  p_is_multipart boolean default false
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_target public.storage_targets%rowtype;
  v_key text;
  v_session_id uuid;
  v_part_size integer;
begin
  if p_company_id is not null
     and not (public.is_service_role()
              or public.can_write_company_data(p_company_id)) then
    raise exception 'You do not have permission to upload for this account'
      using errcode = '42501';
  end if;

  if coalesce(btrim(p_file_name), '') = '' then
    raise exception 'A file needs a name' using errcode = '22023';
  end if;

  select * into v_target
    from public.storage_targets
   where id = public.resolve_storage_target(p_company_id);

  if not found then
    raise exception 'No storage has been configured' using errcode = '22023';
  end if;

  if p_byte_size > v_target.max_upload_bytes then
    raise exception 'That file is larger than the % byte limit',
      v_target.max_upload_bytes using errcode = '22023';
  end if;

  if not (p_mime_type = any (v_target.allowed_mime_types)) then
    raise exception 'Files of type % are not accepted', p_mime_type
      using errcode = '22023';
  end if;

  if p_company_id is not null
     and not public.storage_quota_allows(p_company_id, p_byte_size) then
    raise exception 'This account has used all of its storage'
      using errcode = '53100';
  end if;

  v_key := public.build_storage_key(p_company_id, p_file_purpose, p_file_name);
  v_part_size := case when p_is_multipart then 8388608 else null end;

  insert into public.upload_sessions (
    company_id, storage_target_id, storage_key, file_name, mime_type,
    declared_byte_size, file_purpose, owner_type, owner_id, is_multipart,
    part_size_bytes, total_parts, requested_by
  )
  values (
    p_company_id, v_target.id, v_key, p_file_name, p_mime_type,
    coalesce(p_byte_size, 0), p_file_purpose, p_owner_type, p_owner_id,
    p_is_multipart, v_part_size,
    case
      when p_is_multipart
        then greatest(ceil(coalesce(p_byte_size, 1)::numeric / v_part_size)::integer, 1)
      else null
    end,
    public.current_user_id()
  )
  returning id into v_session_id;

  return v_session_id;
end;
$$;

comment on function public.begin_upload_session(
  uuid, text, text, bigint, text, text, uuid, boolean
) is 'Agrees an upload in advance and returns the session to upload against.';

-- Turns a finished upload into a file. Identical content that the tenant
-- already holds is reused rather than registered twice.
create or replace function public.complete_upload_session(
  p_session_id uuid,
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
  v_session public.upload_sessions%rowtype;
  v_existing public.files%rowtype;
  v_file_id uuid;
begin
  select * into v_session
    from public.upload_sessions
   where id = p_session_id for update;

  if not found then
    raise exception 'Upload session % was not found', p_session_id
      using errcode = 'P0002';
  end if;

  if v_session.status = 'completed' then
    return v_session.file_id;
  end if;

  if v_session.status not in ('pending', 'uploading') then
    raise exception 'This upload is no longer open' using errcode = '22023';
  end if;

  if v_session.expires_at <= now() then
    update public.upload_sessions
       set status = 'expired', updated_at = now()
     where id = p_session_id;

    raise exception 'This upload took too long and has expired'
      using errcode = '22023';
  end if;

  -- The same bytes already held by this tenant are not stored again.
  if p_content_hash is not null and v_session.company_id is not null then
    select * into v_existing
      from public.files
     where company_id = v_session.company_id
       and content_hash = p_content_hash
       and deleted_at is null
       and purged_at is null
     order by created_at
     limit 1;
  end if;

  if v_existing.id is not null then
    v_file_id := v_existing.id;
  else
    insert into public.files (
      company_id, storage_target_id, storage_key, file_name,
      original_file_name, mime_type, byte_size, content_hash, file_purpose,
      owner_type, owner_id, uploaded_at, created_by
    )
    values (
      v_session.company_id, v_session.storage_target_id, v_session.storage_key,
      v_session.file_name, v_session.file_name, v_session.mime_type,
      coalesce(p_byte_size, v_session.declared_byte_size), p_content_hash,
      v_session.file_purpose, v_session.owner_type, v_session.owner_id,
      now(), v_session.requested_by
    )
    returning id into v_file_id;
  end if;

  update public.upload_sessions
     set status = 'completed',
         received_byte_size = coalesce(p_byte_size, declared_byte_size),
         content_hash = p_content_hash,
         file_id = v_file_id,
         completed_at = now(),
         updated_at = now()
   where id = p_session_id;

  update public.storage_targets
     set last_used_at = now(), updated_at = now()
   where id = v_session.storage_target_id;

  return v_file_id;
end;
$$;

comment on function public.complete_upload_session(uuid, bigint, text) is
  'Registers a finished upload, reusing the record when the bytes already exist.';

-- Gives up on an upload, either because the person cancelled or because the
-- session sat unused.
create or replace function public.abort_upload_session(
  p_session_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  update public.upload_sessions
     set status = 'aborted',
         failure_reason = coalesce(p_reason, 'The upload was cancelled'),
         updated_at = now()
   where id = p_session_id
     and status in ('pending', 'uploading');

  return found;
end;
$$;

comment on function public.abort_upload_session(uuid, text) is
  'Closes an upload that will never finish.';

-- Housekeeping for sessions nobody came back to.
create or replace function public.expire_stale_upload_sessions()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.upload_sessions
     set status = 'expired', updated_at = now()
   where status in ('pending', 'uploading')
     and expires_at <= now();

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

comment on function public.expire_stale_upload_sessions() is
  'Expires upload sessions that were opened and never completed.';

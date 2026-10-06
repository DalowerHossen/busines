-- supabase/migrations/00011_create_soft_delete_helpers.sql
-- Soft delete, restore and retention helpers.
--
-- No business row is ever removed physically during normal operation. Rows are
-- marked with deleted_at, remain visible to the audit trail, and are purged only
-- by the retention job after the configured period.

-- Marks a single row as deleted.
create or replace function public.soft_delete_record(
  p_table text,
  p_id uuid,
  p_schema text default 'public'
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  if p_table is null or p_id is null then
    raise exception 'A table name and row identifier are required'
      using errcode = '22023';
  end if;

  execute format(
    'update %I.%I
        set deleted_at = now()
      where id = $1
        and deleted_at is null',
    p_schema, p_table
  )
  using p_id;

  get diagnostics v_updated = row_count;

  return v_updated > 0;
end;
$$;

comment on function public.soft_delete_record(text, uuid, text) is
  'Marks a row as deleted without removing it from the table.';

-- Restores a previously soft deleted row.
create or replace function public.restore_record(
  p_table text,
  p_id uuid,
  p_schema text default 'public'
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  if p_table is null or p_id is null then
    raise exception 'A table name and row identifier are required'
      using errcode = '22023';
  end if;

  execute format(
    'update %I.%I
        set deleted_at = null
      where id = $1
        and deleted_at is not null',
    p_schema, p_table
  )
  using p_id;

  get diagnostics v_updated = row_count;

  return v_updated > 0;
end;
$$;

comment on function public.restore_record(text, uuid, text) is
  'Restores a soft deleted row by clearing deleted_at.';

-- Permanently removes rows that passed the retention window.
-- Only the service role may call this function, and every purge is reported.
create or replace function public.purge_deleted_records(
  p_table text,
  p_retention_days integer default 90,
  p_schema text default 'public'
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  if not public.is_service_role() then
    raise exception 'Only the service role may purge deleted records'
      using errcode = '42501';
  end if;

  if p_retention_days is null or p_retention_days < 30 then
    raise exception 'The retention window must be at least 30 days, received %', p_retention_days
      using errcode = '22023';
  end if;

  execute format(
    'delete from %I.%I
      where deleted_at is not null
        and deleted_at < now() - make_interval(days => $1)',
    p_schema, p_table
  )
  using p_retention_days;

  get diagnostics v_deleted = row_count;

  return v_deleted;
end;
$$;

comment on function public.purge_deleted_records(text, integer, text) is
  'Physically removes rows whose retention window has expired.';

-- Reports how many live and deleted rows a table holds, used by the admin
-- storage and retention dashboards.
create or replace function public.count_table_rows(
  p_table text,
  p_schema text default 'public'
)
returns table (live_rows bigint, deleted_rows bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_super_admin() and not public.is_service_role() then
    raise exception 'Only a super administrator may inspect table counts'
      using errcode = '42501';
  end if;

  return query execute format(
    'select count(*) filter (where deleted_at is null)::bigint,
            count(*) filter (where deleted_at is not null)::bigint
       from %I.%I',
    p_schema, p_table
  );
end;
$$;

comment on function public.count_table_rows(text, text) is
  'Returns the live and soft deleted row counts for a table.';

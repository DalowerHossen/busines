-- supabase/migrations/00008_create_timestamp_triggers.sql
-- Automatic timestamp maintenance and soft delete protection.

-- Keeps updated_at accurate on every write and prevents a client from forging
-- the value. created_at is immutable once a row exists.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();

  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;

  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger function that maintains updated_at and protects created_at.';

-- Records who performed the most recent write, when the table carries the
-- optional created_by and updated_by columns.
create or replace function public.set_actor_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.current_user_id();
begin
  if tg_op = 'INSERT' then
    if to_jsonb(new) ? 'created_by' and new.created_by is null then
      new.created_by := v_user_id;
    end if;
  end if;

  if to_jsonb(new) ? 'updated_by' then
    new.updated_by := v_user_id;
  end if;

  return new;
end;
$$;

comment on function public.set_actor_columns() is
  'Trigger function that stamps created_by and updated_by with the caller.';

-- Blocks physical deletes on tables that must keep a permanent history.
-- Rows are removed by setting deleted_at instead.
create or replace function public.block_hard_delete()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if public.is_service_role() then
    return old;
  end if;

  raise exception 'Hard delete is not allowed on %. Set deleted_at instead.', tg_table_name
    using errcode = '42501';
end;
$$;

comment on function public.block_hard_delete() is
  'Trigger function that prevents physical deletes on audited tables.';

-- Prevents a soft deleted row from being modified, except to restore it.
create or replace function public.block_update_of_deleted_row()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.deleted_at is not null and new.deleted_at is not null then
    raise exception 'Row % in % is deleted and cannot be modified.', old.id, tg_table_name
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.block_update_of_deleted_row() is
  'Trigger function that keeps soft deleted rows immutable until restored.';

-- -----------------------------------------------------------------------------
-- Trigger installation helpers
-- -----------------------------------------------------------------------------

-- Installs the updated_at trigger on a table.
create or replace function public.install_timestamp_trigger(
  p_table text,
  p_schema text default 'public'
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  execute format(
    'drop trigger if exists set_updated_at_trigger on %I.%I',
    p_schema, p_table
  );

  execute format(
    'create trigger set_updated_at_trigger
       before update on %I.%I
       for each row execute function public.set_updated_at()',
    p_schema, p_table
  );
end;
$$;

comment on function public.install_timestamp_trigger(text, text) is
  'Installs the updated_at maintenance trigger on the supplied table.';

-- Installs the created_by and updated_by trigger on a table.
create or replace function public.install_actor_trigger(
  p_table text,
  p_schema text default 'public'
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  execute format(
    'drop trigger if exists set_actor_columns_trigger on %I.%I',
    p_schema, p_table
  );

  execute format(
    'create trigger set_actor_columns_trigger
       before insert or update on %I.%I
       for each row execute function public.set_actor_columns()',
    p_schema, p_table
  );
end;
$$;

comment on function public.install_actor_trigger(text, text) is
  'Installs the created_by and updated_by stamping trigger on the supplied table.';

-- Installs the soft delete protection triggers on a table.
create or replace function public.install_soft_delete_guard(
  p_table text,
  p_schema text default 'public'
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  execute format(
    'drop trigger if exists block_hard_delete_trigger on %I.%I',
    p_schema, p_table
  );

  execute format(
    'create trigger block_hard_delete_trigger
       before delete on %I.%I
       for each row execute function public.block_hard_delete()',
    p_schema, p_table
  );

  execute format(
    'drop trigger if exists block_update_of_deleted_row_trigger on %I.%I',
    p_schema, p_table
  );

  execute format(
    'create trigger block_update_of_deleted_row_trigger
       before update on %I.%I
       for each row execute function public.block_update_of_deleted_row()',
    p_schema, p_table
  );
end;
$$;

comment on function public.install_soft_delete_guard(text, text) is
  'Installs the hard delete and deleted row protection triggers on a table.';

-- Installs the complete standard trigger set used by every business table.
create or replace function public.install_standard_triggers(
  p_table text,
  p_schema text default 'public'
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform public.install_timestamp_trigger(p_table, p_schema);
  perform public.install_actor_trigger(p_table, p_schema);
  perform public.install_soft_delete_guard(p_table, p_schema);
end;
$$;

comment on function public.install_standard_triggers(text, text) is
  'Installs timestamp, actor and soft delete triggers on a business table.';

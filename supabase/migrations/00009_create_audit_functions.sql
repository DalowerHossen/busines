-- supabase/migrations/00009_create_audit_functions.sql
-- Tamper evident audit logging.
--
-- Every audited write appends a row to public.audit_logs. Each row stores the
-- SHA-256 hash of its own payload combined with the hash of the previous row,
-- forming a chain. Removing or editing a historic row breaks the chain and is
-- detected by public.verify_audit_chain().

-- Returns the request context captured from the current connection settings.
create or replace function public.current_request_context()
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_strip_nulls(
    jsonb_build_object(
      'ip_address', nullif(current_setting('request.header.x-forwarded-for', true), ''),
      'user_agent', nullif(current_setting('request.header.user-agent', true), ''),
      'request_id', nullif(current_setting('request.header.x-request-id', true), ''),
      'impersonator_id', nullif(current_setting('app.impersonator_id', true), '')
    )
  );
$$;

comment on function public.current_request_context() is
  'Returns IP address, user agent, request id and impersonator from the request.';

-- Computes the chain hash for an audit entry.
create or replace function public.compute_audit_hash(
  p_previous_hash text,
  p_payload jsonb
)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select encode(
    extensions.digest(
      coalesce(p_previous_hash, 'genesis') || '|' || coalesce(p_payload::text, '{}'),
      'sha256'
    ),
    'hex'
  );
$$;

comment on function public.compute_audit_hash(text, jsonb) is
  'Computes the SHA-256 chain hash that links an audit entry to its predecessor.';

-- Removes values that must never be written to the audit trail.
create or replace function public.redact_sensitive_fields(p_data jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_result jsonb := coalesce(p_data, '{}'::jsonb);
  v_key text;
  v_sensitive_keys text[] := array[
    'password',
    'password_hash',
    'encrypted_password',
    'secret',
    'api_secret',
    'api_key',
    'access_token',
    'refresh_token',
    'private_key',
    'secret_key',
    'webhook_secret',
    'card_number',
    'cvv',
    'two_factor_secret',
    'recovery_codes',
    'smtp_password'
  ];
begin
  foreach v_key in array v_sensitive_keys loop
    if v_result ? v_key then
      v_result := jsonb_set(v_result, array[v_key], '"[redacted]"'::jsonb, false);
    end if;
  end loop;

  return v_result;
end;
$$;

comment on function public.redact_sensitive_fields(jsonb) is
  'Replaces secret and credential values with a redaction marker.';

-- Trigger function that writes an audit entry for every insert, update and
-- soft delete on an audited table.
create or replace function public.record_audit_entry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_action public.audit_action;
  v_old_data jsonb;
  v_new_data jsonb;
  v_company_id uuid;
  v_record_id uuid;
  v_previous_hash text;
  v_payload jsonb;
  v_context jsonb := public.current_request_context();
begin
  if tg_op = 'INSERT' then
    v_action := 'insert';
    v_new_data := public.redact_sensitive_fields(to_jsonb(new));
    v_old_data := null;
  elsif tg_op = 'UPDATE' then
    v_old_data := public.redact_sensitive_fields(to_jsonb(old));
    v_new_data := public.redact_sensitive_fields(to_jsonb(new));

    -- Tables without a deleted_at column simply record an update.
    if (v_old_data ? 'deleted_at')
       and v_old_data ->> 'deleted_at' is null
       and v_new_data ->> 'deleted_at' is not null then
      v_action := 'soft_delete';
    elsif (v_old_data ? 'deleted_at')
       and v_old_data ->> 'deleted_at' is not null
       and v_new_data ->> 'deleted_at' is null then
      v_action := 'restore';
    else
      v_action := 'update';
    end if;
  else
    v_action := 'hard_delete';
    v_old_data := public.redact_sensitive_fields(to_jsonb(old));
    v_new_data := null;
  end if;

  if tg_op = 'DELETE' then
    v_record_id := old.id;
    if to_jsonb(old) ? 'company_id' then
      v_company_id := (to_jsonb(old) ->> 'company_id')::uuid;
    end if;
  else
    v_record_id := new.id;
    if to_jsonb(new) ? 'company_id' then
      v_company_id := (to_jsonb(new) ->> 'company_id')::uuid;
    end if;
  end if;

  select chain_hash
    into v_previous_hash
    from public.audit_logs
   order by sequence_number desc
   limit 1;

  v_payload := jsonb_build_object(
    'table_name', tg_table_name,
    'record_id', v_record_id,
    'action', v_action::text,
    'company_id', v_company_id,
    'actor_id', public.current_user_id(),
    'old_data', v_old_data,
    'new_data', v_new_data,
    'occurred_at', now()
  );

  insert into public.audit_logs (
    company_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    context,
    previous_hash,
    chain_hash
  )
  values (
    v_company_id,
    public.current_user_id(),
    v_action,
    tg_table_name,
    v_record_id,
    v_old_data,
    v_new_data,
    v_context,
    v_previous_hash,
    public.compute_audit_hash(v_previous_hash, v_payload)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

comment on function public.record_audit_entry() is
  'Trigger function that appends a hash chained entry to the audit trail.';

-- Installs the audit trigger on a table.
create or replace function public.install_audit_trigger(
  p_table text,
  p_schema text default 'public'
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  execute format(
    'drop trigger if exists record_audit_entry_trigger on %I.%I',
    p_schema, p_table
  );

  execute format(
    'create trigger record_audit_entry_trigger
       after insert or update or delete on %I.%I
       for each row execute function public.record_audit_entry()',
    p_schema, p_table
  );
end;
$$;

comment on function public.install_audit_trigger(text, text) is
  'Installs the hash chained audit trigger on the supplied table.';

-- Verifies the integrity of the audit chain and returns the first broken link.
create or replace function public.verify_audit_chain(p_limit integer default 10000)
returns table (
  sequence_number bigint,
  entry_id uuid,
  is_valid boolean,
  expected_hash text,
  stored_hash text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_previous_hash text := null;
  v_payload jsonb;
  v_expected text;
begin
  for v_row in
    execute format(
      'select id, sequence_number, entity_type, entity_id, action, company_id,
              actor_id, old_data, new_data, created_at, previous_hash, chain_hash
         from public.audit_logs
        order by sequence_number asc
        limit %s',
      greatest(coalesce(p_limit, 10000), 1)
    )
  loop
    v_payload := jsonb_build_object(
      'table_name', v_row.entity_type,
      'record_id', v_row.entity_id,
      'action', v_row.action::text,
      'company_id', v_row.company_id,
      'actor_id', v_row.actor_id,
      'old_data', v_row.old_data,
      'new_data', v_row.new_data,
      'occurred_at', v_row.created_at
    );

    v_expected := public.compute_audit_hash(v_previous_hash, v_payload);

    sequence_number := v_row.sequence_number;
    entry_id := v_row.id;
    expected_hash := v_expected;
    stored_hash := v_row.chain_hash;
    is_valid := (v_expected = v_row.chain_hash)
                and (v_previous_hash is not distinct from v_row.previous_hash);

    return next;

    v_previous_hash := v_row.chain_hash;
  end loop;

  return;
end;
$$;

comment on function public.verify_audit_chain(integer) is
  'Recomputes the audit hash chain and reports every entry with its validity.';

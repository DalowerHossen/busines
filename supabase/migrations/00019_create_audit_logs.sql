-- supabase/migrations/00019_create_audit_logs.sql
-- Append only, hash chained audit trail.
--
-- Every audited write lands here through public.record_audit_entry(). The table
-- rejects updates and deletes outright, so the history cannot be rewritten from
-- the application, and public.verify_audit_chain() proves that no row was
-- altered or removed afterwards.

create table public.audit_logs (
  id uuid primary key default public.generate_uuid_v7(),

  -- Strictly increasing order, used to walk the hash chain.
  sequence_number bigint generated always as identity,

  company_id uuid,
  actor_id uuid,
  impersonator_id uuid,

  action public.audit_action not null,
  entity_type text not null,
  entity_id uuid,

  old_data jsonb,
  new_data jsonb,
  context jsonb not null default '{}'::jsonb,
  description text,

  previous_hash text,
  chain_hash text not null,

  created_at timestamptz not null default now(),

  constraint audit_logs_entity_type_check
    check (length(btrim(entity_type)) between 1 and 120),
  constraint audit_logs_chain_hash_check
    check (chain_hash ~ '^[0-9a-f]{64}$'),
  constraint audit_logs_previous_hash_check
    check (previous_hash is null or previous_hash ~ '^[0-9a-f]{64}$'),
  constraint audit_logs_context_check
    check (jsonb_typeof(context) = 'object')
);

comment on table public.audit_logs is
  'Tamper evident record of every write, login and privileged action.';
comment on column public.audit_logs.chain_hash is
  'SHA-256 of this entry combined with the previous entry hash.';

create unique index audit_logs_sequence_unique
  on public.audit_logs (sequence_number);

create index audit_logs_company_idx
  on public.audit_logs (company_id, created_at desc);

create index audit_logs_actor_idx
  on public.audit_logs (actor_id, created_at desc);

create index audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);

create index audit_logs_action_idx
  on public.audit_logs (action, created_at desc);

-- The audit trail is append only for every caller, including the service role.
create or replace function public.block_audit_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'The audit trail is append only and cannot be modified'
    using errcode = '42501';
end;
$$;

comment on function public.block_audit_mutation() is
  'Trigger function that rejects any update or delete on the audit trail.';

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function public.block_audit_mutation();

-- Records an action that has no table write behind it, such as a login, an
-- export or the start of an impersonation session.
create or replace function public.record_manual_audit_entry(
  p_action public.audit_action,
  p_entity_type text,
  p_entity_id uuid default null,
  p_company_id uuid default null,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_previous_hash text;
  v_payload jsonb;
  v_entry_id uuid;
  v_actor_id uuid := public.current_user_id();
  v_occurred_at timestamptz := now();
begin
  if p_entity_type is null or length(btrim(p_entity_type)) = 0 then
    raise exception 'An entity type is required for a manual audit entry'
      using errcode = '22023';
  end if;

  select chain_hash
    into v_previous_hash
    from public.audit_logs
   order by sequence_number desc
   limit 1;

  v_payload := jsonb_build_object(
    'table_name', p_entity_type,
    'record_id', p_entity_id,
    'action', p_action::text,
    'company_id', p_company_id,
    'actor_id', v_actor_id,
    'old_data', null,
    'new_data', public.redact_sensitive_fields(coalesce(p_metadata, '{}'::jsonb)),
    'occurred_at', v_occurred_at
  );

  insert into public.audit_logs (
    company_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    new_data,
    context,
    description,
    previous_hash,
    chain_hash,
    created_at
  )
  values (
    p_company_id,
    v_actor_id,
    p_action,
    p_entity_type,
    p_entity_id,
    public.redact_sensitive_fields(coalesce(p_metadata, '{}'::jsonb)),
    public.current_request_context(),
    p_description,
    v_previous_hash,
    public.compute_audit_hash(v_previous_hash, v_payload),
    v_occurred_at
  )
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

comment on function public.record_manual_audit_entry(
  public.audit_action, text, uuid, uuid, text, jsonb
) is 'Appends an audit entry for an action that has no direct table write.';

-- supabase/migrations/00125_audit_logs.sql
-- Append-only platform and tenant audit log. Hash chaining and tamper
-- evidence are added by the later security-hardening phase; this table is
-- the durable event foundation for admin, billing, access, and data actions.

create table public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid null references public.companies (id),
  actor_user_id uuid null references public.users (id),
  action text not null,
  entity_type text not null,
  entity_id uuid null,
  severity audit_severity not null default 'info',
  before_data jsonb null,
  after_data jsonb null,
  metadata jsonb not null default '{}'::jsonb,
  ip_hash text null,
  user_agent_hash text null,
  request_id text null,
  occurred_at timestamptz not null default now(),
  constraint audit_logs_action_not_blank check (length(btrim(action)) > 0),
  constraint audit_logs_entity_type_not_blank check (length(btrim(entity_type)) > 0),
  constraint audit_logs_before_data_object check (
    before_data is null or jsonb_typeof(before_data) = 'object'
  ),
  constraint audit_logs_after_data_object check (
    after_data is null or jsonb_typeof(after_data) = 'object'
  ),
  constraint audit_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index audit_logs_company_time_idx
  on public.audit_logs (company_id, occurred_at desc);
create index audit_logs_actor_time_idx
  on public.audit_logs (actor_user_id, occurred_at desc)
  where actor_user_id is not null;
create index audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, occurred_at desc)
  where entity_id is not null;
create index audit_logs_severity_idx
  on public.audit_logs (severity, occurred_at desc);
create index audit_logs_request_id_idx
  on public.audit_logs (request_id)
  where request_id is not null;

comment on table public.audit_logs is
  'Append-only platform or tenant audit event. Sensitive request identity values are stored as hashes.';

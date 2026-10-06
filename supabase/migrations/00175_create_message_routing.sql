-- supabase/migrations/00175_create_message_routing.sql
-- Trying the next channel when the first one does not land.
--
-- A route is an ordered list: email first, then WhatsApp, then SMS. Each step
-- waits a while for proof of delivery before the next one is tried, so a
-- client who read the email is never also texted about it.

-- The run links every message it produced back to the route that sent it.
alter table public.messages
  add column route_run_id uuid,
  add column route_step_order smallint,
  add column channel_cost numeric(12, 6);

comment on column public.messages.route_run_id is
  'The routed conversation this message belongs to, when it was not sent alone.';

create index messages_route_run_idx
  on public.messages (route_run_id)
  where route_run_id is not null;

create table public.message_routes (
  id uuid primary key default public.generate_uuid_v7(),
  -- Null is a platform default a tenant can override.
  company_id uuid,

  route_key text not null,
  name text not null,
  description text,
  notification_kind public.notification_type,

  is_active boolean not null default true,
  -- Stop as soon as one channel reports delivery.
  stop_on_delivery boolean not null default true,
  -- Stop as soon as the recipient engages, which is stronger than delivery.
  stop_on_engagement boolean not null default true,
  respect_quiet_hours boolean not null default true,
  requires_consent boolean not null default true,

  max_total_cost numeric(12, 6),
  cost_currency char(3) not null default 'USD',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint message_routes_key_check
    check (route_key ~ '^[a-z][a-z0-9_.]{2,60}$'),
  constraint message_routes_name_check
    check (length(btrim(name)) between 2 and 80),
  constraint message_routes_cost_check
    check (max_total_cost is null or max_total_cost > 0),
  constraint message_routes_currency_check
    check (cost_currency ~ '^[A-Z]{3}$')
);

comment on table public.message_routes is
  'An ordered fallback chain used to reach somebody about one kind of event.';

create unique index message_routes_key_unique
  on public.message_routes (
    coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
    route_key
  )
  where deleted_at is null;

create table public.message_route_steps (
  id uuid primary key default public.generate_uuid_v7(),
  route_id uuid not null,

  step_order smallint not null,
  channel public.message_channel not null,
  template_key text,

  -- How long this step is given before the next one is tried.
  wait_minutes integer not null default 60,
  -- A step can be skipped when the recipient has no address for it.
  is_required boolean not null default false,
  max_attempts smallint not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint message_route_steps_order_check
    check (step_order between 1 and 10),
  constraint message_route_steps_wait_check
    check (wait_minutes between 0 and 20160),
  constraint message_route_steps_attempts_check
    check (max_attempts between 1 and 5)
);

comment on table public.message_route_steps is
  'One channel in a fallback chain, and how long it is given to work.';

create unique index message_route_steps_unique
  on public.message_route_steps (route_id, step_order);

create unique index message_route_steps_channel_unique
  on public.message_route_steps (route_id, channel);

-- -----------------------------------------------------------------------------
-- Runs
-- -----------------------------------------------------------------------------

create table public.message_route_runs (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  route_id uuid not null,

  client_id uuid,
  user_id uuid,
  related_entity_type text,
  related_entity_id uuid,
  variables jsonb not null default '{}'::jsonb,

  status text not null default 'running',
  current_step_order smallint,
  next_action_at timestamptz,

  delivered_channel public.message_channel,
  delivered_at timestamptz,
  engaged_at timestamptz,
  completed_at timestamptz,
  stop_reason text,

  attempted_channels text[] not null default array[]::text[],
  total_cost numeric(12, 6) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,

  constraint message_route_runs_party_check
    check (num_nonnulls(client_id, user_id) <= 1),
  constraint message_route_runs_status_check
    check (status in ('running', 'delivered', 'engaged', 'exhausted',
                      'stopped', 'failed')),
  constraint message_route_runs_delivered_check
    check (status <> 'delivered' or delivered_at is not null),
  constraint message_route_runs_cost_check
    check (total_cost >= 0),
  constraint message_route_runs_stop_check
    check (status not in ('stopped', 'failed') or stop_reason is not null)
);

comment on table public.message_route_runs is
  'One attempt to reach somebody, walking down a fallback chain.';

create index message_route_runs_due_idx
  on public.message_route_runs (next_action_at)
  where status = 'running';

create index message_route_runs_entity_idx
  on public.message_route_runs (company_id, related_entity_type, related_entity_id);

-- -----------------------------------------------------------------------------
-- Inbound replies
-- -----------------------------------------------------------------------------

-- A reply is how somebody says STOP, and how a conversation continues. The
-- raw text is kept so a dispute can be answered with what was actually said.
create table public.inbound_messages (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,

  channel public.message_channel not null,
  from_address text not null,
  to_address text,
  body_text text,
  attachments jsonb not null default '[]'::jsonb,

  provider text,
  provider_message_id text,
  received_at timestamptz not null default now(),

  client_id uuid,
  related_message_id uuid,
  route_run_id uuid,

  is_opt_out boolean not null default false,
  is_handled boolean not null default false,
  handled_at timestamptz,
  handled_by uuid,
  handling_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint inbound_messages_channel_check
    check (channel <> 'in_app'),
  constraint inbound_messages_from_check
    check (length(btrim(from_address)) between 3 and 160),
  constraint inbound_messages_attachments_check
    check (jsonb_typeof(attachments) = 'array'),
  constraint inbound_messages_handled_check
    check (not is_handled or handled_at is not null)
);

comment on table public.inbound_messages is
  'A reply received on a messaging channel, including opt out requests.';

create unique index inbound_messages_provider_unique
  on public.inbound_messages (provider, provider_message_id)
  where provider_message_id is not null;

create index inbound_messages_unhandled_idx
  on public.inbound_messages (company_id, received_at desc)
  where not is_handled;

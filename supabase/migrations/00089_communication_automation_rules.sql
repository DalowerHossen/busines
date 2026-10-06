-- supabase/migrations/00089_communication_automation_rules.sql
-- Event-driven communication rules. Conditions and rendered fallback routes
-- are data so new business events can be added without changing the schema.

create table public.communication_automation_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name text not null,
  trigger_event text not null,
  channel communication_channel not null,
  email_template_id uuid null references public.email_templates (id),
  whatsapp_template_id uuid null references public.whatsapp_templates (id),
  message_body_template text null,
  conditions jsonb not null default '{}'::jsonb,
  fallback_channels communication_channel[] not null default '{}',
  priority integer not null default 100,
  is_enabled boolean not null default true,
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint communication_automation_rules_name_not_blank check (length(btrim(name)) > 0),
  constraint communication_automation_rules_event_not_blank check (length(btrim(trigger_event)) > 0),
  constraint communication_automation_rules_channel_valid check (channel <> 'in_app'),
  constraint communication_automation_rules_conditions_object check (jsonb_typeof(conditions) = 'object'),
  constraint communication_automation_rules_priority_non_negative check (priority >= 0),
  constraint communication_automation_rules_fallback_valid check (
    not ('in_app' = any(fallback_channels))
  )
);

create index communication_automation_rules_event_idx
  on public.communication_automation_rules (company_id, trigger_event, priority)
  where is_enabled = true and deleted_at is null;
create index communication_automation_rules_company_id_idx
  on public.communication_automation_rules (company_id)
  where deleted_at is null;

comment on table public.communication_automation_rules is
  'A tenant event-to-message rule with optional template, condition, and fallback-channel configuration.';

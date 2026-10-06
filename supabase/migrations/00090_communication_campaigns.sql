-- supabase/migrations/00090_communication_campaigns.sql
-- Bulk communication campaign header. Recipient rows and their delivery
-- state are stored separately so campaigns can be queued and retried safely.

create table public.communication_campaigns (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name text not null,
  channel communication_channel not null,
  email_template_id uuid null references public.email_templates (id),
  whatsapp_template_id uuid null references public.whatsapp_templates (id),
  audience_filter jsonb not null default '{}'::jsonb,
  status communication_campaign_status not null default 'draft',
  scheduled_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  total_recipients integer not null default 0,
  sent_count integer not null default 0,
  delivered_count integer not null default 0,
  failed_count integer not null default 0,
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint communication_campaigns_name_not_blank check (length(btrim(name)) > 0),
  constraint communication_campaigns_channel_valid check (channel <> 'in_app'),
  constraint communication_campaigns_audience_filter_object check (jsonb_typeof(audience_filter) = 'object'),
  constraint communication_campaigns_counts_non_negative check (
    total_recipients >= 0 and sent_count >= 0 and delivered_count >= 0 and failed_count >= 0
  )
);

create index communication_campaigns_company_status_idx
  on public.communication_campaigns (company_id, status, created_at desc)
  where deleted_at is null;
create index communication_campaigns_schedule_idx
  on public.communication_campaigns (scheduled_at)
  where status = 'scheduled' and deleted_at is null;

comment on table public.communication_campaigns is
  'A tenant bulk messaging campaign with recipient counts and scheduled execution state.';

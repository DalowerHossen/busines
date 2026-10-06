-- supabase/migrations/00091_communication_campaign_recipients.sql
-- One client recipient within a bulk communication campaign.

create table public.communication_campaign_recipients (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  campaign_id uuid not null references public.communication_campaigns (id) on delete cascade,
  client_id uuid not null references public.clients (id),
  recipient_address text not null,
  status message_status not null default 'queued',
  message_delivery_id uuid null references public.message_deliveries (id),
  failure_reason text null,
  queued_at timestamptz not null default now(),
  sent_at timestamptz null,
  delivered_at timestamptz null,
  read_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint communication_campaign_recipients_address_not_blank check (
    length(btrim(recipient_address)) > 0
  )
);

create unique index communication_campaign_recipients_campaign_client_key
  on public.communication_campaign_recipients (campaign_id, client_id)
  where deleted_at is null;
create index communication_campaign_recipients_queue_idx
  on public.communication_campaign_recipients (campaign_id, status, queued_at)
  where status in ('queued', 'sending') and deleted_at is null;
create index communication_campaign_recipients_company_id_idx
  on public.communication_campaign_recipients (company_id)
  where deleted_at is null;

comment on table public.communication_campaign_recipients is
  'A client recipient and delivery projection belonging to one bulk communication campaign.';

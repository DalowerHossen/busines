-- supabase/migrations/00153_create_marketing_campaigns.sql
-- Campaigns, the audiences they go to, and the sequences that follow.
--
-- A campaign with no company behind it belongs to the platform and goes to
-- people who signed up for news. A campaign with a company belongs to that
-- tenant and goes to that tenant's clients. The same machinery serves both,
-- and the same rule applies to both: nobody is written to who did not ask.

create table public.marketing_segments (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,

  name text not null,
  description text,
  -- Who is in it, as a set of rules the application turns into a query.
  criteria jsonb not null default '{}'::jsonb,
  -- Refreshed by the job queue rather than counted on every page load.
  member_count integer not null default 0,
  last_calculated_at timestamptz,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint marketing_segments_name_check
    check (length(btrim(name)) between 2 and 80),
  constraint marketing_segments_criteria_check
    check (jsonb_typeof(criteria) = 'object'),
  constraint marketing_segments_count_check
    check (member_count >= 0)
);

comment on table public.marketing_segments is
  'A described audience, recalculated on a schedule rather than on demand.';

create index marketing_segments_company_idx
  on public.marketing_segments (company_id)
  where deleted_at is null;

create unique index marketing_segments_name_unique
  on public.marketing_segments (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Campaigns
-- -----------------------------------------------------------------------------

create table public.marketing_campaigns (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,

  name text not null,
  description text,
  campaign_type text not null default 'broadcast',
  channel text not null default 'email',

  segment_id uuid,
  status text not null default 'draft',

  -- What a broadcast says. A sequence keeps its wording on the steps.
  subject text,
  preheader text,
  body_markdown text,
  from_name text,

  -- Link tagging, so the funnel report can attribute what happens next.
  utm_source text not null default 'newsletter',
  utm_medium text not null default 'email',
  utm_campaign text,

  scheduled_for timestamptz,
  send_in_recipient_timezone boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,

  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  delivered_count integer not null default 0,
  opened_count integer not null default 0,
  clicked_count integer not null default 0,
  unsubscribed_count integer not null default 0,
  bounced_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint marketing_campaigns_name_check
    check (length(btrim(name)) between 2 and 120),
  constraint marketing_campaigns_type_check
    check (campaign_type in ('broadcast', 'sequence', 'transactional_followup')),
  constraint marketing_campaigns_channel_check
    check (channel in ('email', 'sms', 'telegram', 'in_app')),
  constraint marketing_campaigns_status_check
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'paused',
                      'cancelled')),
  constraint marketing_campaigns_subject_check
    check (campaign_type <> 'broadcast'
           or (subject is not null and length(btrim(subject)) between 3 and 150)),
  constraint marketing_campaigns_body_check
    check (campaign_type <> 'broadcast' or body_markdown is not null),
  constraint marketing_campaigns_scheduled_check
    check (status <> 'scheduled' or scheduled_for is not null),
  constraint marketing_campaigns_counts_check
    check (recipient_count >= 0 and sent_count >= 0 and delivered_count >= 0
           and opened_count >= 0 and clicked_count >= 0
           and unsubscribed_count >= 0 and bounced_count >= 0),
  constraint marketing_campaigns_progress_check
    check (sent_count <= greatest(recipient_count, sent_count))
);

comment on table public.marketing_campaigns is
  'One message, or one sequence of messages, sent to a described audience.';

create index marketing_campaigns_company_idx
  on public.marketing_campaigns (company_id, created_at desc)
  where deleted_at is null;

create index marketing_campaigns_due_idx
  on public.marketing_campaigns (scheduled_for)
  where status = 'scheduled' and deleted_at is null;

-- The steps of a sequence: say this, then wait, then say that.
create table public.campaign_steps (
  id uuid primary key default public.generate_uuid_v7(),
  campaign_id uuid not null,
  company_id uuid,

  step_number smallint not null,
  name text not null,
  delay_hours integer not null default 24,

  subject text not null,
  preheader text,
  body_markdown text not null,

  -- A step is skipped for anybody who has already done this.
  skip_if_event_name text,
  is_active boolean not null default true,

  sent_count integer not null default 0,
  opened_count integer not null default 0,
  clicked_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint campaign_steps_number_check
    check (step_number between 1 and 50),
  constraint campaign_steps_delay_check
    check (delay_hours between 0 and 8760),
  constraint campaign_steps_subject_check
    check (length(btrim(subject)) between 3 and 150),
  constraint campaign_steps_body_check
    check (length(btrim(body_markdown)) >= 10),
  constraint campaign_steps_skip_check
    check (skip_if_event_name is null
           or skip_if_event_name ~ '^[a-z][a-z0-9_]{2,60}$'),
  constraint campaign_steps_counts_check
    check (sent_count >= 0 and opened_count >= 0 and clicked_count >= 0)
);

comment on table public.campaign_steps is
  'One message in a sequence, with the wait before it and when to skip it.';

create unique index campaign_steps_order_unique
  on public.campaign_steps (campaign_id, step_number);

-- -----------------------------------------------------------------------------
-- Who was written to
-- -----------------------------------------------------------------------------

create table public.campaign_recipients (
  id uuid primary key default public.generate_uuid_v7(),
  campaign_id uuid not null,
  company_id uuid,
  step_id uuid,

  -- A recipient is a client of a tenant, a user of the platform, or an
  -- address somebody typed into the newsletter box.
  client_id uuid,
  user_id uuid,
  email_address citext not null,

  status text not null default 'pending',
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  first_clicked_at timestamptz,
  bounced_at timestamptz,
  unsubscribed_at timestamptz,
  failure_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint campaign_recipients_status_check
    check (status in ('pending', 'skipped', 'sent', 'delivered', 'bounced',
                      'failed', 'unsubscribed')),
  constraint campaign_recipients_email_check
    check (public.is_valid_email(email_address::text)),
  constraint campaign_recipients_sent_check
    check (status not in ('sent', 'delivered') or sent_at is not null)
);

comment on table public.campaign_recipients is
  'One person on the list of one campaign, and what happened to their message.';

create unique index campaign_recipients_unique
  on public.campaign_recipients (campaign_id, email_address,
                                 coalesce(step_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index campaign_recipients_due_idx
  on public.campaign_recipients (scheduled_for)
  where status = 'pending';

create index campaign_recipients_campaign_idx
  on public.campaign_recipients (campaign_id, status);

-- -----------------------------------------------------------------------------
-- Who asked to be left alone
-- -----------------------------------------------------------------------------

-- Separate from the transactional suppression list: a client who stops the
-- newsletter still gets their invoices.
create table public.marketing_subscriptions (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,

  email_address citext not null,
  client_id uuid,
  user_id uuid,

  is_subscribed boolean not null default true,
  source text not null default 'signup',
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  unsubscribe_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marketing_subscriptions_email_check
    check (public.is_valid_email(email_address::text)),
  constraint marketing_subscriptions_source_check
    check (source in ('signup', 'newsletter_form', 'invoice_footer', 'import',
                      'landing_page', 'manual')),
  constraint marketing_subscriptions_state_check
    check (is_subscribed or unsubscribed_at is not null)
);

comment on table public.marketing_subscriptions is
  'Who agreed to receive news, and who asked to stop.';

create unique index marketing_subscriptions_unique
  on public.marketing_subscriptions
     (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
      email_address);

create index marketing_subscriptions_active_idx
  on public.marketing_subscriptions (company_id)
  where is_subscribed;

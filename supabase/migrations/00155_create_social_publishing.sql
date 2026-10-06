-- supabase/migrations/00155_create_social_publishing.sql
-- The content calendar and the channels it publishes to.
--
-- A channel is one connected account on one network. The access token behind
-- it is held the same way every other secret is: encrypted by the application
-- before it arrives, with only a masked hint stored in the clear. The posting
-- adapters are filled in later; everything the calendar, the composer and the
-- scheduler need is here now.

create table public.social_channels (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,

  platform text not null,
  account_name text not null,
  account_handle text,
  -- The identifier the network itself uses for this account or page.
  external_account_id text,
  avatar_url text,

  -- The connection, encrypted exactly like an integration credential.
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  masked_hint text,
  granted_scopes text[] not null default array[]::text[],

  is_connected boolean not null default false,
  is_active boolean not null default true,
  connection_error text,
  last_published_at timestamptz,
  post_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint social_channels_platform_check
    check (platform in ('facebook', 'instagram', 'linkedin', 'x', 'threads',
                        'telegram', 'pinterest', 'youtube', 'tiktok')),
  constraint social_channels_account_check
    check (length(btrim(account_name)) between 2 and 80),
  constraint social_channels_handle_check
    check (account_handle is null or account_handle ~ '^[A-Za-z0-9._-]{1,50}$'),
  constraint social_channels_hint_check
    check (masked_hint is null or length(masked_hint) <= 12),
  constraint social_channels_connected_check
    check (not is_connected or access_token_encrypted is not null),
  constraint social_channels_count_check
    check (post_count >= 0)
);

comment on table public.social_channels is
  'One connected account on one social network, with its token encrypted.';

create unique index social_channels_account_unique
  on public.social_channels
     (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
      platform, coalesce(external_account_id, account_name))
  where deleted_at is null;

create index social_channels_active_idx
  on public.social_channels (company_id, platform)
  where is_active and is_connected and deleted_at is null;

create index social_channels_expiring_idx
  on public.social_channels (token_expires_at)
  where token_expires_at is not null and is_connected;

-- -----------------------------------------------------------------------------
-- The calendar
-- -----------------------------------------------------------------------------

create table public.social_posts (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,

  title text not null,
  -- The wording as written once, before each channel trims it to fit.
  body text not null,
  link_url text,
  media_file_ids uuid[] not null default array[]::uuid[],
  hashtags text[] not null default array[]::text[],

  status text not null default 'draft',
  scheduled_for timestamptz,
  published_at timestamptz,

  -- Set when the post was raised by a rule rather than written by a person.
  created_by_rule_id uuid,
  campaign_id uuid,

  approved_by uuid,
  approved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint social_posts_title_check
    check (length(btrim(title)) between 2 and 120),
  constraint social_posts_body_check
    check (length(btrim(body)) between 1 and 5000),
  constraint social_posts_link_check
    check (link_url is null or link_url ~ '^https://'),
  constraint social_posts_hashtags_check
    check (coalesce(array_length(hashtags, 1), 0) <= 30),
  constraint social_posts_status_check
    check (status in ('draft', 'awaiting_approval', 'scheduled', 'publishing',
                      'published', 'partially_published', 'failed',
                      'cancelled')),
  constraint social_posts_scheduled_check
    check (status <> 'scheduled' or scheduled_for is not null),
  constraint social_posts_published_check
    check (status <> 'published' or published_at is not null)
);

comment on table public.social_posts is
  'One piece of content, written once and sent to any number of channels.';

create index social_posts_company_idx
  on public.social_posts (company_id, scheduled_for desc)
  where deleted_at is null;

create index social_posts_due_idx
  on public.social_posts (scheduled_for)
  where status = 'scheduled' and deleted_at is null;

-- What actually goes out on each channel, because every network has its own
-- limits and its own idea of what a post looks like.
create table public.social_post_targets (
  id uuid primary key default public.generate_uuid_v7(),
  post_id uuid not null,
  channel_id uuid not null,
  company_id uuid,

  -- Left empty to use the wording of the post itself.
  body_override text,
  status text not null default 'pending',

  attempt_count smallint not null default 0,
  next_attempt_at timestamptz not null default now(),
  published_at timestamptz,
  external_post_id text,
  external_url text,
  last_error text,

  -- Filled in later by whatever the network reports back.
  impression_count integer,
  engagement_count integer,
  metrics_updated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint social_post_targets_status_check
    check (status in ('pending', 'publishing', 'published', 'failed',
                      'skipped', 'cancelled')),
  constraint social_post_targets_attempts_check
    check (attempt_count >= 0 and attempt_count <= 10),
  constraint social_post_targets_published_check
    check (status <> 'published' or published_at is not null),
  constraint social_post_targets_metrics_check
    check (coalesce(impression_count, 0) >= 0
           and coalesce(engagement_count, 0) >= 0)
);

comment on table public.social_post_targets is
  'One post on one channel, with its own wording, outcome and figures.';

create unique index social_post_targets_unique
  on public.social_post_targets (post_id, channel_id);

create index social_post_targets_due_idx
  on public.social_post_targets (next_attempt_at)
  where status = 'pending';

-- -----------------------------------------------------------------------------
-- Posting without being asked
-- -----------------------------------------------------------------------------

-- A rule turns something that happened in the product into a draft post, so
-- the calendar fills itself and a person only has to approve it.
create table public.social_auto_rules (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,

  name text not null,
  trigger_event text not null,
  -- The wording, with placeholders the composer fills in.
  body_template text not null,
  link_template text,
  channel_ids uuid[] not null default array[]::uuid[],

  requires_approval boolean not null default true,
  -- Never post more often than this, whatever happens upstream.
  minimum_hours_between_posts smallint not null default 24,

  is_active boolean not null default false,
  last_triggered_at timestamptz,
  trigger_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint social_auto_rules_name_check
    check (length(btrim(name)) between 2 and 80),
  constraint social_auto_rules_trigger_check
    check (trigger_event ~ '^[a-z][a-z0-9_.]{2,60}$'),
  constraint social_auto_rules_template_check
    check (length(btrim(body_template)) between 5 and 2000),
  constraint social_auto_rules_interval_check
    check (minimum_hours_between_posts between 1 and 720),
  constraint social_auto_rules_channels_check
    check (not is_active or coalesce(array_length(channel_ids, 1), 0) >= 1),
  constraint social_auto_rules_count_check
    check (trigger_count >= 0)
);

comment on table public.social_auto_rules is
  'Turns something that happened in the product into a draft post.';

create index social_auto_rules_active_idx
  on public.social_auto_rules (trigger_event)
  where is_active and deleted_at is null;

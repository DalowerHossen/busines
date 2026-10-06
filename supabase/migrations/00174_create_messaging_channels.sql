-- supabase/migrations/00174_create_messaging_channels.sql
-- Reaching people somewhere other than their inbox.
--
-- Email already has its own sender identities and suppression list. This file
-- gives the same treatment to the channels that are not email: a configured
-- sender per channel, a verified address per person, and a record of who has
-- said they do not want to be contacted that way.

create table public.messaging_channels (
  id uuid primary key default public.generate_uuid_v7(),
  -- Null means the platform sends on this channel for everyone.
  company_id uuid,

  channel public.message_channel not null,
  provider text not null,
  display_name text not null,

  -- The address messages appear to come from.
  sender_number text,
  sender_handle text,
  sender_display_name text,

  -- Credentials live in the integration vault, never in this table.
  credential_id uuid,

  is_active boolean not null default true,
  is_verified boolean not null default false,
  verified_at timestamptz,

  -- Priority when a route does not name a channel explicitly.
  routing_priority smallint not null default 100,

  -- Spend and volume control.
  cost_per_message numeric(12, 6) not null default 0,
  cost_currency char(3) not null default 'USD',
  daily_send_limit integer,
  sent_today integer not null default 0,
  send_window_resets_on date not null default current_date,

  -- Nobody is woken up by a payment reminder.
  quiet_hours_start time,
  quiet_hours_end time,

  last_used_at timestamptz,
  last_error text,
  last_error_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint messaging_channels_channel_check
    check (channel <> 'email'),
  constraint messaging_channels_provider_check
    check (provider ~ '^[a-z][a-z0-9_]{2,40}$'),
  constraint messaging_channels_display_name_check
    check (length(btrim(display_name)) between 2 and 60),
  constraint messaging_channels_sender_check
    check (
      (channel in ('sms', 'whatsapp', 'viber') and sender_number is not null)
      or (channel in ('telegram', 'in_app'))
    ),
  constraint messaging_channels_number_check
    check (sender_number is null or sender_number ~ '^\+?[0-9]{6,20}$'),
  constraint messaging_channels_priority_check
    check (routing_priority between 1 and 1000),
  constraint messaging_channels_cost_check
    check (cost_per_message >= 0 and cost_currency ~ '^[A-Z]{3}$'),
  constraint messaging_channels_limit_check
    check (daily_send_limit is null or daily_send_limit > 0),
  constraint messaging_channels_sent_check
    check (sent_today >= 0),
  constraint messaging_channels_quiet_check
    check (num_nonnulls(quiet_hours_start, quiet_hours_end) <> 1),
  constraint messaging_channels_verified_check
    check (not is_verified or verified_at is not null)
);

comment on table public.messaging_channels is
  'A configured way to send on one channel, for one tenant or the platform.';

create unique index messaging_channels_unique
  on public.messaging_channels (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), channel, provider)
  where deleted_at is null;

create index messaging_channels_active_idx
  on public.messaging_channels (company_id, channel, routing_priority)
  where is_active and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Where a person can be reached
-- -----------------------------------------------------------------------------

create table public.contact_channel_identities (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  client_id uuid,
  user_id uuid,

  channel public.message_channel not null,
  -- A phone number, a chat identifier or a handle, depending on the channel.
  address text not null,
  display_label text,

  is_primary boolean not null default false,
  is_verified boolean not null default false,
  verified_at timestamptz,
  verification_code_hash text,
  verification_expires_at timestamptz,
  verification_attempts smallint not null default 0,

  -- Consent, which is what makes a non-email channel lawful to use.
  consent_state text not null default 'unknown',
  consent_source text,
  consent_recorded_at timestamptz,
  consent_ip inet,
  opted_out_at timestamptz,
  opt_out_reason text,

  last_delivered_at timestamptz,
  last_failed_at timestamptz,
  failure_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint contact_channel_identities_party_check
    check (num_nonnulls(client_id, user_id) = 1),
  constraint contact_channel_identities_channel_check
    check (channel <> 'email'),
  constraint contact_channel_identities_address_check
    check (length(btrim(address)) between 3 and 120),
  constraint contact_channel_identities_phone_check
    check (channel not in ('sms', 'whatsapp', 'viber')
           or address ~ '^\+[1-9][0-9]{6,19}$'),
  constraint contact_channel_identities_consent_check
    check (consent_state in ('unknown', 'opted_in', 'opted_out')),
  constraint contact_channel_identities_consent_record_check
    check (consent_state <> 'opted_in' or consent_recorded_at is not null),
  constraint contact_channel_identities_opt_out_check
    check (consent_state <> 'opted_out' or opted_out_at is not null),
  constraint contact_channel_identities_verified_check
    check (not is_verified or verified_at is not null),
  constraint contact_channel_identities_attempts_check
    check (verification_attempts between 0 and 10),
  constraint contact_channel_identities_failures_check
    check (failure_count >= 0)
);

comment on table public.contact_channel_identities is
  'A phone number or chat account a person agreed to be contacted on.';

create unique index contact_channel_identities_unique
  on public.contact_channel_identities (company_id, channel, address)
  where deleted_at is null;

create unique index contact_channel_identities_primary
  on public.contact_channel_identities (company_id, coalesce(client_id, user_id), channel)
  where is_primary and deleted_at is null;

create index contact_channel_identities_client_idx
  on public.contact_channel_identities (client_id, channel)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Do not contact
-- -----------------------------------------------------------------------------

-- The non-email twin of the mail suppression list. A STOP reply lands here
-- and every route consults it before it sends anything.
create table public.channel_suppressions (
  id uuid primary key default public.generate_uuid_v7(),
  -- Null suppresses the address across the whole platform.
  company_id uuid,

  channel public.message_channel not null,
  address text not null,

  reason text not null,
  source text not null default 'recipient_reply',
  evidence text,

  suppressed_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid,
  release_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint channel_suppressions_channel_check
    check (channel <> 'email'),
  constraint channel_suppressions_address_check
    check (length(btrim(address)) between 3 and 120),
  constraint channel_suppressions_reason_check
    check (reason in ('opted_out', 'invalid_address', 'repeated_failure',
                      'complaint', 'manual')),
  constraint channel_suppressions_source_check
    check (source in ('recipient_reply', 'provider_callback', 'manual',
                      'automatic')),
  constraint channel_suppressions_release_check
    check (released_at is null or release_reason is not null)
);

comment on table public.channel_suppressions is
  'Addresses that must not be messaged again on a given channel.';

create unique index channel_suppressions_active_unique
  on public.channel_suppressions (
    coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
    channel,
    address
  )
  where released_at is null;

create index channel_suppressions_lookup_idx
  on public.channel_suppressions (channel, address)
  where released_at is null;

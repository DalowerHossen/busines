-- supabase/migrations/00150_create_visitor_tracking.sql
-- Measurement that asks permission first.
--
-- Nothing here identifies a person. A visitor is a random token the browser
-- keeps, addresses are stored only as a salted digest, and no measurement
-- tag loads at all until the visitor has agreed to it. That is both the law
-- in most of the places this will be sold and the only decent way to behave.

create table public.cookie_consents (
  id uuid primary key default public.generate_uuid_v7(),

  visitor_token text not null,
  -- Set once the visitor signs up, so a consent can be honoured afterwards.
  user_id uuid,

  necessary_allowed boolean not null default true,
  analytics_allowed boolean not null default false,
  marketing_allowed boolean not null default false,
  preferences_allowed boolean not null default false,

  policy_version text not null default '2026-01-01',
  decided_at timestamptz not null default now(),
  -- A consent is asked for again after this, rather than assumed forever.
  expires_at timestamptz not null default (now() + interval '12 months'),

  ip_hash text,
  user_agent text,
  country_code char(2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cookie_consents_token_check
    check (length(btrim(visitor_token)) between 16 and 128),
  constraint cookie_consents_necessary_check
    check (necessary_allowed),
  constraint cookie_consents_ip_hash_check
    check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  constraint cookie_consents_country_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint cookie_consents_expiry_check
    check (expires_at > decided_at)
);

comment on table public.cookie_consents is
  'What each visitor agreed to be measured by, and until when.';

create unique index cookie_consents_visitor_unique
  on public.cookie_consents (visitor_token);

create index cookie_consents_user_idx
  on public.cookie_consents (user_id, decided_at desc)
  where user_id is not null;

create index cookie_consents_expiring_idx
  on public.cookie_consents (expires_at);

-- Records a decision from the banner. Choosing again simply replaces it.
create or replace function public.record_cookie_consent(
  p_visitor_token text,
  p_analytics boolean,
  p_marketing boolean,
  p_preferences boolean default false,
  p_policy_version text default '2026-01-01',
  p_ip_hash text default null,
  p_user_agent text default null,
  p_country_code char(2) default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.cookie_consents (
    visitor_token, user_id, analytics_allowed, marketing_allowed,
    preferences_allowed, policy_version, ip_hash, user_agent, country_code
  )
  values (
    p_visitor_token, public.current_user_id(), coalesce(p_analytics, false),
    coalesce(p_marketing, false), coalesce(p_preferences, false),
    coalesce(p_policy_version, '2026-01-01'), p_ip_hash,
    left(coalesce(p_user_agent, ''), 500), p_country_code
  )
  on conflict (visitor_token) do update
     set analytics_allowed = excluded.analytics_allowed,
         marketing_allowed = excluded.marketing_allowed,
         preferences_allowed = excluded.preferences_allowed,
         policy_version = excluded.policy_version,
         user_id = coalesce(excluded.user_id, public.cookie_consents.user_id),
         decided_at = now(),
         expires_at = now() + interval '12 months',
         updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.record_cookie_consent(
  text, boolean, boolean, boolean, text, text, text, char
) is 'Stores what a visitor agreed to, replacing any earlier answer.';

-- May this category of tag load for this visitor? The answer is no unless
-- somebody actually said yes and the answer has not gone stale.
create or replace function public.consent_allows(
  p_visitor_token text,
  p_category text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_consent public.cookie_consents%rowtype;
begin
  if p_category = 'necessary' then
    return true;
  end if;

  select * into v_consent
    from public.cookie_consents
   where visitor_token = p_visitor_token;

  if not found or v_consent.expires_at <= now() then
    return false;
  end if;

  return case p_category
    when 'analytics' then v_consent.analytics_allowed
    when 'marketing' then v_consent.marketing_allowed
    when 'preferences' then v_consent.preferences_allowed
    else false
  end;
end;
$$;

comment on function public.consent_allows(text, text) is
  'Returns whether a measurement category may load for this visitor.';

-- -----------------------------------------------------------------------------
-- What happened on the site
-- -----------------------------------------------------------------------------

create table public.site_events (
  id uuid primary key default public.generate_uuid_v7(),

  visitor_token text not null,
  session_token text,
  user_id uuid,

  event_name text not null,
  path text not null,
  referrer_url text,

  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,

  -- Set when the visit came through a landing page or an experiment.
  landing_page_id uuid,
  experiment_variant_id uuid,

  properties jsonb not null default '{}'::jsonb,
  device_type text,
  country_code char(2),
  occurred_at timestamptz not null default now(),

  constraint site_events_name_check
    check (event_name ~ '^[a-z][a-z0-9_]{2,60}$'),
  constraint site_events_path_check
    check (path ~ '^/[A-Za-z0-9._~/-]*$'),
  constraint site_events_properties_check
    check (jsonb_typeof(properties) = 'object'),
  constraint site_events_device_check
    check (device_type is null
           or device_type in ('mobile', 'tablet', 'desktop', 'other')),
  constraint site_events_country_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$')
);

comment on table public.site_events is
  'Page views and conversions on the marketing site, with no personal data.';

create index site_events_visitor_idx
  on public.site_events (visitor_token, occurred_at);

create index site_events_name_idx
  on public.site_events (event_name, occurred_at desc);

create index site_events_campaign_idx
  on public.site_events (utm_campaign, occurred_at desc)
  where utm_campaign is not null;

create index site_events_variant_idx
  on public.site_events (experiment_variant_id, occurred_at)
  where experiment_variant_id is not null;

create trigger site_events_10_append_only
  before update on public.site_events
  for each row execute function public.block_audit_mutation();

-- Records one event, but only if the visitor agreed to be measured. The
-- consent check lives here rather than in the browser, so a tag that fires
-- when it should not still cannot write anything.
create or replace function public.record_site_event(
  p_visitor_token text,
  p_event_name text,
  p_path text,
  p_properties jsonb default '{}'::jsonb,
  p_session_token text default null,
  p_referrer_url text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_utm_term text default null,
  p_utm_content text default null,
  p_device_type text default null,
  p_country_code char(2) default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.consent_allows(p_visitor_token, 'analytics') then
    return null;
  end if;

  insert into public.site_events (
    visitor_token, session_token, user_id, event_name, path, referrer_url,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    properties, device_type, country_code
  )
  values (
    p_visitor_token, p_session_token, public.current_user_id(), p_event_name,
    p_path, p_referrer_url, p_utm_source, p_utm_medium, p_utm_campaign,
    p_utm_term, p_utm_content, coalesce(p_properties, '{}'::jsonb),
    p_device_type, p_country_code
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.record_site_event(
  text, text, text, jsonb, text, text, text, text, text, text, text, text, char
) is 'Records a site event, but only for a visitor who agreed to measurement.';

-- The funnel, as a count of visitors who reached each named step.
create or replace function public.funnel_report(
  p_steps text[],
  p_from timestamptz default (now() - interval '30 days'),
  p_to timestamptz default now()
)
returns table (
  step_position integer,
  event_name text,
  visitor_count integer,
  conversion_from_first numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with counted as (
    select s.ordinality::integer as step_position,
           s.event_name,
           (
             select count(distinct e.visitor_token)
               from public.site_events as e
              where e.event_name = s.event_name
                and e.occurred_at between p_from and p_to
           )::integer as visitor_count
      from unnest(p_steps) with ordinality as s(event_name, ordinality)
  )
  select c.step_position,
         c.event_name,
         c.visitor_count,
         case
           when (select visitor_count from counted where step_position = 1) > 0
           then round(
             c.visitor_count * 100.0
             / (select visitor_count from counted where step_position = 1),
             1
           )
           else 0
         end
    from counted as c
   order by c.step_position;
$$;

comment on function public.funnel_report(text[], timestamptz, timestamptz) is
  'Counts how many visitors reached each step of a named funnel.';

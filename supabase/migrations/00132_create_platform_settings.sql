-- supabase/migrations/00132_create_platform_settings.sql
-- Settings and feature flags that can be changed while the platform runs.
--
-- Nothing here needs a redeploy. A value is read through the resolver, which
-- looks at the tenant override first, then the platform setting, then the
-- built in default, so a change takes effect everywhere at once.

create table public.platform_settings (
  id uuid primary key default public.generate_uuid_v7(),

  setting_key text not null,
  setting_group text not null default 'general',
  value jsonb not null,
  default_value jsonb,
  value_type text not null default 'string',

  label text not null,
  description text,
  -- A secret setting is never returned to the browser.
  is_secret boolean not null default false,
  -- A public setting may be read by any signed in user.
  is_public boolean not null default false,
  requires_restart boolean not null default false,

  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint platform_settings_key_check
    check (setting_key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'),
  constraint platform_settings_group_check
    check (setting_group ~ '^[a-z][a-z0-9_]{1,30}$'),
  constraint platform_settings_type_check
    check (value_type in ('string', 'number', 'boolean', 'json', 'array')),
  constraint platform_settings_label_check
    check (length(btrim(label)) between 2 and 120),
  constraint platform_settings_secret_check
    check (not (is_secret and is_public))
);

comment on table public.platform_settings is
  'Platform wide configuration that can be changed at runtime.';

create unique index platform_settings_key_unique
  on public.platform_settings (setting_key);

create index platform_settings_group_idx
  on public.platform_settings (setting_group);

-- The settings an installation needs on its first day.
insert into public.platform_settings (
  setting_key, setting_group, value, default_value, value_type, label,
  description, is_public
)
values
  ('brand.name', 'brand', '"KD SOLUTION IT"'::jsonb, '"KD SOLUTION IT"'::jsonb,
   'string', 'Platform name', 'Shown in the interface and in every email.', true),
  ('brand.tagline', 'brand', '"Smart Billing for Modern Business"'::jsonb,
   '"Smart Billing for Modern Business"'::jsonb, 'string', 'Tagline',
   'The one line description used on the marketing pages.', true),
  ('brand.primary_color', 'brand', '"#1d4ed8"'::jsonb, '"#1d4ed8"'::jsonb,
   'string', 'Primary colour', 'The accent colour of the interface.', true),
  ('mail.from_address', 'mail', '"support@kdsolutionit.com"'::jsonb,
   '"support@kdsolutionit.com"'::jsonb, 'string', 'Sending address',
   'Every message the platform sends leaves from this address.', false),
  ('mail.reply_to', 'mail', '"support@kdsolutionit.com"'::jsonb,
   '"support@kdsolutionit.com"'::jsonb, 'string', 'Reply address',
   'Where replies from clients arrive.', false),
  ('signup.default_plan_key', 'billing', '"free"'::jsonb, '"free"'::jsonb,
   'string', 'Plan new accounts start on',
   'Every account starts here until somebody upgrades.', false),
  ('signup.trial_days', 'billing', '14'::jsonb, '14'::jsonb, 'number',
   'Trial length in days', 'How long a paid plan can be tried for free.', true),
  ('security.session_timeout_minutes', 'security', '480'::jsonb, '480'::jsonb,
   'number', 'Session timeout', 'How long a signed in session lasts without use.',
   false),
  ('security.password_min_length', 'security', '10'::jsonb, '10'::jsonb,
   'number', 'Shortest password accepted', 'Applies to every account role.', true),
  ('limits.api_requests_per_minute', 'api', '120'::jsonb, '120'::jsonb, 'number',
   'API requests per minute', 'The default ceiling for a new API key.', false),
  ('features.maintenance_mode', 'system', 'false'::jsonb, 'false'::jsonb,
   'boolean', 'Maintenance mode',
   'When on, only the platform team can sign in.', true);

-- -----------------------------------------------------------------------------
-- Feature flags
-- -----------------------------------------------------------------------------

create table public.feature_flags (
  id uuid primary key default public.generate_uuid_v7(),

  flag_key text not null,
  name text not null,
  description text,

  is_enabled boolean not null default false,
  -- Percentage rollout, decided per tenant so a tenant never flickers.
  rollout_percentage smallint not null default 0,
  -- Tenants that always see it, whatever the percentage says.
  enabled_company_ids uuid[] not null default array[]::uuid[],
  disabled_company_ids uuid[] not null default array[]::uuid[],
  -- Plans that unlock it, for a feature that is part of what is being sold.
  enabled_plan_keys text[] not null default array[]::text[],

  starts_at timestamptz,
  ends_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,

  constraint feature_flags_key_check
    check (flag_key ~ '^[a-z][a-z0-9_]{2,60}$'),
  constraint feature_flags_name_check
    check (length(btrim(name)) between 2 and 80),
  constraint feature_flags_rollout_check
    check (rollout_percentage between 0 and 100),
  constraint feature_flags_window_check
    check (ends_at is null or starts_at is null or ends_at > starts_at)
);

comment on table public.feature_flags is
  'Switches that turn parts of the product on without a deployment.';

create unique index feature_flags_key_unique
  on public.feature_flags (flag_key);

insert into public.feature_flags (flag_key, name, description, is_enabled)
values
  ('receipt_ocr', 'Receipt reading',
   'Reads totals and dates from an uploaded receipt.', false),
  ('bank_feeds', 'Automatic bank feeds',
   'Pulls statement lines from a bank rather than a CSV file.', false),
  ('social_publishing', 'Social publishing',
   'Schedules and posts marketing content to connected channels.', false),
  ('template_marketplace', 'Template marketplace',
   'Lets tenants sell and buy invoice and contract templates.', false);

-- -----------------------------------------------------------------------------
-- Reading settings and flags
-- -----------------------------------------------------------------------------

-- Returns one setting, falling back to the stated default.
create or replace function public.platform_setting(p_setting_key text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(value, default_value)
    from public.platform_settings
   where setting_key = p_setting_key;
$$;

comment on function public.platform_setting(text) is
  'Returns the live value of one platform setting.';

-- Changes a setting and says who did it. The audit trigger keeps the before
-- and after, which is the point.
create or replace function public.set_platform_setting(
  p_setting_key text,
  p_value jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team can change a platform setting'
      using errcode = '42501';
  end if;

  update public.platform_settings
     set value = p_value,
         updated_by = public.current_user_id(),
         updated_at = now()
   where setting_key = p_setting_key;

  if not found then
    raise exception 'There is no setting called %', p_setting_key
      using errcode = 'P0002';
  end if;

  return p_value;
end;
$$;

comment on function public.set_platform_setting(text, jsonb) is
  'Changes a platform setting at runtime and records who changed it.';

-- Is this flag on for this tenant? The percentage is applied with a stable
-- hash of the tenant, so the same tenant always gets the same answer.
create or replace function public.feature_flag_enabled(
  p_flag_key text,
  p_company_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_flag public.feature_flags%rowtype;
  v_bucket integer;
begin
  select * into v_flag from public.feature_flags where flag_key = p_flag_key;

  if not found then
    return false;
  end if;

  if v_flag.starts_at is not null and v_flag.starts_at > now() then
    return false;
  end if;

  if v_flag.ends_at is not null and v_flag.ends_at <= now() then
    return false;
  end if;

  if p_company_id is not null then
    if p_company_id = any (v_flag.disabled_company_ids) then
      return false;
    end if;

    if p_company_id = any (v_flag.enabled_company_ids) then
      return true;
    end if;
  end if;

  if not v_flag.is_enabled then
    return false;
  end if;

  if v_flag.rollout_percentage >= 100 or p_company_id is null then
    return v_flag.rollout_percentage >= 100 or v_flag.is_enabled;
  end if;

  if v_flag.rollout_percentage = 0 then
    return false;
  end if;

  -- Stable bucket from the tenant and the flag together, so turning one flag
  -- up does not shuffle the audience of another.
  v_bucket := ('x' || substr(
    encode(extensions.digest(p_flag_key || p_company_id::text, 'sha256'), 'hex'),
    1, 4
  ))::bit(16)::integer % 100;

  return v_bucket < v_flag.rollout_percentage;
end;
$$;

comment on function public.feature_flag_enabled(text, uuid) is
  'Returns whether a feature is switched on for one tenant.';

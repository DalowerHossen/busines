-- supabase/migrations/00218_create_platform_operations.sql
-- The first day of an installation, and every day after it.
--
-- Three things live here.
--
-- The first is the domains this platform answers on. An invoicing business
-- needs more than one: the application itself, the marketing site, the short
-- domain used in links, and a subdomain that sends the mail. Each needs its
-- own DNS records, and until those records are correct the mail goes to spam
-- and nobody can say why. So the records are stored, checked, and the result
-- of the last check is kept where somebody can read it.
--
-- The second is readiness. Rather than a setup wizard that ticks boxes in a
-- table and then drifts away from the truth, readiness is computed from what
-- is actually configured, every time it is asked for.
--
-- The third is the health record: a short history of what the health probe
-- found, so an outage has a trail rather than an argument.

create table public.platform_domains (
  id uuid primary key default public.generate_uuid_v7(),

  -- app, marketing, short_link or mail.
  purpose text not null,
  hostname text not null,

  -- What has to exist in DNS for this hostname to work, written down so the
  -- person configuring it is not guessing.
  expected_records jsonb not null default '[]'::jsonb,

  is_verified boolean not null default false,
  verified_at timestamptz,
  last_checked_at timestamptz,
  last_check_message text,
  failing_records jsonb not null default '[]'::jsonb,

  is_primary boolean not null default false,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,

  constraint platform_domains_purpose_check
    check (purpose in ('app', 'marketing', 'short_link', 'mail', 'assets')),
  constraint platform_domains_hostname_check
    check (hostname ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  constraint platform_domains_records_check
    check (jsonb_typeof(expected_records) = 'array'
           and jsonb_typeof(failing_records) = 'array')
);

comment on table public.platform_domains is
  'The hostnames this installation answers on, and the DNS each one needs.';

comment on column public.platform_domains.expected_records is
  'The records that must exist in DNS, so nobody has to remember them.';

create unique index platform_domains_hostname_unique
  on public.platform_domains (hostname);

create index platform_domains_purpose_idx
  on public.platform_domains (purpose);

-- -----------------------------------------------------------------------------
-- A short history of what the health probe found
-- -----------------------------------------------------------------------------

create table public.platform_health_checks (
  id uuid primary key default public.generate_uuid_v7(),

  checked_at timestamptz not null default now(),
  is_healthy boolean not null,
  database_ms integer,
  storage_ok boolean,
  email_ok boolean,
  release_version text,
  detail jsonb not null default '{}'::jsonb,

  constraint platform_health_detail_check
    check (jsonb_typeof(detail) = 'object')
);

comment on table public.platform_health_checks is
  'What the health probe found, kept so an outage has a trail.';

create index platform_health_checks_time_idx
  on public.platform_health_checks (checked_at desc);

create or replace function public.record_health_check(
  p_is_healthy boolean,
  p_database_ms integer default null,
  p_storage_ok boolean default null,
  p_email_ok boolean default null,
  p_release_version text default null,
  p_detail jsonb default '{}'::jsonb
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
  if not public.is_service_role() then
    raise exception 'Only the server records a health check' using errcode = '42501';
  end if;

  insert into public.platform_health_checks (
    is_healthy, database_ms, storage_ok, email_ok, release_version, detail
  )
  values (
    p_is_healthy, p_database_ms, p_storage_ok, p_email_ok,
    left(p_release_version, 60), coalesce(p_detail, '{}'::jsonb)
  )
  returning id into v_id;

  -- The trail is useful for days, not for years.
  delete from public.platform_health_checks
   where checked_at < now() - interval '30 days';

  return v_id;
end;
$$;

comment on function public.record_health_check(
  boolean, integer, boolean, boolean, text, jsonb
) is 'Writes down what one health probe found and trims the old trail.';

-- -----------------------------------------------------------------------------
-- The domains
-- -----------------------------------------------------------------------------

create or replace function public.save_platform_domain(
  p_purpose text,
  p_hostname text,
  p_expected_records jsonb default '[]'::jsonb,
  p_is_primary boolean default false,
  p_notes text default null
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
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may change the domains'
      using errcode = '42501';
  end if;

  if p_is_primary then
    update public.platform_domains
       set is_primary = false, updated_at = now()
     where purpose = p_purpose;
  end if;

  insert into public.platform_domains (
    purpose, hostname, expected_records, is_primary, notes, updated_by
  )
  values (
    p_purpose, lower(btrim(p_hostname)), coalesce(p_expected_records, '[]'::jsonb),
    coalesce(p_is_primary, false), nullif(btrim(coalesce(p_notes, '')), ''),
    public.current_user_id()
  )
  on conflict (hostname) do update
     set purpose = excluded.purpose,
         expected_records = excluded.expected_records,
         is_primary = excluded.is_primary,
         notes = excluded.notes,
         updated_at = now(),
         updated_by = public.current_user_id()
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.save_platform_domain(text, text, jsonb, boolean, text) is
  'Records a hostname this installation answers on and the DNS it needs.';

create or replace function public.record_domain_check(
  p_domain_id uuid,
  p_is_verified boolean,
  p_message text default null,
  p_failing_records jsonb default '[]'::jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may check the domains'
      using errcode = '42501';
  end if;

  update public.platform_domains
     set is_verified = p_is_verified,
         verified_at = case when p_is_verified then now() else verified_at end,
         last_checked_at = now(),
         last_check_message = left(p_message, 300),
         failing_records = coalesce(p_failing_records, '[]'::jsonb),
         updated_at = now()
   where id = p_domain_id;

  return found;
end;
$$;

comment on function public.record_domain_check(uuid, boolean, text, jsonb) is
  'Stores the outcome of checking the DNS of one hostname.';

create or replace function public.remove_platform_domain(p_domain_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may change the domains'
      using errcode = '42501';
  end if;

  delete from public.platform_domains where id = p_domain_id;

  return found;
end;
$$;

comment on function public.remove_platform_domain(uuid) is
  'Forgets a hostname this installation no longer answers on.';

create or replace function public.platform_domain_list()
returns table (
  domain_id uuid,
  purpose text,
  hostname text,
  expected_records jsonb,
  failing_records jsonb,
  is_verified boolean,
  is_primary boolean,
  verified_at timestamptz,
  last_checked_at timestamptz,
  last_check_message text,
  notes text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may read the domains'
      using errcode = '42501';
  end if;

  return query
    select d.id, d.purpose, d.hostname, d.expected_records, d.failing_records,
           d.is_verified, d.is_primary, d.verified_at, d.last_checked_at,
           d.last_check_message, d.notes
      from public.platform_domains as d
     order by d.purpose, d.hostname;
end;
$$;

comment on function public.platform_domain_list() is
  'Lists every hostname this installation answers on with its DNS state.';

-- -----------------------------------------------------------------------------
-- Is this installation actually ready to trade
-- -----------------------------------------------------------------------------

-- Computed, never stored. A wizard that remembers being completed will one
-- day say an installation is ready while its email is broken; this cannot.
create or replace function public.platform_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_steps jsonb := '[]'::jsonb;
  v_has_brand boolean;
  v_has_sender boolean;
  v_has_email_integration boolean;
  v_has_storage boolean;
  v_has_terms boolean;
  v_has_plan boolean;
  v_has_gateway boolean;
  v_has_app_domain boolean;
  v_has_mail_domain boolean;
  v_has_admin boolean;
  v_done integer;
  v_total integer;
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may read the readiness of this installation'
      using errcode = '42501';
  end if;

  select coalesce(btrim(public.platform_setting('brand.name') #>> '{}'), '') <> ''
    into v_has_brand;

  select coalesce(btrim(public.platform_setting('mail.from_address') #>> '{}'), '') <> ''
    into v_has_sender;

  select exists (
    select 1 from public.integration_credentials
     where company_id is null
       and provider_key in ('resend', 'smtp', 'postmark', 'sendgrid')
       and is_enabled
       and deleted_at is null
  ) into v_has_email_integration;

  select exists (
    select 1 from public.storage_targets
     where company_id is null and is_active and deleted_at is null
  ) into v_has_storage;

  select exists (
    select 1 from public.site_pages
     where page_type = 'legal' and is_published and deleted_at is null
  ) into v_has_terms;

  select exists (
    select 1 from public.subscription_plans
     where is_default_on_signup and deleted_at is null
  ) into v_has_plan;

  select exists (
    select 1 from public.integration_credentials
     where company_id is null
       and provider_key in ('stripe', 'paypal', 'paddle', 'nmi', 'two_checkout')
       and is_enabled
       and deleted_at is null
  ) into v_has_gateway;

  select exists (
    select 1 from public.platform_domains where purpose = 'app' and is_verified
  ) into v_has_app_domain;

  select exists (
    select 1 from public.platform_domains where purpose = 'mail' and is_verified
  ) into v_has_mail_domain;

  select exists (
    select 1 from public.users
     where role = 'super_admin' and deleted_at is null and status = 'active'
  ) into v_has_admin;

  v_steps := v_steps
    || jsonb_build_object('key', 'brand', 'title', 'Name this installation',
         'detail', 'The name and tagline shown in the interface and in every email.',
         'href', '/admin/platform', 'is_done', v_has_brand, 'is_required', true)
    || jsonb_build_object('key', 'administrator', 'title', 'Have a platform administrator',
         'detail', 'At least one active account that can run the platform.',
         'href', '/admin/tenants', 'is_done', v_has_admin, 'is_required', true)
    || jsonb_build_object('key', 'sender', 'title', 'Set the address mail is sent from',
         'detail', 'Every invoice and reminder leaves from this address.',
         'href', '/admin/platform', 'is_done', v_has_sender, 'is_required', true)
    || jsonb_build_object('key', 'email_delivery', 'title', 'Connect something that sends mail',
         'detail', 'Without it an invoice can be raised but never delivered.',
         'href', '/admin/integrations', 'is_done', v_has_email_integration,
         'is_required', true)
    || jsonb_build_object('key', 'mail_domain', 'title', 'Verify the sending domain',
         'detail', 'Until the DNS is right, invoices land in spam and nobody knows why.',
         'href', '/admin/platform', 'is_done', v_has_mail_domain, 'is_required', true)
    || jsonb_build_object('key', 'app_domain', 'title', 'Verify the application domain',
         'detail', 'Where your customers sign in and where client links point.',
         'href', '/admin/platform', 'is_done', v_has_app_domain, 'is_required', true)
    || jsonb_build_object('key', 'storage', 'title', 'Have somewhere to keep files',
         'detail', 'Receipts, contracts and generated documents need a home.',
         'href', '/admin/storage', 'is_done', v_has_storage, 'is_required', true)
    || jsonb_build_object('key', 'default_plan', 'title', 'Choose the plan new signups land on',
         'detail', 'A business that signs up has to land on something.',
         'href', '/admin/plans', 'is_done', v_has_plan, 'is_required', true)
    || jsonb_build_object('key', 'legal', 'title', 'Publish your terms and privacy policy',
         'detail', 'Required before you take money from anybody.',
         'href', '/admin/platform', 'is_done', v_has_terms, 'is_required', true)
    || jsonb_build_object('key', 'collection', 'title', 'Connect a way to collect money',
         'detail', 'A card route, so sellers can be paid by their clients.',
         'href', '/admin/integrations', 'is_done', v_has_gateway, 'is_required', false);

  select count(*) filter (where (step ->> 'is_required')::boolean),
         count(*) filter (where (step ->> 'is_required')::boolean
                            and (step ->> 'is_done')::boolean)
    into v_total, v_done
    from jsonb_array_elements(v_steps) as step;

  return jsonb_build_object(
    'required_count', v_total,
    'required_done', v_done,
    'is_ready', v_done = v_total,
    'steps', v_steps
  );
end;
$$;

comment on function public.platform_readiness() is
  'Works out from the configuration itself whether this installation can trade.';

-- The last few health probes, for the console.
create or replace function public.recent_health_checks(p_limit integer default 20)
returns table (
  checked_at timestamptz,
  is_healthy boolean,
  database_ms integer,
  storage_ok boolean,
  email_ok boolean,
  release_version text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may read the health trail'
      using errcode = '42501';
  end if;

  return query
    select h.checked_at, h.is_healthy, h.database_ms, h.storage_ok, h.email_ok,
           h.release_version
      from public.platform_health_checks as h
     order by h.checked_at desc
     limit greatest(coalesce(p_limit, 20), 1);
end;
$$;

comment on function public.recent_health_checks(integer) is
  'The last few health probes, newest first.';

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.platform_domains enable row level security;
alter table public.platform_health_checks enable row level security;
alter table public.platform_domains force row level security;
alter table public.platform_health_checks force row level security;

create policy platform_domains_select on public.platform_domains
  for select to authenticated
  using (public.is_super_admin());

create policy platform_health_checks_select on public.platform_health_checks
  for select to authenticated
  using (public.is_super_admin());

grant select on public.platform_domains to authenticated;
grant select on public.platform_health_checks to authenticated;

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.record_health_check(
  boolean, integer, boolean, boolean, text, jsonb
) from public, authenticated;
revoke execute on function public.save_platform_domain(text, text, jsonb, boolean, text)
  from public, authenticated;
revoke execute on function public.record_domain_check(uuid, boolean, text, jsonb)
  from public, authenticated;
revoke execute on function public.remove_platform_domain(uuid)
  from public, authenticated;
revoke execute on function public.platform_domain_list()
  from public, authenticated;
revoke execute on function public.platform_readiness()
  from public, authenticated;
revoke execute on function public.recent_health_checks(integer)
  from public, authenticated;

grant execute on function public.record_health_check(
  boolean, integer, boolean, boolean, text, jsonb
) to service_role;
grant execute on function public.save_platform_domain(text, text, jsonb, boolean, text)
  to authenticated, service_role;
grant execute on function public.record_domain_check(uuid, boolean, text, jsonb)
  to authenticated, service_role;
grant execute on function public.remove_platform_domain(uuid)
  to authenticated, service_role;
grant execute on function public.platform_domain_list()
  to authenticated, service_role;
grant execute on function public.platform_readiness()
  to authenticated, service_role;
grant execute on function public.recent_health_checks(integer)
  to authenticated, service_role;

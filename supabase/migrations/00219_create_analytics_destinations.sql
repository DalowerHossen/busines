-- supabase/migrations/00219_create_analytics_destinations.sql
-- Where the measurement of this website is sent.
--
-- Every analytics and advertising tool wants a snippet pasted into the page.
-- Pasting snippets into code means a deployment for every marketing change,
-- and a code base nobody dares touch. So the identifiers live here instead:
-- an administrator types a measurement identifier into the console and the
-- script loads on the next page view.
--
-- Two rules are built into the table rather than left to discipline. First,
-- every destination declares which consent category it belongs to, and
-- nothing loads until the visitor has agreed to that category. Second, the
-- identifier a browser needs and the token a server needs are kept apart:
-- the public identifier is readable by anybody, the access token never
-- leaves the server and is encrypted at rest.

create table public.analytics_destinations (
  id uuid primary key default public.generate_uuid_v7(),

  -- ga4, gtm, meta_pixel, tiktok, linkedin, x_ads, clarity, plausible.
  provider_key text not null,
  label text not null,

  -- What the browser needs: a measurement or container identifier. This is
  -- public by design; it appears in the page source of every website that
  -- uses it.
  public_identifier text not null,

  -- What a server needs to report a conversion without the browser. Never
  -- sent to a browser, encrypted before it arrives here.
  access_token_encrypted text,
  token_hint text,

  -- necessary, analytics or marketing.
  consent_category text not null default 'analytics',

  is_enabled boolean not null default false,
  loads_on_marketing_pages boolean not null default true,
  loads_on_application_pages boolean not null default false,
  notes text,

  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,

  constraint analytics_destinations_provider_check
    check (provider_key in ('ga4', 'gtm', 'meta_pixel', 'tiktok', 'linkedin',
                            'x_ads', 'clarity', 'plausible', 'search_console')),
  constraint analytics_destinations_label_check
    check (length(btrim(label)) between 2 and 60),
  constraint analytics_destinations_identifier_check
    check (public_identifier ~ '^[A-Za-z0-9_.:-]{4,80}$'),
  constraint analytics_destinations_consent_check
    check (consent_category in ('necessary', 'analytics', 'marketing')),
  constraint analytics_destinations_token_hint_check
    check (token_hint is null or length(token_hint) between 3 and 20)
);

comment on table public.analytics_destinations is
  'The measurement and advertising tools this website reports to.';

comment on column public.analytics_destinations.consent_category is
  'Nothing loads until the visitor has agreed to this category.';

comment on column public.analytics_destinations.access_token_encrypted is
  'For server side reporting only. It is never sent to a browser.';

create unique index analytics_destinations_provider_unique
  on public.analytics_destinations (provider_key, public_identifier);

create index analytics_destinations_enabled_idx
  on public.analytics_destinations (provider_key)
  where is_enabled;

-- -----------------------------------------------------------------------------
-- What a page is allowed to load
-- -----------------------------------------------------------------------------

-- Readable by anybody, because this is exactly what ends up in the page
-- source anyway. The token column is not in the result and cannot be.
create or replace function public.active_analytics_destinations(
  p_surface text default 'marketing'
)
returns table (
  provider_key text,
  public_identifier text,
  consent_category text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select d.provider_key, d.public_identifier, d.consent_category
    from public.analytics_destinations as d
   where d.is_enabled
     and case
           when p_surface = 'application' then d.loads_on_application_pages
           else d.loads_on_marketing_pages
         end
   order by d.provider_key;
$$;

comment on function public.active_analytics_destinations(text) is
  'The measurement identifiers one kind of page may load, with the consent each needs.';

-- -----------------------------------------------------------------------------
-- Configuring them
-- -----------------------------------------------------------------------------

create or replace function public.save_analytics_destination(
  p_provider_key text,
  p_label text,
  p_public_identifier text,
  p_consent_category text default 'analytics',
  p_is_enabled boolean default false,
  p_loads_on_marketing_pages boolean default true,
  p_loads_on_application_pages boolean default false,
  p_access_token_encrypted text default null,
  p_token_hint text default null,
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
    raise exception 'Only the platform team may change how this site is measured'
      using errcode = '42501';
  end if;

  insert into public.analytics_destinations (
    provider_key, label, public_identifier, consent_category, is_enabled,
    loads_on_marketing_pages, loads_on_application_pages,
    access_token_encrypted, token_hint, notes, updated_by
  )
  values (
    p_provider_key, btrim(p_label), btrim(p_public_identifier),
    coalesce(p_consent_category, 'analytics'), coalesce(p_is_enabled, false),
    coalesce(p_loads_on_marketing_pages, true),
    coalesce(p_loads_on_application_pages, false),
    p_access_token_encrypted, p_token_hint,
    nullif(btrim(coalesce(p_notes, '')), ''), public.current_user_id()
  )
  on conflict (provider_key, public_identifier) do update
     set label = excluded.label,
         consent_category = excluded.consent_category,
         is_enabled = excluded.is_enabled,
         loads_on_marketing_pages = excluded.loads_on_marketing_pages,
         loads_on_application_pages = excluded.loads_on_application_pages,
         access_token_encrypted =
           coalesce(excluded.access_token_encrypted,
                    public.analytics_destinations.access_token_encrypted),
         token_hint =
           coalesce(excluded.token_hint, public.analytics_destinations.token_hint),
         notes = excluded.notes,
         updated_at = now(),
         updated_by = public.current_user_id()
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.save_analytics_destination(
  text, text, text, text, boolean, boolean, boolean, text, text, text
) is 'Adds or edits one measurement destination without a deployment.';

create or replace function public.remove_analytics_destination(p_destination_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may change how this site is measured'
      using errcode = '42501';
  end if;

  delete from public.analytics_destinations where id = p_destination_id;

  return found;
end;
$$;

comment on function public.remove_analytics_destination(uuid) is
  'Stops reporting to one destination and forgets its identifier.';

-- The console view. The token is represented by its hint and by nothing else.
create or replace function public.analytics_destination_list()
returns table (
  destination_id uuid,
  provider_key text,
  label text,
  public_identifier text,
  consent_category text,
  is_enabled boolean,
  loads_on_marketing_pages boolean,
  loads_on_application_pages boolean,
  has_access_token boolean,
  token_hint text,
  notes text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may read how this site is measured'
      using errcode = '42501';
  end if;

  return query
    select d.id, d.provider_key, d.label, d.public_identifier, d.consent_category,
           d.is_enabled, d.loads_on_marketing_pages, d.loads_on_application_pages,
           d.access_token_encrypted is not null, d.token_hint, d.notes, d.updated_at
      from public.analytics_destinations as d
     order by d.provider_key, d.label;
end;
$$;

comment on function public.analytics_destination_list() is
  'Lists the measurement destinations, showing a hint of any token rather than the token.';

-- Reading one token, for a server side conversion report. Service role only,
-- which is what keeps a token out of every other path in the application.
create or replace function public.analytics_access_token(p_provider_key text)
returns table (
  public_identifier text,
  access_token_encrypted text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_service_role() then
    raise exception 'Only the server may read a measurement token'
      using errcode = '42501';
  end if;

  return query
    select d.public_identifier, d.access_token_encrypted
      from public.analytics_destinations as d
     where d.provider_key = p_provider_key
       and d.is_enabled
       and d.access_token_encrypted is not null
     limit 1;
end;
$$;

comment on function public.analytics_access_token(text) is
  'Returns the still encrypted token for one destination, for the server alone.';

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.analytics_destinations enable row level security;
alter table public.analytics_destinations force row level security;

-- Nobody reads the table directly. The public identifiers come from the
-- reader function, which cannot return a token.
create policy analytics_destinations_select on public.analytics_destinations
  for select to authenticated
  using (public.is_super_admin());

grant select on public.analytics_destinations to authenticated;

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.save_analytics_destination(
  text, text, text, text, boolean, boolean, boolean, text, text, text
) from public, authenticated;
revoke execute on function public.remove_analytics_destination(uuid)
  from public, authenticated;
revoke execute on function public.analytics_destination_list()
  from public, authenticated;
revoke execute on function public.analytics_access_token(text)
  from public, authenticated;

grant execute on function public.active_analytics_destinations(text)
  to anon, authenticated, service_role;
grant execute on function public.save_analytics_destination(
  text, text, text, text, boolean, boolean, boolean, text, text, text
) to authenticated, service_role;
grant execute on function public.remove_analytics_destination(uuid)
  to authenticated, service_role;
grant execute on function public.analytics_destination_list()
  to authenticated, service_role;
grant execute on function public.analytics_access_token(text) to service_role;

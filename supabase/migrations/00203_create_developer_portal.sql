-- supabase/migrations/00203_create_developer_portal.sql
-- The developer portal: the screens around the application platform.
--
-- Registering an application, issuing codes and checking tokens already
-- exist. What is missing is everything a person does between those moments:
-- edit the description, register a return address, put the application
-- forward for review, read the queue, and publish or refuse it.

-- -----------------------------------------------------------------------------
-- What a builder sees
-- -----------------------------------------------------------------------------

create or replace function public.my_developer_apps()
returns table (
  app_id uuid,
  app_slug text,
  app_name text,
  tagline text,
  app_type text,
  distribution text,
  status text,
  client_id text,
  client_secret_hint text,
  requested_scopes text[],
  allowed_scopes text[],
  install_count integer,
  active_installs integer,
  rejection_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.current_user_id();
begin
  if v_user_id is null then
    raise exception 'Sign in to see your applications' using errcode = '42501';
  end if;

  return query
  select a.id,
         a.app_slug,
         a.app_name,
         a.tagline,
         a.app_type,
         a.distribution,
         a.status,
         a.client_id,
         a.client_secret_hint,
         a.requested_scopes,
         a.allowed_scopes,
         a.install_count,
         (
           select count(*) filter (where i.status = 'active')
             from public.developer_app_installs as i
            where i.app_id = a.id
         )::int,
         a.rejection_reason,
         a.submitted_at,
         a.approved_at,
         a.created_at
    from public.developer_apps as a
   where a.deleted_at is null
     and public.can_manage_developer_app(a.id)
   order by a.created_at desc;
end;
$$;

comment on function public.my_developer_apps() is
  'Every application the signed in account may administer.';

create or replace function public.developer_app_detail(p_app_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_app public.developer_apps%rowtype;
begin
  if not public.can_manage_developer_app(p_app_id) then
    raise exception 'That application is not yours to read' using errcode = '42501';
  end if;

  select * into v_app
    from public.developer_apps
   where id = p_app_id
     and deleted_at is null;

  if not found then
    raise exception 'Application % was not found', p_app_id using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'app_id', v_app.id,
    'app_slug', v_app.app_slug,
    'app_name', v_app.app_name,
    'tagline', v_app.tagline,
    'description', v_app.description,
    'homepage_url', v_app.homepage_url,
    'privacy_policy_url', v_app.privacy_policy_url,
    'support_email', v_app.support_email,
    'app_type', v_app.app_type,
    'distribution', v_app.distribution,
    'status', v_app.status,
    'client_id', v_app.client_id,
    'client_secret_hint', v_app.client_secret_hint,
    'secret_rotated_at', v_app.secret_rotated_at,
    'requested_scopes', to_jsonb(v_app.requested_scopes),
    'allowed_scopes', to_jsonb(v_app.allowed_scopes),
    'webhook_url', v_app.webhook_url,
    'rate_limit_per_minute', v_app.rate_limit_per_minute,
    'rejection_reason', v_app.rejection_reason,
    'install_count', v_app.install_count,
    'redirect_uris', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'redirect_uri', r.redirect_uri,
                 'environment', r.environment,
                 'is_active', r.is_active
               )
               order by r.redirect_uri
             )
        from public.developer_app_redirect_uris as r
       where r.app_id = v_app.id
    ), '[]'::jsonb),
    'installs', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'install_id', i.id,
                 'status', i.status,
                 'installed_at', i.installed_at,
                 'last_used_at', i.last_used_at,
                 'request_count', i.request_count,
                 'error_count', i.error_count
               )
               order by i.installed_at desc
             )
        from public.developer_app_installs as i
       where i.app_id = v_app.id
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.developer_app_detail(uuid) is
  'One application with its return addresses and the accounts using it.';

-- -----------------------------------------------------------------------------
-- Editing an application
-- -----------------------------------------------------------------------------

create or replace function public.save_developer_app(
  p_app_id uuid,
  p_app_name text,
  p_tagline text default null,
  p_description text default null,
  p_homepage_url text default null,
  p_privacy_policy_url text default null,
  p_support_email text default null,
  p_webhook_url text default null,
  p_distribution text default 'private'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_app public.developer_apps%rowtype;
  v_distribution text := lower(btrim(coalesce(p_distribution, 'private')));
begin
  if not public.can_manage_developer_app(p_app_id) then
    raise exception 'That application is not yours to change' using errcode = '42501';
  end if;

  if v_distribution not in ('private', 'unlisted', 'public') then
    raise exception 'An application is private, unlisted or public'
      using errcode = '22023';
  end if;

  select * into v_app
    from public.developer_apps
   where id = p_app_id
     and deleted_at is null
   for update;

  if not found then
    raise exception 'Application % was not found', p_app_id using errcode = 'P0002';
  end if;

  if v_app.status in ('suspended', 'retired') then
    raise exception 'A suspended application cannot be edited' using errcode = '22023';
  end if;

  -- Listing an application publicly is a decision for the review queue, so
  -- the jump straight to public is only allowed once it has been approved.
  if v_distribution = 'public' and v_app.status not in (
       'in_review', 'approved'
     ) then
    raise exception 'Submit the application for review before listing it publicly'
      using errcode = '22023';
  end if;

  update public.developer_apps
     set app_name = btrim(p_app_name),
         tagline = nullif(btrim(coalesce(p_tagline, '')), ''),
         description = nullif(btrim(coalesce(p_description, '')), ''),
         homepage_url = nullif(btrim(coalesce(p_homepage_url, '')), ''),
         privacy_policy_url = nullif(btrim(coalesce(p_privacy_policy_url, '')), ''),
         support_email = nullif(btrim(coalesce(p_support_email, '')), '')::citext,
         webhook_url = nullif(btrim(coalesce(p_webhook_url, '')), ''),
         distribution = v_distribution,
         updated_by = public.current_user_id()
   where id = p_app_id;

  return p_app_id;
end;
$$;

comment on function public.save_developer_app(
  uuid, text, text, text, text, text, text, text, text
) is 'Updates how an application describes itself.';

create or replace function public.set_app_redirect_uris(
  p_app_id uuid,
  p_redirect_uris text[]
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not public.can_manage_developer_app(p_app_id) then
    raise exception 'That application is not yours to change' using errcode = '42501';
  end if;

  if coalesce(cardinality(p_redirect_uris), 0) > 10 then
    raise exception 'An application may register up to ten return addresses'
      using errcode = '22023';
  end if;

  delete from public.developer_app_redirect_uris
   where app_id = p_app_id
     and (p_redirect_uris is null or not (redirect_uri = any (p_redirect_uris)));

  insert into public.developer_app_redirect_uris (app_id, redirect_uri, created_by)
  select p_app_id, uri, public.current_user_id()
    from unnest(coalesce(p_redirect_uris, array[]::text[])) as uri
  on conflict (app_id, redirect_uri) do nothing;

  select count(*)::int into v_count
    from public.developer_app_redirect_uris
   where app_id = p_app_id;

  return v_count;
end;
$$;

comment on function public.set_app_redirect_uris(uuid, text[]) is
  'Replaces the exact addresses an authorisation may be returned to.';

-- -----------------------------------------------------------------------------
-- Review
-- -----------------------------------------------------------------------------

create or replace function public.submit_developer_app(
  p_app_id uuid,
  p_requested_scopes text[] default null
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_app public.developer_apps%rowtype;
  v_scopes text[];
begin
  if not public.can_manage_developer_app(p_app_id) then
    raise exception 'That application is not yours to submit' using errcode = '42501';
  end if;

  select * into v_app
    from public.developer_apps
   where id = p_app_id
     and deleted_at is null
   for update;

  if not found then
    raise exception 'Application % was not found', p_app_id using errcode = 'P0002';
  end if;

  if v_app.status not in ('draft', 'rejected') then
    raise exception 'That application is not waiting to be submitted'
      using errcode = '22023';
  end if;

  v_scopes := coalesce(p_requested_scopes, v_app.requested_scopes);

  if coalesce(cardinality(v_scopes), 0) = 0 then
    raise exception 'Say which permissions the application needs'
      using errcode = '22023';
  end if;

  if v_app.app_type = 'oauth' and not exists (
    select 1 from public.developer_app_redirect_uris
     where app_id = p_app_id and is_active
  ) then
    raise exception 'Register a return address before asking for review'
      using errcode = '22023';
  end if;

  update public.developer_apps
     set status = 'in_review',
         requested_scopes = v_scopes,
         submitted_at = now(),
         rejection_reason = null,
         updated_by = public.current_user_id()
   where id = p_app_id;

  perform public.record_manual_audit_entry(
    'update'::public.audit_action,
    'developer_app',
    p_app_id,
    v_app.owner_company_id,
    'Application submitted for review.',
    jsonb_build_object('scopes', to_jsonb(v_scopes))
  );

  return 'in_review';
end;
$$;

comment on function public.submit_developer_app(uuid, text[]) is
  'Puts an application in front of the platform team for a decision.';

create or replace function public.reject_developer_app(
  p_app_id uuid,
  p_reason text
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_app public.developer_apps%rowtype;
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception 'Only the platform team can refuse an application'
      using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Say why the application is being refused' using errcode = '22023';
  end if;

  select * into v_app
    from public.developer_apps
   where id = p_app_id
     and deleted_at is null
   for update;

  if not found then
    raise exception 'Application % was not found', p_app_id using errcode = 'P0002';
  end if;

  if v_app.status <> 'in_review' then
    raise exception 'That application is not waiting for a decision'
      using errcode = '22023';
  end if;

  update public.developer_apps
     set status = 'rejected',
         rejection_reason = btrim(p_reason),
         distribution = case when distribution = 'public' then 'private'
                             else distribution end,
         updated_by = public.current_user_id()
   where id = p_app_id;

  return 'rejected';
end;
$$;

comment on function public.reject_developer_app(uuid, text) is
  'Refuses an application and tells the builder what to change.';

create or replace function public.set_developer_app_status(
  p_app_id uuid,
  p_status text,
  p_reason text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text := lower(btrim(coalesce(p_status, '')));
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception 'Only the platform team can change an application state'
      using errcode = '42501';
  end if;

  if v_status not in ('suspended', 'retired', 'approved') then
    raise exception 'An application is suspended, retired or approved here'
      using errcode = '22023';
  end if;

  if v_status = 'suspended' and length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Say why the application is being suspended'
      using errcode = '22023';
  end if;

  update public.developer_apps
     set status = v_status,
         suspended_at = case when v_status = 'suspended' then now() else null end,
         suspension_reason = case when v_status = 'suspended'
                                  then btrim(p_reason) else null end,
         approved_at = case when v_status = 'approved'
                            then coalesce(approved_at, now()) else approved_at end,
         updated_by = public.current_user_id()
   where id = p_app_id
     and deleted_at is null;

  if not found then
    raise exception 'Application % was not found', p_app_id using errcode = 'P0002';
  end if;

  -- A suspended application loses its grants immediately, because the point
  -- of suspending it is that it should stop making calls.
  if v_status = 'suspended' then
    update public.developer_app_installs
       set status = 'suspended',
           updated_at = now()
     where app_id = p_app_id
       and status = 'active';

    update public.developer_access_tokens
       set revoked_at = now()
     where app_id = p_app_id
       and revoked_at is null;
  end if;

  return v_status;
end;
$$;

comment on function public.set_developer_app_status(uuid, text, text) is
  'Suspends, retires or restores an application across the whole platform.';

create or replace function public.developer_app_queue()
returns table (
  app_id uuid,
  app_slug text,
  app_name text,
  tagline text,
  app_type text,
  distribution text,
  status text,
  requested_scopes text[],
  owner_company_id uuid,
  owner_name text,
  support_email text,
  homepage_url text,
  submitted_at timestamptz,
  install_count integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Only the platform team can read the application queue'
      using errcode = '42501';
  end if;

  return query
  select a.id,
         a.app_slug,
         a.app_name,
         a.tagline,
         a.app_type,
         a.distribution,
         a.status,
         a.requested_scopes,
         a.owner_company_id,
         coalesce(c.display_name, r.partner_name, 'Platform team'),
         a.support_email::text,
         a.homepage_url,
         a.submitted_at,
         a.install_count
    from public.developer_apps as a
    left join public.companies as c on c.id = a.owner_company_id
    left join public.resellers as r on r.id = a.owner_reseller_id
   where a.deleted_at is null
   order by case a.status when 'in_review' then 0 else 1 end,
            a.submitted_at desc nulls last,
            a.created_at desc;
end;
$$;

comment on function public.developer_app_queue() is
  'Every application the platform team may have to decide about.';

-- -----------------------------------------------------------------------------
-- The public directory
-- -----------------------------------------------------------------------------

create or replace function public.developer_app_directory()
returns table (
  app_slug text,
  app_name text,
  tagline text,
  description text,
  app_type text,
  homepage_url text,
  support_email text,
  allowed_scopes text[],
  install_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.app_slug,
         a.app_name,
         a.tagline,
         a.description,
         a.app_type,
         a.homepage_url,
         a.support_email::text,
         a.allowed_scopes,
         a.install_count
    from public.developer_apps as a
   where a.deleted_at is null
     and a.status = 'approved'
     and a.distribution = 'public'
   order by a.install_count desc, a.app_name;
$$;

comment on function public.developer_app_directory() is
  'The applications anybody may connect, for the public directory page.';

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on function public.my_developer_apps() from public;
grant execute on function public.my_developer_apps() to authenticated, service_role;

revoke all on function public.developer_app_detail(uuid) from public;
grant execute on function public.developer_app_detail(uuid)
  to authenticated, service_role;

revoke all on function public.save_developer_app(
  uuid, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.save_developer_app(
  uuid, text, text, text, text, text, text, text, text
) to authenticated, service_role;

revoke all on function public.set_app_redirect_uris(uuid, text[]) from public;
grant execute on function public.set_app_redirect_uris(uuid, text[])
  to authenticated, service_role;

revoke all on function public.submit_developer_app(uuid, text[]) from public;
grant execute on function public.submit_developer_app(uuid, text[])
  to authenticated, service_role;

revoke all on function public.reject_developer_app(uuid, text) from public;
grant execute on function public.reject_developer_app(uuid, text)
  to authenticated, service_role;

revoke all on function public.set_developer_app_status(uuid, text, text) from public;
grant execute on function public.set_developer_app_status(uuid, text, text)
  to authenticated, service_role;

revoke all on function public.developer_app_queue() from public;
grant execute on function public.developer_app_queue()
  to authenticated, service_role;

revoke all on function public.developer_app_directory() from public;
grant execute on function public.developer_app_directory()
  to anon, authenticated, service_role;

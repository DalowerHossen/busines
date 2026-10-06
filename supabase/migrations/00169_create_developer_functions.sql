-- supabase/migrations/00169_create_developer_functions.sql
-- Authorising an application, issuing tokens, and taking access back.

-- May the caller administer this application?
create or replace function public.can_manage_developer_app(p_app_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.developer_apps as a
     where a.id = p_app_id
       and a.deleted_at is null
       and (
         public.is_super_admin()
         or (a.owner_company_id is not null
             and public.is_company_owner(a.owner_company_id))
         or (a.owner_reseller_id is not null
             and public.is_reseller_owner(a.owner_reseller_id))
       )
  );
$$;

comment on function public.can_manage_developer_app(uuid) is
  'Returns whether the caller may administer this developer application.';

-- Registers an application and hands its credentials back exactly once.
create or replace function public.register_developer_app(
  p_app_slug text,
  p_app_name text,
  p_app_type text default 'oauth',
  p_requested_scopes text[] default array['invoices:read']::text[],
  p_owner_company_id uuid default null
)
returns table (app_id uuid, client_id text, client_secret text)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_app_id uuid;
  v_client_id text;
  v_secret text;
begin
  if p_owner_company_id is not null then
    if not coalesce(
        public.is_service_role()
        or public.is_super_admin()
        or public.is_company_owner(p_owner_company_id),
        false
      ) then
      raise exception 'Only the account owner can register an application'
        using errcode = '42501';
    end if;
  elsif not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'A platform application is registered by the platform'
      using errcode = '42501';
  end if;

  if coalesce(cardinality(p_requested_scopes), 0) = 0 then
    raise exception 'An application has to ask for at least one permission'
      using errcode = '22023';
  end if;

  v_client_id := 'app_' || replace(public.generate_secure_token(24), '-', '');
  v_secret := public.generate_secure_token(48);

  insert into public.developer_apps (
    owner_company_id, app_slug, app_name, app_type, requested_scopes,
    client_id, client_secret_encrypted, client_secret_hint, created_by
  )
  values (
    p_owner_company_id, p_app_slug, p_app_name, p_app_type, p_requested_scopes,
    v_client_id, encode(extensions.digest(v_secret, 'sha256'), 'hex'),
    right(v_secret, 6), public.current_user_id()
  )
  returning id into v_app_id;

  return query select v_app_id, v_client_id, v_secret;
end;
$$;

comment on function public.register_developer_app(
  text, text, text, text[], uuid
) is 'Registers a developer application and returns its one time secret.';

-- Approves an application and fixes the permissions it may ever ask for.
create or replace function public.approve_developer_app(
  p_app_id uuid,
  p_allowed_scopes text[]
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Only the platform can approve an application'
      using errcode = '42501';
  end if;

  if coalesce(cardinality(p_allowed_scopes), 0) = 0 then
    raise exception 'An approved application needs at least one permission'
      using errcode = '22023';
  end if;

  update public.developer_apps
     set status = 'approved',
         allowed_scopes = p_allowed_scopes,
         approved_at = now(),
         approved_by = public.current_user_id(),
         rejection_reason = null,
         updated_at = now()
   where id = p_app_id
     and deleted_at is null
     and status in ('draft', 'in_review', 'suspended');

  return found;
end;
$$;

comment on function public.approve_developer_app(uuid, text[]) is
  'Approves an application and fixes the permissions it may request.';

-- Starts an authorisation. The owner is agreeing on behalf of the tenant.
create or replace function public.create_authorization_code(
  p_app_id uuid,
  p_company_id uuid,
  p_redirect_uri text,
  p_requested_scopes text[],
  p_code_challenge text default null,
  p_code_challenge_method text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_app public.developer_apps%rowtype;
  v_code text;
  v_unknown text[];
begin
  if not coalesce(public.is_service_role() or public.is_company_owner(p_company_id), false) then
    raise exception 'Only the account owner can connect an application'
      using errcode = '42501';
  end if;

  select * into v_app
    from public.developer_apps
   where id = p_app_id and deleted_at is null;

  if not found or v_app.status <> 'approved' then
    raise exception 'That application is not approved' using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.developer_app_redirect_uris
     where app_id = p_app_id
       and redirect_uri = p_redirect_uri
       and is_active
  ) then
    raise exception 'That address is not registered for this application'
      using errcode = '22023';
  end if;

  select array_agg(s) into v_unknown
    from unnest(p_requested_scopes) as s
   where not (s = any (v_app.allowed_scopes));

  if v_unknown is not null then
    raise exception 'This application may not ask for %', array_to_string(v_unknown, ', ')
      using errcode = '42501';
  end if;

  v_code := public.generate_secure_token(40);

  insert into public.developer_auth_codes (
    app_id, company_id, user_id, code_hash, redirect_uri, requested_scopes,
    code_challenge, code_challenge_method, expires_at
  )
  values (
    p_app_id, p_company_id, public.current_user_id(),
    encode(extensions.digest(v_code, 'sha256'), 'hex'), p_redirect_uri,
    p_requested_scopes, p_code_challenge, p_code_challenge_method,
    now() + interval '10 minutes'
  );

  return v_code;
end;
$$;

comment on function public.create_authorization_code(
  uuid, uuid, text, text[], text, text
) is 'Issues a short lived authorisation code after an owner consents.';

-- Trades a code for a token pair. A code works once and then is dead.
create or replace function public.exchange_authorization_code(
  p_code text,
  p_client_id text,
  p_redirect_uri text
)
returns table (
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scopes text[]
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_code public.developer_auth_codes%rowtype;
  v_app public.developer_apps%rowtype;
  v_install_id uuid;
  v_access text;
  v_refresh text;
  v_expires timestamptz;
begin
  if not public.is_service_role() then
    raise exception 'Tokens are issued by the platform, not by a client'
      using errcode = '42501';
  end if;

  select * into v_code
    from public.developer_auth_codes
   where code_hash = encode(extensions.digest(p_code, 'sha256'), 'hex')
     for update;

  if not found then
    raise exception 'That authorisation code is not valid'
      using errcode = '22023';
  end if;

  if v_code.consumed_at is not null then
    raise exception 'That authorisation code has already been used'
      using errcode = '22023';
  end if;

  if v_code.expires_at <= now() then
    raise exception 'That authorisation code has expired'
      using errcode = '22023';
  end if;

  if v_code.redirect_uri <> p_redirect_uri then
    raise exception 'The return address does not match the authorisation'
      using errcode = '22023';
  end if;

  select * into v_app
    from public.developer_apps
   where id = v_code.app_id;

  if v_app.client_id <> p_client_id then
    raise exception 'That code belongs to a different application'
      using errcode = '42501';
  end if;

  update public.developer_auth_codes
     set consumed_at = now()
   where id = v_code.id;

  insert into public.developer_app_installs (
    app_id, company_id, granted_scopes, installed_by
  )
  values (v_code.app_id, v_code.company_id, v_code.requested_scopes,
          v_code.user_id)
  on conflict (app_id, company_id) where status <> 'revoked'
  do update set granted_scopes = excluded.granted_scopes,
                status = 'active',
                updated_at = now()
  returning id into v_install_id;

  update public.developer_apps
     set install_count = (
           select count(*)
             from public.developer_app_installs
            where app_id = v_code.app_id and status = 'active'
         ),
         updated_at = now()
   where id = v_code.app_id;

  v_access := public.generate_secure_token(40);
  v_refresh := public.generate_secure_token(40);
  v_expires := now() + interval '1 hour';

  insert into public.developer_access_tokens (
    install_id, app_id, company_id, token_hash, token_hint, token_type,
    scopes, expires_at
  )
  values
    (v_install_id, v_code.app_id, v_code.company_id,
     encode(extensions.digest(v_access, 'sha256'), 'hex'), right(v_access, 6),
     'access', v_code.requested_scopes, v_expires),
    (v_install_id, v_code.app_id, v_code.company_id,
     encode(extensions.digest(v_refresh, 'sha256'), 'hex'), right(v_refresh, 6),
     'refresh', v_code.requested_scopes, now() + interval '60 days');

  return query select v_access, v_refresh, v_expires, v_code.requested_scopes;
end;
$$;

comment on function public.exchange_authorization_code(text, text, text) is
  'Trades a single use authorisation code for an access and refresh token.';

-- Checks a presented token and reports who it speaks for.
create or replace function public.authenticate_developer_token(p_token text)
returns table (
  install_id uuid,
  app_id uuid,
  company_id uuid,
  scopes text[]
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_token public.developer_access_tokens%rowtype;
  v_install public.developer_app_installs%rowtype;
begin
  if not public.is_service_role() then
    raise exception 'Tokens are checked by the platform' using errcode = '42501';
  end if;

  select * into v_token
    from public.developer_access_tokens
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and token_type = 'access';

  if not found or v_token.revoked_at is not null then
    return;
  end if;

  if v_token.expires_at is not null and v_token.expires_at <= now() then
    return;
  end if;

  select * into v_install
    from public.developer_app_installs
   where id = v_token.install_id;

  if v_install.status <> 'active' then
    return;
  end if;

  update public.developer_access_tokens
     set last_used_at = now(),
         use_count = use_count + 1
   where id = v_token.id;

  update public.developer_app_installs
     set last_used_at = now(),
         request_count = request_count + 1,
         updated_at = now()
   where id = v_token.install_id;

  return query
  select v_token.install_id, v_token.app_id, v_token.company_id, v_token.scopes;
end;
$$;

comment on function public.authenticate_developer_token(text) is
  'Validates an application token and returns the grant behind it.';

-- Does this grant cover the thing being attempted?
create or replace function public.developer_token_has_scope(
  p_install_id uuid,
  p_scope text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.developer_app_installs as i
     where i.id = p_install_id
       and i.status = 'active'
       and (p_scope = any (i.granted_scopes)
            or split_part(p_scope, ':', 1) || ':*' = any (i.granted_scopes))
  );
$$;

comment on function public.developer_token_has_scope(uuid, text) is
  'Returns whether an application grant covers the permission asked for.';

-- Takes an application back off an account, with every token it held.
create or replace function public.revoke_app_install(
  p_install_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_install public.developer_app_installs%rowtype;
begin
  select * into v_install
    from public.developer_app_installs
   where id = p_install_id
     for update;

  if not found then
    return false;
  end if;

  if not coalesce(
      public.is_service_role()
      or public.is_super_admin()
      or public.is_company_owner(v_install.company_id),
      false
    ) then
    raise exception 'Only the account owner can disconnect an application'
      using errcode = '42501';
  end if;

  if v_install.status = 'revoked' then
    return false;
  end if;

  update public.developer_app_installs
     set status = 'revoked',
         revoked_at = now(),
         revoked_by = public.current_user_id(),
         revocation_reason = p_reason,
         updated_at = now()
   where id = p_install_id;

  update public.developer_access_tokens
     set revoked_at = now(),
         revocation_reason = coalesce(p_reason, 'Application disconnected')
   where install_id = p_install_id
     and revoked_at is null;

  update public.developer_apps
     set install_count = (
           select count(*)
             from public.developer_app_installs
            where app_id = v_install.app_id and status = 'active'
         ),
         updated_at = now()
   where id = v_install.app_id;

  return true;
end;
$$;

comment on function public.revoke_app_install(uuid, text) is
  'Disconnects an application from an account and kills its tokens.';

-- Issues a new secret while the old one keeps working for five minutes.
create or replace function public.rotate_app_secret(p_app_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_app public.developer_apps%rowtype;
  v_secret text;
begin
  select * into v_app
    from public.developer_apps
   where id = p_app_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That application does not exist' using errcode = 'P0002';
  end if;

  if not coalesce(public.is_service_role() or public.can_manage_developer_app(p_app_id), false) then
    raise exception 'That application belongs to someone else'
      using errcode = '42501';
  end if;

  v_secret := public.generate_secure_token(48);

  update public.developer_apps
     set previous_secret_encrypted = client_secret_encrypted,
         previous_secret_expires_at = now() + interval '5 minutes',
         client_secret_encrypted = encode(extensions.digest(v_secret, 'sha256'), 'hex'),
         client_secret_hint = right(v_secret, 6),
         secret_rotated_at = now(),
         updated_at = now()
   where id = p_app_id;

  return v_secret;
end;
$$;

comment on function public.rotate_app_secret(uuid) is
  'Issues a new application secret and keeps the old one alive briefly.';

-- Clears codes and tokens that nobody can use any more.
create or replace function public.expire_developer_credentials()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
  v_tokens integer := 0;
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Only the platform clears expired credentials'
      using errcode = '42501';
  end if;

  delete from public.developer_auth_codes
   where expires_at < now() - interval '1 day';

  get diagnostics v_count = row_count;

  with expired as (
    update public.developer_access_tokens
       set revoked_at = now(),
           revocation_reason = 'Expired'
     where revoked_at is null
       and expires_at is not null
       and expires_at < now()
    returning 1
  )
  select count(*)::int into v_tokens from expired;

  update public.developer_apps
     set previous_secret_encrypted = null,
         previous_secret_expires_at = null,
         updated_at = now()
   where previous_secret_expires_at is not null
     and previous_secret_expires_at < now();

  return v_count + v_tokens;
end;
$$;

comment on function public.expire_developer_credentials() is
  'Clears authorisation codes and tokens that can no longer be used.';

-- What an owner sees on the connected applications screen.
create or replace function public.connected_apps(p_company_id uuid)
returns table (
  install_id uuid,
  app_name text,
  app_slug text,
  granted_scopes text[],
  installed_at timestamptz,
  last_used_at timestamptz,
  request_count bigint,
  status text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_service_role() or public.has_company_access(p_company_id), false) then
    raise exception 'That account is not yours to read' using errcode = '42501';
  end if;

  return query
  select i.id,
         a.app_name,
         a.app_slug,
         i.granted_scopes,
         i.installed_at,
         i.last_used_at,
         i.request_count,
         i.status
    from public.developer_app_installs as i
    join public.developer_apps as a on a.id = i.app_id
   where i.company_id = p_company_id
   order by i.installed_at desc;
end;
$$;

comment on function public.connected_apps(uuid) is
  'Lists the applications connected to an account and how they are used.';

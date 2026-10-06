-- supabase/migrations/00144_create_credential_resolution.sql
-- Working out which credential actually applies.
--
-- The order is always the same: a credential saved for this tenant, then the
-- platform credential, then the environment variable the catalogue names,
-- then the built in default. The database can answer the first two and can
-- say which environment variable to look at next, which is enough for the
-- application to finish the job without guessing.

-- Resolves one provider for one tenant. The secret bundle comes back still
-- encrypted; only the application can open it.
create or replace function public.resolve_integration(
  p_company_id uuid,
  p_provider_key text,
  p_environment text default 'live'
)
returns table (
  credential_id uuid,
  source text,
  company_id uuid,
  provider_key text,
  environment text,
  secret_bundle_encrypted text,
  encryption_key_version smallint,
  previous_bundle_encrypted text,
  previous_bundle_valid_until timestamptz,
  public_config jsonb,
  is_enabled boolean,
  status text,
  env_fallback jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_environment text := coalesce(p_environment, 'live');
  v_env_fallback jsonb;
  v_row public.integration_credentials%rowtype;
begin
  -- The bundle this returns is still ciphertext, but it is the ciphertext of
  -- a real key, so only the server side of the application may ask for it.
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Credentials are resolved on the server only'
      using errcode = '42501';
  end if;

  -- The environment variables this provider would fall back to, so the
  -- caller never has to hold a second copy of that mapping.
  select coalesce(
           jsonb_object_agg(entry ->> 'key', entry ->> 'env_var')
             filter (where entry ->> 'env_var' is not null),
           '{}'::jsonb
         )
    into v_env_fallback
    from public.integration_providers as p
    cross join lateral jsonb_array_elements(p.field_schema) as entry
   where p.provider_key = p_provider_key;

  -- A credential the tenant saved for itself wins.
  if p_company_id is not null then
    select * into v_row
      from public.integration_credentials as c
     where c.company_id = p_company_id
       and c.provider_key = p_provider_key
       and c.environment = v_environment
       and c.is_enabled
       and c.deleted_at is null;

    if found then
      return query
      select v_row.id, 'tenant'::text, v_row.company_id, v_row.provider_key,
             v_row.environment, v_row.secret_bundle_encrypted,
             v_row.encryption_key_version, v_row.previous_bundle_encrypted,
             v_row.previous_bundle_valid_until, v_row.public_config,
             v_row.is_enabled, v_row.status, coalesce(v_env_fallback, '{}'::jsonb);
      return;
    end if;
  end if;

  -- Otherwise the platform credential.
  select * into v_row
    from public.integration_credentials as c
   where c.company_id is null
     and c.provider_key = p_provider_key
     and c.environment = v_environment
     and c.is_enabled
     and c.deleted_at is null;

  if found then
    return query
    select v_row.id, 'platform'::text, v_row.company_id, v_row.provider_key,
           v_row.environment, v_row.secret_bundle_encrypted,
           v_row.encryption_key_version, v_row.previous_bundle_encrypted,
           v_row.previous_bundle_valid_until, v_row.public_config,
           v_row.is_enabled, v_row.status, coalesce(v_env_fallback, '{}'::jsonb);
    return;
  end if;

  -- Nothing is configured, so the application reads the environment.
  return query
  select null::uuid, 'environment'::text, p_company_id, p_provider_key,
         v_environment, null::text, 1::smallint, null::text, null::timestamptz,
         '{}'::jsonb, false, 'unconfigured'::text,
         coalesce(v_env_fallback, '{}'::jsonb);
end;
$$;

comment on function public.resolve_integration(uuid, text, text) is
  'Resolves a provider as tenant credential, then platform, then environment.';

-- Is this provider usable at all for this tenant right now?
create or replace function public.integration_is_available(
  p_company_id uuid,
  p_provider_key text,
  p_environment text default 'live'
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.integration_credentials as c
     where c.provider_key = p_provider_key
       and c.environment = coalesce(p_environment, 'live')
       and c.is_enabled
       and c.deleted_at is null
       and (c.company_id is null or c.company_id = p_company_id)
  );
$$;

comment on function public.integration_is_available(uuid, text, text) is
  'Returns whether a provider is configured and switched on for a tenant.';

-- What the settings screen shows: every provider, whether it is connected,
-- at which level, and the masked hint of each secret. No ciphertext leaves
-- this function, let alone a secret.
create or replace function public.integration_overview(
  p_company_id uuid default null
)
returns table (
  provider_key text,
  name text,
  category text,
  summary text,
  configurable_by text,
  documentation_url text,
  logo_slug text,
  credential_id uuid,
  scope text,
  environment text,
  is_enabled boolean,
  status text,
  masked_hints jsonb,
  public_config jsonb,
  last_tested_at timestamptz,
  last_test_succeeded boolean,
  last_used_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  config_version integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_company_id is null then
    if not (public.is_service_role() or public.is_super_admin()) then
      raise exception 'Only the platform team can see the platform connections'
        using errcode = '42501';
    end if;
  elsif not public.has_company_access(p_company_id) then
    raise exception 'You cannot see the connections of another tenant'
      using errcode = '42501';
  end if;

  return query
  select p.provider_key,
         p.name,
         p.category,
         p.summary,
         p.configurable_by,
         p.documentation_url,
         p.logo_slug,
         c.id,
         case
           when c.id is null then 'none'
           when c.company_id is null then 'platform'
           else 'tenant'
         end,
         c.environment,
         coalesce(c.is_enabled, false),
         coalesce(c.status, 'unconfigured'),
         coalesce(c.masked_hints, '{}'::jsonb),
         coalesce(c.public_config, '{}'::jsonb),
         c.last_tested_at,
         c.last_test_succeeded,
         c.last_used_at,
         c.last_error,
         c.last_error_at,
         coalesce(c.config_version, 0)
    from public.integration_providers as p
    left join lateral (
      select *
        from public.integration_credentials as k
       where k.provider_key = p.provider_key
         and k.deleted_at is null
         and (
           (p_company_id is not null and k.company_id = p_company_id)
           or (p_company_id is null and k.company_id is null)
         )
       order by k.environment
       limit 1
    ) as c on true
   where p.is_active
   order by p.category, p.sort_order;
end;
$$;

comment on function public.integration_overview(uuid) is
  'The connection list the settings screen renders, with secrets masked.';

-- The connections that are shouting for attention.
create or replace function public.failing_integrations(
  p_company_id uuid default null
)
returns table (
  credential_id uuid,
  provider_key text,
  environment text,
  consecutive_failures smallint,
  last_error text,
  last_error_at timestamptz,
  last_success_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_company_id is null then
    if not (public.is_service_role() or public.is_super_admin()) then
      raise exception 'Only the platform team can see the platform connections'
        using errcode = '42501';
    end if;
  elsif not public.has_company_access(p_company_id) then
    raise exception 'You cannot see the connections of another tenant'
      using errcode = '42501';
  end if;

  return query
  select c.id,
         c.provider_key,
         c.environment,
         c.consecutive_failures,
         c.last_error,
         c.last_error_at,
         c.last_success_at
    from public.integration_credentials as c
   where c.deleted_at is null
     and c.status = 'failing'
     and c.company_id is not distinct from p_company_id
   order by c.last_error_at desc nulls last;
end;
$$;

comment on function public.failing_integrations(uuid) is
  'Lists the connections that are failing, so somebody can fix them.';

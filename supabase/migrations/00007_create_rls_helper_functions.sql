-- supabase/migrations/00007_create_rls_helper_functions.sql
-- Access control helpers used by every Row Level Security policy.
--
-- The functions are written in PL/pgSQL so that they can be created before the
-- tables they read. They are SECURITY DEFINER with a pinned search_path, which
-- lets a policy evaluate the caller's role without granting the caller direct
-- read access to the identity tables.
--
-- Tenancy rule enforced across the platform:
--   super_admin  sees everything
--   reseller     sees billing metadata of its own sub tenants only
--   owner/staff  see exactly one company
--   accountant   sees every company that granted explicit access
--   affiliate    sees no company data at all

-- Returns the authenticated user identifier, or null for anonymous requests.
create or replace function public.current_user_id()
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

comment on function public.current_user_id() is
  'Returns the authenticated user identifier from the request JWT.';

-- Returns the role of the authenticated user.
create or replace function public.current_user_role()
returns public.user_role
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_role public.user_role;
begin
  if v_user_id is null then
    return null;
  end if;

  execute 'select role from public.users where id = $1 and deleted_at is null'
    into v_role
    using v_user_id;

  return v_role;
end;
$$;

comment on function public.current_user_role() is
  'Returns the account role of the authenticated user.';

-- Returns true when the caller is a platform super administrator.
create or replace function public.is_super_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return public.current_user_role() = 'super_admin';
end;
$$;

comment on function public.is_super_admin() is
  'Returns true when the authenticated user is a platform super administrator.';

-- Returns the company that the authenticated user belongs to.
create or replace function public.current_company_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_company_id uuid;
begin
  if v_user_id is null then
    return null;
  end if;

  execute 'select company_id from public.users where id = $1 and deleted_at is null'
    into v_company_id
    using v_user_id;

  return v_company_id;
end;
$$;

comment on function public.current_company_id() is
  'Returns the company identifier of the authenticated user, if any.';

-- Returns true when the caller owns the supplied company.
create or replace function public.is_company_owner(p_company_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_exists boolean;
begin
  if v_user_id is null or p_company_id is null then
    return false;
  end if;

  execute 'select exists (
             select 1
               from public.users
              where id = $1
                and company_id = $2
                and role = ''owner''
                and status = ''active''
                and deleted_at is null
           )'
    into v_exists
    using v_user_id, p_company_id;

  return coalesce(v_exists, false);
end;
$$;

comment on function public.is_company_owner(uuid) is
  'Returns true when the authenticated user is the owner of the supplied company.';

-- Returns true when an accountant has an active grant for the supplied company.
create or replace function public.has_accountant_access(p_company_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_exists boolean;
begin
  if v_user_id is null or p_company_id is null then
    return false;
  end if;

  execute 'select exists (
             select 1
               from public.accountant_company_access
              where accountant_user_id = $1
                and company_id = $2
                and status = ''active''
                and deleted_at is null
                and (expires_at is null or expires_at > now())
           )'
    into v_exists
    using v_user_id, p_company_id;

  return coalesce(v_exists, false);
end;
$$;

comment on function public.has_accountant_access(uuid) is
  'Returns true when the authenticated accountant holds an active grant for the company.';

-- Returns true when a reseller manages the supplied company.
-- A reseller sees billing metadata only; business records remain private.
create or replace function public.is_managing_reseller(p_company_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_exists boolean;
begin
  if v_user_id is null or p_company_id is null then
    return false;
  end if;

  execute 'select exists (
             select 1
               from public.companies c
               join public.resellers r on r.id = c.reseller_id
              where c.id = $2
                and r.user_id = $1
                and r.status = ''approved''
                and r.deleted_at is null
                and c.deleted_at is null
           )'
    into v_exists
    using v_user_id, p_company_id;

  return coalesce(v_exists, false);
end;
$$;

comment on function public.is_managing_reseller(uuid) is
  'Returns true when the authenticated reseller manages the supplied company.';

-- Primary tenancy guard used by business tables.
create or replace function public.has_company_access(p_company_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.user_role;
begin
  if p_company_id is null then
    return false;
  end if;

  v_role := public.current_user_role();

  if v_role is null then
    return false;
  end if;

  if v_role = 'super_admin' then
    return true;
  end if;

  if v_role = 'affiliate' then
    return false;
  end if;

  if v_role in ('owner', 'staff') then
    return public.current_company_id() = p_company_id;
  end if;

  if v_role = 'accountant' then
    return public.has_accountant_access(p_company_id);
  end if;

  return false;
end;
$$;

comment on function public.has_company_access(uuid) is
  'Primary tenancy guard. Returns true when the caller may read company data.';

-- Write guard. Accountants and resellers never write business records.
create or replace function public.can_write_company_data(p_company_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.user_role;
begin
  if p_company_id is null then
    return false;
  end if;

  v_role := public.current_user_role();

  if v_role = 'super_admin' then
    return true;
  end if;

  if v_role in ('owner', 'staff') then
    return public.current_company_id() = p_company_id;
  end if;

  return false;
end;
$$;

comment on function public.can_write_company_data(uuid) is
  'Returns true when the caller may create, update or soft delete company data.';

-- Granular staff permission check.
-- Owners hold every permission implicitly; staff permissions are stored as a
-- JSON object of the form {"invoices": ["view", "create"], "clients": ["view"]}.
create or replace function public.has_permission(p_resource text, p_action public.permission_action)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_role public.user_role;
  v_permissions jsonb;
begin
  if v_user_id is null or p_resource is null then
    return false;
  end if;

  v_role := public.current_user_role();

  if v_role in ('super_admin', 'owner') then
    return true;
  end if;

  if v_role <> 'staff' then
    return false;
  end if;

  execute 'select permissions from public.users where id = $1 and deleted_at is null'
    into v_permissions
    using v_user_id;

  if v_permissions is null then
    return false;
  end if;

  return coalesce(v_permissions -> p_resource, '[]'::jsonb) ? p_action::text;
end;
$$;

comment on function public.has_permission(text, public.permission_action) is
  'Returns true when the caller holds the requested permission on a resource.';

-- Returns true when the request is executed by a trusted server process that
-- uses the service role key, for example a scheduled job or a webhook handler.
create or replace function public.is_service_role()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role';
$$;

comment on function public.is_service_role() is
  'Returns true when the current request authenticates with the service role key.';

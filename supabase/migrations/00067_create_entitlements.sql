-- supabase/migrations/00067_create_entitlements.sql
-- What a tenant is actually allowed to do.
--
-- The plan sets the baseline, the platform team may grant an exception to a
-- single tenant, and the resolver below merges the two. Nothing in the
-- application reads a plan limit directly: every check goes through
-- public.company_entitlements and public.check_usage_limit, so an exception
-- is honoured everywhere at once.

create table public.company_entitlement_overrides (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  -- Dotted key inside the limits or features document, for example
  -- limits.monthly_invoices or features.inventory.
  entitlement_key text not null,
  value jsonb not null,

  reason text not null,
  expires_at timestamptz,
  granted_by uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint entitlement_overrides_key_check
    check (entitlement_key ~ '^(limits|features)\.[a-z][a-z0-9_]{1,40}$'),
  constraint entitlement_overrides_reason_check
    check (length(btrim(reason)) between 3 and 300)
);

comment on table public.company_entitlement_overrides is
  'Per tenant exceptions to the limits and modules of the subscribed plan.';

create unique index entitlement_overrides_unique
  on public.company_entitlement_overrides (company_id, entitlement_key)
  where deleted_at is null;

create index entitlement_overrides_company_idx
  on public.company_entitlement_overrides (company_id)
  where deleted_at is null;

create index entitlement_overrides_expiry_idx
  on public.company_entitlement_overrides (expires_at)
  where expires_at is not null and deleted_at is null;

-- Returns the effective limits and features of a company.
create or replace function public.company_entitlements(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan_limits jsonb := '{}'::jsonb;
  v_plan_features jsonb := '{}'::jsonb;
  v_plan_key text;
  v_status public.subscription_status;
  v_override record;
begin
  select p.plan_key, p.limits, p.features, s.status
    into v_plan_key, v_plan_limits, v_plan_features, v_status
    from public.subscriptions as s
    join public.subscription_plans as p on p.id = s.plan_id
   where s.company_id = p_company_id
     and s.deleted_at is null
     and s.status not in ('cancelled', 'expired')
   order by s.created_at desc
   limit 1;

  -- A company without a live subscription falls back to the free plan, so the
  -- product keeps working and nothing is silently unlimited.
  if v_plan_key is null then
    select plan_key, limits, features
      into v_plan_key, v_plan_limits, v_plan_features
      from public.subscription_plans
     where is_default_on_signup
       and deleted_at is null
     limit 1;
  end if;

  for v_override in
    select entitlement_key, value
      from public.company_entitlement_overrides
     where company_id = p_company_id
       and deleted_at is null
       and (expires_at is null or expires_at > now())
  loop
    if split_part(v_override.entitlement_key, '.', 1) = 'limits' then
      v_plan_limits := coalesce(v_plan_limits, '{}'::jsonb)
        || jsonb_build_object(split_part(v_override.entitlement_key, '.', 2),
                              v_override.value);
    else
      v_plan_features := coalesce(v_plan_features, '{}'::jsonb)
        || jsonb_build_object(split_part(v_override.entitlement_key, '.', 2),
                              v_override.value);
    end if;
  end loop;

  return jsonb_build_object(
    'plan_key', coalesce(v_plan_key, 'free'),
    'subscription_status', coalesce(v_status::text, 'none'),
    'limits', coalesce(v_plan_limits, '{}'::jsonb),
    'features', coalesce(v_plan_features, '{}'::jsonb)
  );
end;
$$;

comment on function public.company_entitlements(uuid) is
  'Returns the limits and modules a company may use, including exceptions.';

-- Reports whether a module is unlocked for a company.
create or replace function public.has_feature(p_company_id uuid, p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
           (public.company_entitlements(p_company_id) -> 'features' ->> p_feature_key)::boolean,
           false
         );
$$;

comment on function public.has_feature(uuid, text) is
  'Returns true when the plan or an exception unlocks the named module.';

-- Returns the ceiling for one limit, or null when the plan sets none.
create or replace function public.usage_limit(p_company_id uuid, p_limit_key text)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select nullif(
           public.company_entitlements(p_company_id) -> 'limits' ->> p_limit_key,
           'null'
         )::bigint;
$$;

comment on function public.usage_limit(uuid, text) is
  'Returns the ceiling of one limit, or nothing when the plan is unlimited.';

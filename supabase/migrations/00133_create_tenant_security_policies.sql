-- supabase/migrations/00133_create_tenant_security_policies.sql
-- The security rules a tenant sets for itself.
--
-- A business that handles money for other people often has to prove that it
-- forces two factor authentication, that sessions expire, and that large
-- actions need a second pair of eyes. All of that is set here and enforced
-- by the platform rather than by habit.

create table public.tenant_security_policies (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  -- Sign in.
  require_two_factor boolean not null default false,
  require_two_factor_for_owner boolean not null default true,
  session_timeout_minutes integer not null default 480,
  max_concurrent_sessions smallint,
  password_min_length smallint not null default 10,
  password_expiry_days smallint,

  -- Where people may sign in from.
  restrict_ip_addresses boolean not null default false,
  allowed_ip_ranges inet[] not null default array[]::inet[],
  block_unknown_countries boolean not null default false,
  allowed_country_codes char(2)[] not null default array[]::char(2)[],

  -- Four eyes. Anything above the cap needs a second person to approve it.
  require_approval_above_amount numeric(18, 4),
  require_approval_for_payouts boolean not null default false,
  require_approval_for_refunds boolean not null default false,
  staff_single_action_cap numeric(18, 4),
  staff_daily_cap numeric(18, 4),

  -- Client facing rules.
  require_email_otp_for_links boolean not null default false,
  document_link_ttl_days smallint not null default 30,

  -- Data handling.
  data_retention_months smallint,
  auto_delete_after_retention boolean not null default false,

  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_security_timeout_check
    check (session_timeout_minutes between 5 and 43200),
  constraint tenant_security_sessions_check
    check (max_concurrent_sessions is null
           or max_concurrent_sessions between 1 and 50),
  constraint tenant_security_password_check
    check (password_min_length between 8 and 64),
  constraint tenant_security_expiry_check
    check (password_expiry_days is null
           or password_expiry_days between 30 and 730),
  constraint tenant_security_amounts_check
    check (coalesce(require_approval_above_amount, 0) >= 0
           and coalesce(staff_single_action_cap, 0) >= 0
           and coalesce(staff_daily_cap, 0) >= 0),
  constraint tenant_security_link_ttl_check
    check (document_link_ttl_days between 1 and 365),
  constraint tenant_security_retention_check
    check (data_retention_months is null
           or data_retention_months between 12 and 240),
  -- Restricting addresses with an empty list would lock everybody out.
  constraint tenant_security_ip_list_check
    check (not restrict_ip_addresses
           or coalesce(array_length(allowed_ip_ranges, 1), 0) >= 1),
  constraint tenant_security_country_list_check
    check (not block_unknown_countries
           or coalesce(array_length(allowed_country_codes, 1), 0) >= 1)
);

comment on table public.tenant_security_policies is
  'The security rules one tenant has chosen to be held to.';

create unique index tenant_security_policies_company_key
  on public.tenant_security_policies (company_id);

-- -----------------------------------------------------------------------------
-- Reading and enforcing the policy
-- -----------------------------------------------------------------------------

-- Every tenant has a policy from its first day, so the checks never have to
-- handle a missing row.
create or replace function public.install_default_security_policy()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.tenant_security_policies (company_id)
  values (new.id)
  on conflict (company_id) do nothing;

  return new;
end;
$$;

comment on function public.install_default_security_policy() is
  'Gives a new tenant the standard security policy.';

create trigger companies_80_security_policy
  after insert on public.companies
  for each row execute function public.install_default_security_policy();

-- Would this sign in be allowed from this address?
create or replace function public.ip_is_allowed(
  p_company_id uuid,
  p_ip inet
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_policy public.tenant_security_policies%rowtype;
  v_range inet;
begin
  select * into v_policy
    from public.tenant_security_policies
   where company_id = p_company_id;

  if not found or not v_policy.restrict_ip_addresses then
    return true;
  end if;

  if p_ip is null then
    return false;
  end if;

  foreach v_range in array v_policy.allowed_ip_ranges loop
    if p_ip << v_range or p_ip = v_range then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

comment on function public.ip_is_allowed(uuid, inet) is
  'Returns true when an address is inside the ranges a tenant allows.';

-- Does this action need a second person to approve it?
create or replace function public.requires_second_approval(
  p_company_id uuid,
  p_action_type text,
  p_amount numeric default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_policy public.tenant_security_policies%rowtype;
begin
  select * into v_policy
    from public.tenant_security_policies
   where company_id = p_company_id;

  if not found then
    return false;
  end if;

  if p_action_type = 'payout' and v_policy.require_approval_for_payouts then
    return true;
  end if;

  if p_action_type = 'refund' and v_policy.require_approval_for_refunds then
    return true;
  end if;

  return v_policy.require_approval_above_amount is not null
     and coalesce(p_amount, 0) >= v_policy.require_approval_above_amount;
end;
$$;

comment on function public.requires_second_approval(uuid, text, numeric) is
  'Returns true when an action is large enough to need a second approver.';

-- Is this staff member allowed to do something of this size on their own?
create or replace function public.staff_action_within_cap(
  p_company_id uuid,
  p_user_id uuid,
  p_amount numeric
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_policy public.tenant_security_policies%rowtype;
  v_role public.user_role;
  v_today numeric;
begin
  select role into v_role from public.users where id = p_user_id;

  if v_role is distinct from 'staff' then
    return true;
  end if;

  select * into v_policy
    from public.tenant_security_policies
   where company_id = p_company_id;

  if not found then
    return true;
  end if;

  if v_policy.staff_single_action_cap is not null
     and coalesce(p_amount, 0) > v_policy.staff_single_action_cap then
    return false;
  end if;

  if v_policy.staff_daily_cap is not null then
    select coalesce(sum(amount), 0) into v_today
      from public.payments
     where company_id = p_company_id
       and created_by = p_user_id
       and created_at >= date_trunc('day', now())
       and deleted_at is null;

    if v_today + coalesce(p_amount, 0) > v_policy.staff_daily_cap then
      return false;
    end if;
  end if;

  return true;
end;
$$;

comment on function public.staff_action_within_cap(uuid, uuid, numeric) is
  'Returns true when a staff action is inside the caps the owner set.';

-- supabase/migrations/00195_create_platform_administration.sql
-- The routines the platform team uses to look after tenants.
--
-- Three things are needed from the admin console and none of them belong in
-- application code: changing the state of a tenant with a reason that is kept,
-- granting one tenant an exception to its plan, and reading the shape of the
-- whole platform in a single answer.

-- Moves a tenant between states.
--
-- Suspension and closure both demand a reason, because the first question
-- asked later is always why. Nothing is deleted here: a closed tenant keeps
-- every record, it simply stops being usable.
create or replace function public.set_company_status(
  p_company_id uuid,
  p_status public.company_status,
  p_reason text default null
)
returns public.company_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_company public.companies%rowtype;
begin
  if not public.is_super_admin() then
    raise exception 'Only the platform team can change the state of a tenant'
      using errcode = '42501';
  end if;

  select * into v_company
    from public.companies
   where id = p_company_id
     and deleted_at is null
     for update;

  if not found then
    raise exception 'Company % was not found', p_company_id using errcode = 'P0002';
  end if;

  if p_status in ('suspended', 'closed')
     and coalesce(length(btrim(p_reason)), 0) < 3 then
    raise exception 'Give a reason before suspending or closing a tenant'
      using errcode = '22023';
  end if;

  if v_company.status = p_status then
    raise exception 'That tenant is already %', p_status using errcode = '22023';
  end if;

  update public.companies
     set status = p_status,
         suspension_reason = case
                               when p_status in ('suspended', 'closed') then p_reason
                               else null
                             end,
         suspended_at = case
                          when p_status = 'suspended' then now()
                          else null
                        end,
         closed_at = case
                       when p_status = 'closed' then now()
                       else null
                     end,
         activated_at = case
                          when p_status = 'active' then coalesce(activated_at, now())
                          else activated_at
                        end,
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_company_id;

  perform public.record_manual_audit_entry(
    case
      when p_status = 'closed' then 'soft_delete'::public.audit_action
      else 'update'::public.audit_action
    end,
    'company',
    p_company_id,
    p_company_id,
    format('Tenant moved from %s to %s', v_company.status, p_status),
    jsonb_build_object('from_status', v_company.status, 'to_status', p_status,
                       'reason', p_reason)
  );

  return p_status;
end;
$$;

comment on function public.set_company_status(uuid, public.company_status, text) is
  'Suspends, reinstates or closes a tenant, keeping the reason on the record.';

-- Grants or revises one exception to the plan of a single tenant.
create or replace function public.grant_entitlement_override(
  p_company_id uuid,
  p_entitlement_key text,
  p_value jsonb,
  p_reason text,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_override_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Only the platform team can grant an exception' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.companies where id = p_company_id and deleted_at is null
  ) then
    raise exception 'Company % was not found', p_company_id using errcode = 'P0002';
  end if;

  update public.company_entitlement_overrides
     set value = p_value,
         reason = p_reason,
         expires_at = p_expires_at,
         granted_by = public.current_user_id(),
         updated_at = now(),
         updated_by = public.current_user_id()
   where company_id = p_company_id
     and entitlement_key = p_entitlement_key
     and deleted_at is null
   returning id into v_override_id;

  if v_override_id is null then
    insert into public.company_entitlement_overrides (
      company_id, entitlement_key, value, reason, expires_at, granted_by, created_by
    )
    values (
      p_company_id, p_entitlement_key, p_value, p_reason, p_expires_at,
      public.current_user_id(), public.current_user_id()
    )
    returning id into v_override_id;
  end if;

  perform public.record_manual_audit_entry(
    'permission_change'::public.audit_action,
    'company_entitlement_override',
    v_override_id,
    p_company_id,
    format('Exception %s granted to the tenant', p_entitlement_key),
    jsonb_build_object('entitlement_key', p_entitlement_key, 'value', p_value,
                       'reason', p_reason)
  );

  return v_override_id;
end;
$$;

comment on function public.grant_entitlement_override(uuid, text, jsonb, text, timestamptz) is
  'Gives one tenant an exception to a plan limit or module, with a reason.';

-- Withdraws an exception again.
create or replace function public.revoke_entitlement_override(
  p_override_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Only the platform team can withdraw an exception' using errcode = '42501';
  end if;

  update public.company_entitlement_overrides
     set deleted_at = now(),
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_override_id
     and deleted_at is null
   returning company_id into v_company_id;

  if v_company_id is null then
    return false;
  end if;

  perform public.record_manual_audit_entry(
    'permission_change'::public.audit_action,
    'company_entitlement_override',
    p_override_id,
    v_company_id,
    'Exception withdrawn from the tenant',
    jsonb_build_object('reason', p_reason)
  );

  return true;
end;
$$;

comment on function public.revoke_entitlement_override(uuid, text) is
  'Withdraws an exception so the tenant falls back to its plan.';

-- Reports the shape of the platform in one answer, so the admin overview is
-- one round trip rather than a dozen counts.
create or replace function public.platform_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Only the platform team can read this' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'tenants', jsonb_build_object(
      'total', (select count(*) from public.companies where deleted_at is null),
      'active', (select count(*) from public.companies
                  where deleted_at is null and status = 'active'),
      'trialing', (select count(*) from public.companies
                    where deleted_at is null and status = 'trialing'),
      'suspended', (select count(*) from public.companies
                     where deleted_at is null and status = 'suspended'),
      'joined_this_month', (select count(*) from public.companies
                             where deleted_at is null
                               and created_at >= date_trunc('month', now()))
    ),
    'accounts', jsonb_build_object(
      'total', (select count(*) from public.users where deleted_at is null),
      'awaiting_kyc', (select count(*) from public.companies
                        where deleted_at is null
                          and kyc_status in ('submitted', 'in_progress'))
    ),
    'subscriptions', jsonb_build_object(
      'paying', (select count(*) from public.subscriptions
                  where deleted_at is null and status = 'active' and amount > 0),
      'past_due', (select count(*) from public.subscriptions
                    where deleted_at is null and status = 'past_due'),
      'monthly_recurring_revenue', coalesce((
        select round(sum(
                 case billing_interval
                   when 'annual' then (amount - discount_amount) / 12
                   when 'lifetime' then 0
                   else amount - discount_amount
                 end), 4)
          from public.subscriptions
         where deleted_at is null and status in ('active', 'past_due')
      ), 0)
    ),
    'money', jsonb_build_object(
      'collected_this_month', coalesce((
        select round(sum(amount), 4) from public.payments
         where deleted_at is null and status = 'succeeded'
           and received_at >= date_trunc('month', now())
      ), 0),
      'platform_fees_this_month', coalesce((
        select round(sum(platform_fee_amount), 4) from public.payments
         where deleted_at is null and status = 'succeeded'
           and received_at >= date_trunc('month', now())
      ), 0),
      'payouts_awaiting_review', (select count(*) from public.payouts
                                   where deleted_at is null
                                     and status in ('requested', 'under_review'))
    ),
    'attention', jsonb_build_object(
      'open_disputes', (select count(*) from public.disputes
                         where deleted_at is null
                           and status in ('open', 'evidence_required', 'under_review')),
      'refunds_awaiting_approval', (select count(*) from public.refunds
                                     where deleted_at is null
                                       and approval_status = 'pending')
    )
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.platform_overview() is
  'Returns the counts and totals the platform overview screen is built from.';

grant execute on function public.set_company_status(uuid, public.company_status, text)
  to authenticated;
grant execute on function public.grant_entitlement_override(uuid, text, jsonb, text, timestamptz)
  to authenticated;
grant execute on function public.revoke_entitlement_override(uuid, text) to authenticated;
grant execute on function public.platform_overview() to authenticated;

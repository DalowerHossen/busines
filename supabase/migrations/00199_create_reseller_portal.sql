-- supabase/migrations/00199_create_reseller_portal.sql
-- Becoming a white label partner, and the limits of what a partner may change
-- about its own deal.
--
-- The provisioning, commission and statement routines already exist. What is
-- missing is the way in: an application a person can make for themselves, a
-- decision only the platform team can take, and a narrowing of the update
-- grant so a partner edits its brand rather than its revenue share.

-- -----------------------------------------------------------------------------
-- Applying
-- -----------------------------------------------------------------------------

create or replace function public.apply_for_reseller(
  p_partner_name text,
  p_slug text,
  p_contact_email text,
  p_country_code text default 'US',
  p_brand_name text default null,
  p_contact_phone text default null,
  p_agreement_version text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_reseller_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in before applying to the partner programme'
      using errcode = '42501';
  end if;

  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' then
    raise exception 'A partner address is three to sixty-four letters, numbers or hyphens'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.resellers
     where user_id = v_user_id and deleted_at is null
  ) then
    raise exception 'This account is already a partner' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.resellers
     where slug = v_slug and deleted_at is null
  ) then
    raise exception 'That partner address is taken' using errcode = '23505';
  end if;

  insert into public.resellers (
    user_id, partner_name, slug, contact_email, contact_phone, country_code,
    brand_name, agreement_version, agreement_accepted_at, status,
    created_by, updated_by
  )
  values (
    v_user_id,
    btrim(p_partner_name),
    v_slug,
    btrim(p_contact_email)::citext,
    p_contact_phone,
    upper(btrim(coalesce(p_country_code, 'US')))::char(2),
    coalesce(nullif(btrim(coalesce(p_brand_name, '')), ''), btrim(p_partner_name)),
    p_agreement_version,
    case when p_agreement_version is null then null else now() end,
    'pending_review'::public.reseller_status,
    v_user_id,
    v_user_id
  )
  returning id into v_reseller_id;

  perform public.record_manual_audit_entry(
    'insert'::public.audit_action,
    'reseller',
    v_reseller_id,
    null,
    'Application to the white label programme received.',
    jsonb_build_object('slug', v_slug)
  );

  return v_reseller_id;
end;
$$;

comment on function public.apply_for_reseller(
  text, text, text, text, text, text, text
) is 'Puts the signed in account forward as a white label partner.';

-- -----------------------------------------------------------------------------
-- The decision
-- -----------------------------------------------------------------------------

create or replace function public.review_reseller_application(
  p_reseller_id uuid,
  p_approve boolean,
  p_note text default null,
  p_revenue_share numeric default null,
  p_max_sub_tenants integer default null
)
returns public.reseller_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_reseller public.resellers%rowtype;
  v_status public.reseller_status;
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception 'Only the platform team can decide a partner application'
      using errcode = '42501';
  end if;

  select * into v_reseller
    from public.resellers
   where id = p_reseller_id
     and deleted_at is null
   for update;

  if not found then
    raise exception 'Partner application % was not found', p_reseller_id
      using errcode = 'P0002';
  end if;

  if v_reseller.status <> 'pending_review' then
    raise exception 'That application is not waiting for a decision'
      using errcode = '22023';
  end if;

  if not p_approve and length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'Say why the application is being refused' using errcode = '22023';
  end if;

  if p_revenue_share is not null and (p_revenue_share < 0 or p_revenue_share > 100) then
    raise exception 'A revenue share is a percentage between zero and one hundred'
      using errcode = '22023';
  end if;

  v_status := case when p_approve then 'approved' else 'terminated' end::public.reseller_status;

  update public.resellers
     set status = v_status,
         approved_at = case when p_approve then now() else null end,
         approved_by = case when p_approve then public.current_user_id() else null end,
         rejection_reason = case when p_approve then null else btrim(p_note) end,
         revenue_share_percentage =
           coalesce(p_revenue_share, revenue_share_percentage),
         max_sub_tenants = coalesce(p_max_sub_tenants, max_sub_tenants),
         notes = coalesce(btrim(p_note), notes),
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_reseller_id;

  perform public.record_manual_audit_entry(
    case when p_approve then 'approve' else 'reject' end::public.audit_action,
    'reseller',
    p_reseller_id,
    null,
    case
      when p_approve then 'White label partner approved.'
      else 'White label application refused.'
    end,
    jsonb_build_object('note', p_note, 'revenue_share', p_revenue_share)
  );

  return v_status;
end;
$$;

comment on function public.review_reseller_application(
  uuid, boolean, text, numeric, integer
) is 'Approves or refuses a white label application and sets its terms.';

-- Suspends, terminates or restores a partner already in the programme.
create or replace function public.set_reseller_state(
  p_reseller_id uuid,
  p_status public.reseller_status,
  p_reason text default null
)
returns public.reseller_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception 'Only the platform team can change a partner'
      using errcode = '42501';
  end if;

  if p_status = 'pending_review' then
    raise exception 'A decided partner cannot be sent back to review'
      using errcode = '22023';
  end if;

  if p_status <> 'approved' and length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Say why this partner is being stopped' using errcode = '22023';
  end if;

  update public.resellers
     set status = p_status,
         suspended_at = case when p_status = 'approved' then null else now() end,
         approved_at = case
           when p_status = 'approved' then coalesce(approved_at, now())
           else approved_at
         end,
         notes = coalesce(btrim(p_reason), notes),
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_reseller_id
     and deleted_at is null;

  if not found then
    raise exception 'Partner % was not found', p_reseller_id using errcode = 'P0002';
  end if;

  perform public.record_manual_audit_entry(
    'settings_change'::public.audit_action,
    'reseller',
    p_reseller_id,
    null,
    'White label partner state changed.',
    jsonb_build_object('status', p_status, 'reason', p_reason)
  );

  return p_status;
end;
$$;

comment on function public.set_reseller_state(
  uuid, public.reseller_status, text
) is 'Suspends, terminates or restores a white label partner.';

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

-- A partner owns how it looks and how to reach it. The revenue share, the
-- account ceiling and the state of the agreement belong to the platform.
revoke update on public.resellers from authenticated;

grant update (
  partner_name,
  contact_email,
  contact_phone,
  brand_name,
  brand_logo_url,
  brand_primary_color,
  brand_accent_color,
  custom_domain,
  hide_platform_branding,
  agreement_version,
  agreement_accepted_at,
  updated_at,
  updated_by
) on public.resellers to authenticated;

grant execute on function public.apply_for_reseller(
  text, text, text, text, text, text, text
) to authenticated;

-- Both routines below check for the platform team themselves.
grant execute on function public.review_reseller_application(
  uuid, boolean, text, numeric, integer
) to authenticated;

grant execute on function public.set_reseller_state(
  uuid, public.reseller_status, text
) to authenticated;

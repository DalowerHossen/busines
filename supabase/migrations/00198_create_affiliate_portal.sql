-- supabase/migrations/00198_create_affiliate_portal.sql
-- What a referral partner can do for itself, and what only the platform team
-- may do to a partner.
--
-- The programme is deliberately blind: a partner applies, reads its own
-- figures and asks for its money, and at no point can it reach a tenant, a
-- client or an invoice. Two things are tightened here that the original
-- programme file left open. A partner could update every column of its own
-- record, including the commission rate, so the update grant is narrowed to
-- the handful of columns a partner genuinely owns. And a partner had no way
-- to turn an approved balance into a payout without reaching the wallet
-- directly, so a routine is given that checks ownership first.

-- -----------------------------------------------------------------------------
-- A gap in the original programme tables
-- -----------------------------------------------------------------------------

-- The standard trigger set records who wrote each row, and it was installed on
-- the referral links without the two columns it writes into, so every insert
-- failed. The columns are added here rather than editing the original file.
alter table public.affiliate_links
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

comment on column public.affiliate_links.created_by is
  'Account that created the referral link.';

-- -----------------------------------------------------------------------------
-- Joining the programme
-- -----------------------------------------------------------------------------

create or replace function public.apply_for_affiliate(
  p_referral_code text,
  p_display_name text,
  p_contact_email text,
  p_promotion_method text default null,
  p_website text default null,
  p_country_code text default null,
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
  v_code text := lower(btrim(coalesce(p_referral_code, '')));
  v_affiliate_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in before applying to the referral programme'
      using errcode = '42501';
  end if;

  if v_code !~ '^[a-z0-9][a-z0-9-]{2,29}$' then
    raise exception 'A referral code is three to thirty letters, numbers or hyphens'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.affiliates
     where user_id = v_user_id and deleted_at is null
  ) then
    raise exception 'This account is already in the referral programme'
      using errcode = '23505';
  end if;

  if exists (
    select 1 from public.affiliates
     where referral_code = v_code and deleted_at is null
  ) then
    raise exception 'That referral code is taken' using errcode = '23505';
  end if;

  insert into public.affiliates (
    user_id, referral_code, display_name, contact_email, promotion_method,
    website, country_code, agreement_version, agreement_accepted_at,
    status, created_by, updated_by
  )
  values (
    v_user_id,
    v_code,
    btrim(p_display_name),
    btrim(p_contact_email)::citext,
    p_promotion_method,
    p_website,
    nullif(upper(btrim(coalesce(p_country_code, ''))), '')::char(2),
    p_agreement_version,
    case when p_agreement_version is null then null else now() end,
    'pending_review'::public.affiliate_status,
    v_user_id,
    v_user_id
  )
  returning id into v_affiliate_id;

  -- The first link is created straight away so an approved partner has
  -- something to share without a second form.
  insert into public.affiliate_links (affiliate_id, slug, label, destination_path)
  values (v_affiliate_id, v_code, 'Default link', '/');

  perform public.record_manual_audit_entry(
    'insert'::public.audit_action,
    'affiliate',
    v_affiliate_id,
    null,
    'Application to the referral programme received.',
    jsonb_build_object('referral_code', v_code)
  );

  return v_affiliate_id;
end;
$$;

comment on function public.apply_for_affiliate(
  text, text, text, text, text, text, text
) is 'Puts the signed in account forward as a referral partner, awaiting review.';

-- -----------------------------------------------------------------------------
-- The decision on an application
-- -----------------------------------------------------------------------------

create or replace function public.review_affiliate_application(
  p_affiliate_id uuid,
  p_approve boolean,
  p_note text default null
)
returns public.affiliate_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_affiliate public.affiliates%rowtype;
  v_status public.affiliate_status;
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception 'Only the platform team can decide a referral application'
      using errcode = '42501';
  end if;

  select * into v_affiliate
    from public.affiliates
   where id = p_affiliate_id
     and deleted_at is null
   for update;

  if not found then
    raise exception 'Referral application % was not found', p_affiliate_id
      using errcode = 'P0002';
  end if;

  if v_affiliate.status <> 'pending_review' then
    raise exception 'That application is not waiting for a decision'
      using errcode = '22023';
  end if;

  if not p_approve and length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'Say why the application is being refused'
      using errcode = '22023';
  end if;

  v_status := case when p_approve then 'approved' else 'terminated' end::public.affiliate_status;

  update public.affiliates
     set status = v_status,
         approved_at = case when p_approve then now() else null end,
         approved_by = case when p_approve then public.current_user_id() else null end,
         rejection_reason = case when p_approve then null else btrim(p_note) end,
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_affiliate_id;

  perform public.record_manual_audit_entry(
    case when p_approve then 'approve' else 'reject' end::public.audit_action,
    'affiliate',
    p_affiliate_id,
    null,
    case
      when p_approve then 'Referral partner approved.'
      else 'Referral application refused.'
    end,
    jsonb_build_object('note', p_note)
  );

  return v_status;
end;
$$;

comment on function public.review_affiliate_application(uuid, boolean, text) is
  'Approves or refuses a referral application and records who decided it.';

-- Suspends or restores a partner that is already in the programme.
create or replace function public.set_affiliate_state(
  p_affiliate_id uuid,
  p_status public.affiliate_status,
  p_reason text default null
)
returns public.affiliate_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception 'Only the platform team can change a referral partner'
      using errcode = '42501';
  end if;

  if p_status = 'pending_review' then
    raise exception 'A decided partner cannot be sent back to review'
      using errcode = '22023';
  end if;

  if p_status <> 'approved' and length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Say why this partner is being stopped' using errcode = '22023';
  end if;

  update public.affiliates
     set status = p_status,
         suspended_at = case when p_status = 'approved' then null else now() end,
         suspension_reason = case when p_status = 'approved' then null else btrim(p_reason) end,
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_affiliate_id
     and deleted_at is null;

  if not found then
    raise exception 'Referral partner % was not found', p_affiliate_id
      using errcode = 'P0002';
  end if;

  perform public.record_manual_audit_entry(
    'settings_change'::public.audit_action,
    'affiliate',
    p_affiliate_id,
    null,
    'Referral partner state changed.',
    jsonb_build_object('status', p_status, 'reason', p_reason)
  );

  return p_status;
end;
$$;

comment on function public.set_affiliate_state(
  uuid, public.affiliate_status, text
) is 'Suspends, terminates or restores a referral partner.';

-- -----------------------------------------------------------------------------
-- What a partner sees
-- -----------------------------------------------------------------------------

create or replace function public.affiliate_summary(p_affiliate_id uuid)
returns table (
  clicks_last_30_days integer,
  clicks_total integer,
  signups_total integer,
  pending_amount numeric,
  approved_amount numeric,
  reversed_amount numeric,
  wallet_available numeric,
  wallet_pending numeric,
  payout_currency char(3),
  minimum_payout_amount numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_affiliate public.affiliates%rowtype;
begin
  if not coalesce(public.is_own_affiliate(p_affiliate_id), false) then
    raise exception 'That referral record belongs to somebody else'
      using errcode = '42501';
  end if;

  select * into v_affiliate
    from public.affiliates
   where id = p_affiliate_id
     and deleted_at is null;

  if not found then
    raise exception 'Referral partner % was not found', p_affiliate_id
      using errcode = 'P0002';
  end if;

  return query
  select
    (
      select (count(*))::int
        from public.affiliate_clicks as c
       where c.affiliate_id = p_affiliate_id
         and c.created_at > now() - interval '30 days'
    ),
    v_affiliate.total_clicks,
    v_affiliate.total_signups,
    coalesce((
      select sum(k.amount)
        from public.affiliate_commissions as k
       where k.affiliate_id = p_affiliate_id
         and k.status = 'pending'
         and k.reversed_at is null
    ), 0),
    coalesce((
      select sum(k.amount)
        from public.affiliate_commissions as k
       where k.affiliate_id = p_affiliate_id
         and k.status = 'approved'
         and k.reversed_at is null
    ), 0),
    coalesce((
      select sum(k.amount)
        from public.affiliate_commissions as k
       where k.affiliate_id = p_affiliate_id
         and k.reversed_at is not null
    ), 0),
    coalesce((
      select w.available_balance
        from public.wallets as w
       where w.user_id = v_affiliate.user_id
         and w.currency = v_affiliate.payout_currency
         and w.deleted_at is null
       limit 1
    ), 0),
    coalesce((
      select w.pending_balance
        from public.wallets as w
       where w.user_id = v_affiliate.user_id
         and w.currency = v_affiliate.payout_currency
         and w.deleted_at is null
       limit 1
    ), 0),
    v_affiliate.payout_currency,
    v_affiliate.minimum_payout_amount;
end;
$$;

comment on function public.affiliate_summary(uuid) is
  'The figures a referral partner is allowed to see about its own account.';

-- -----------------------------------------------------------------------------
-- Taking the money out
-- -----------------------------------------------------------------------------

create or replace function public.request_affiliate_payout(
  p_affiliate_id uuid,
  p_amount numeric,
  p_payout_account_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_affiliate public.affiliates%rowtype;
  v_wallet_id uuid;
  v_payout_id uuid;
begin
  if not coalesce(public.is_own_affiliate(p_affiliate_id), false) then
    raise exception 'That referral record belongs to somebody else'
      using errcode = '42501';
  end if;

  select * into v_affiliate
    from public.affiliates
   where id = p_affiliate_id
     and deleted_at is null;

  if not found then
    raise exception 'Referral partner % was not found', p_affiliate_id
      using errcode = 'P0002';
  end if;

  if v_affiliate.status <> 'approved' then
    raise exception 'Only an approved partner can be paid' using errcode = '42501';
  end if;

  if p_amount < v_affiliate.minimum_payout_amount then
    raise exception 'The minimum payout for this partner is %',
      v_affiliate.minimum_payout_amount using errcode = '22023';
  end if;

  select w.id into v_wallet_id
    from public.wallets as w
   where w.user_id = v_affiliate.user_id
     and w.currency = v_affiliate.payout_currency
     and w.deleted_at is null
   limit 1;

  if v_wallet_id is null then
    raise exception 'There is nothing to pay out yet' using errcode = '22023';
  end if;

  v_payout_id := public.request_payout(v_wallet_id, p_amount, p_payout_account_id);

  perform public.record_manual_audit_entry(
    'insert'::public.audit_action,
    'payout',
    v_payout_id,
    null,
    'Referral partner asked to be paid.',
    jsonb_build_object('affiliate_id', p_affiliate_id, 'amount', p_amount)
  );

  return v_payout_id;
end;
$$;

comment on function public.request_affiliate_payout(uuid, numeric, uuid) is
  'Turns an approved referral balance into a payout request on the own wallet.';

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

-- A partner owns its contact details and nothing else. The commercial terms,
-- the running totals and the state of the account stay with the platform.
revoke update on public.affiliates from authenticated;

grant update (
  display_name,
  contact_email,
  website,
  promotion_method,
  country_code,
  agreement_version,
  agreement_accepted_at,
  updated_at,
  updated_by
) on public.affiliates to authenticated;

grant execute on function public.apply_for_affiliate(
  text, text, text, text, text, text, text
) to authenticated;

grant execute on function public.affiliate_summary(uuid) to authenticated;

grant execute on function public.request_affiliate_payout(uuid, numeric, uuid)
  to authenticated;

-- Both review routines carry their own platform check, so they are reachable
-- by a signed in caller and refuse anybody who is not on the platform team.
grant execute on function public.review_affiliate_application(uuid, boolean, text)
  to authenticated;

grant execute on function public.set_affiliate_state(
  uuid, public.affiliate_status, text
) to authenticated;

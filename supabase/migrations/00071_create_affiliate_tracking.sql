-- supabase/migrations/00071_create_affiliate_tracking.sql
-- Referral links, click capture and signup attribution.
--
-- Attribution uses last click inside the affiliate's cookie window. The
-- visitor token is a random identifier set by the browser, never an address,
-- so the programme can measure traffic without profiling the visitor.

create table public.affiliate_links (
  id uuid primary key default public.generate_uuid_v7(),
  affiliate_id uuid not null,

  slug text not null,
  label text not null,
  destination_path text not null default '/',
  campaign text,

  click_count integer not null default 0,
  signup_count integer not null default 0,

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint affiliate_links_slug_check
    check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  constraint affiliate_links_label_check
    check (length(btrim(label)) between 2 and 80),
  constraint affiliate_links_destination_check
    check (destination_path ~ '^/[A-Za-z0-9/_-]*$')
);

comment on table public.affiliate_links is
  'Named referral links so an affiliate can tell their campaigns apart.';

create unique index affiliate_links_slug_unique
  on public.affiliate_links (slug)
  where deleted_at is null;

create index affiliate_links_affiliate_idx
  on public.affiliate_links (affiliate_id)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Click capture
-- -----------------------------------------------------------------------------

create or replace function public.record_affiliate_click(
  p_referral_code text,
  p_visitor_token text,
  p_landing_path text default '/',
  p_referrer_url text default null,
  p_ip_hash text default null,
  p_user_agent text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_affiliate public.affiliates%rowtype;
  v_click_id uuid;
begin
  select * into v_affiliate
    from public.affiliates
   where referral_code = lower(btrim(p_referral_code))
     and status = 'approved'
     and deleted_at is null;

  if not found then
    return null;
  end if;

  -- One click per visitor per hour keeps refreshes out of the figures.
  if exists (
    select 1
      from public.affiliate_clicks
     where affiliate_id = v_affiliate.id
       and visitor_token = p_visitor_token
       and created_at > now() - interval '1 hour'
  ) then
    return null;
  end if;

  insert into public.affiliate_clicks (
    affiliate_id, landing_path, referrer_url, utm_source, utm_medium,
    utm_campaign, ip_hash, user_agent, visitor_token
  )
  values (
    v_affiliate.id, p_landing_path, p_referrer_url, p_utm_source, p_utm_medium,
    p_utm_campaign, p_ip_hash, p_user_agent, p_visitor_token
  )
  returning id into v_click_id;

  update public.affiliates
     set total_clicks = total_clicks + 1,
         updated_at = now()
   where id = v_affiliate.id;

  update public.affiliate_links
     set click_count = click_count + 1,
         updated_at = now()
   where affiliate_id = v_affiliate.id
     and campaign is not distinct from p_utm_campaign
     and deleted_at is null;

  return v_click_id;
end;
$$;

comment on function public.record_affiliate_click(
  text, text, text, text, text, text, text, text, text
) is 'Logs a referral visit, ignoring repeat loads from the same visitor.';

-- -----------------------------------------------------------------------------
-- Signup attribution
-- -----------------------------------------------------------------------------

create or replace function public.attribute_affiliate_signup(
  p_company_id uuid,
  p_visitor_token text,
  p_signup_ip_hash text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_click public.affiliate_clicks%rowtype;
  v_affiliate public.affiliates%rowtype;
  v_referral_id uuid;
  v_flag_reason text;
begin
  if exists (select 1 from public.affiliate_referrals where company_id = p_company_id) then
    return null;
  end if;

  select c.* into v_click
    from public.affiliate_clicks as c
    join public.affiliates as a on a.id = c.affiliate_id
   where c.visitor_token = p_visitor_token
     and c.converted_at is null
     and a.status = 'approved'
     and a.deleted_at is null
     and c.created_at > now() - make_interval(days => a.cookie_window_days)
   order by c.created_at desc
   limit 1;

  if not found then
    return null;
  end if;

  select * into v_affiliate from public.affiliates where id = v_click.affiliate_id;

  -- Self referral and address reuse are the two cheapest forms of abuse, so
  -- both are flagged for review rather than silently accepted.
  if p_signup_ip_hash is not null and v_click.ip_hash = p_signup_ip_hash then
    v_flag_reason := 'The signup came from the same address as the referral click';
  elsif exists (
    select 1
      from public.users as u
     where u.company_id = p_company_id
       and u.id = v_affiliate.user_id
  ) then
    v_flag_reason := 'The affiliate is a member of the referred account';
  end if;

  insert into public.affiliate_referrals (
    affiliate_id, company_id, click_id, signup_ip_hash, is_flagged, flag_reason,
    commission_ends_on
  )
  values (
    v_affiliate.id, p_company_id, v_click.id, p_signup_ip_hash,
    v_flag_reason is not null, v_flag_reason,
    case
      when v_affiliate.commission_duration_months is null then null
      else (current_date + make_interval(months => v_affiliate.commission_duration_months))::date
    end
  )
  returning id into v_referral_id;

  update public.affiliate_clicks
     set converted_at = now()
   where id = v_click.id;

  update public.affiliates
     set total_signups = total_signups + 1,
         updated_at = now()
   where id = v_affiliate.id;

  return v_referral_id;
end;
$$;

comment on function public.attribute_affiliate_signup(uuid, text, text) is
  'Links a new tenant to the last referral click inside the cookie window.';

-- Stops a referral earning when the tenant leaves or abuse is confirmed.
create or replace function public.deactivate_affiliate_referral(
  p_referral_id uuid,
  p_reason text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only a platform administrator can end a referral'
      using errcode = '42501';
  end if;

  update public.affiliate_referrals
     set is_active = false,
         deactivated_at = now(),
         deactivation_reason = p_reason,
         updated_at = now()
   where id = p_referral_id
     and is_active;

  return found;
end;
$$;

comment on function public.deactivate_affiliate_referral(uuid, text) is
  'Ends the earning relationship between an affiliate and a referred tenant.';

-- Reverses a commission when the underlying payment is refunded or disputed.
create or replace function public.reverse_affiliate_commission(
  p_commission_id uuid,
  p_reason text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_commission public.affiliate_commissions%rowtype;
begin
  select * into v_commission
    from public.affiliate_commissions
   where id = p_commission_id
     and reversed_at is null
     for update;

  if not found then
    return false;
  end if;

  update public.affiliate_commissions
     set status = 'cancelled',
         reversed_at = now(),
         reversal_reason = p_reason,
         updated_at = now()
   where id = p_commission_id;

  update public.affiliates
     set total_commission_earned = greatest(total_commission_earned - v_commission.amount, 0),
         updated_at = now()
   where id = v_commission.affiliate_id;

  -- Money that already reached the wallet is taken back out of it.
  if v_commission.wallet_transaction_id is not null then
    perform public.post_wallet_transaction(
      w.id, 'adjustment', -v_commission.amount,
      'Referral commission reversed', false,
      jsonb_build_object('commission_id', p_commission_id)
    )
      from public.wallets as w
      join public.affiliates as a on a.user_id = w.user_id
     where a.id = v_commission.affiliate_id
       and w.currency = v_commission.currency
       and w.deleted_at is null;
  end if;

  return true;
end;
$$;

comment on function public.reverse_affiliate_commission(uuid, text) is
  'Cancels a commission and claws back any amount already paid to the wallet.';

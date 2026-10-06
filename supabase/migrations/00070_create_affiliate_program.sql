-- supabase/migrations/00070_create_affiliate_program.sql
-- The referral programme.
--
-- An affiliate is deliberately blind: the tables here hold clicks, signups,
-- commissions and payouts, and nothing else. No affiliate can reach a client,
-- an invoice or a tenant record, which the row level security file enforces by
-- scoping every policy to the affiliate's own identifier.

create table public.affiliates (
  id uuid primary key default public.generate_uuid_v7(),
  user_id uuid not null,

  referral_code text not null,
  display_name text not null,
  status public.affiliate_status not null default 'pending_review',

  contact_email citext not null,
  website text,
  promotion_method text,
  country_code char(2),

  -- Commercial terms.
  commission_percentage numeric(5, 2) not null default 20.00,
  commission_duration_months smallint,
  cookie_window_days smallint not null default 60,
  minimum_payout_amount numeric(18, 4) not null default 50,
  payout_currency char(3) not null default 'USD',

  -- Running totals, maintained by the commission routines.
  total_clicks integer not null default 0,
  total_signups integer not null default 0,
  total_conversions integer not null default 0,
  total_commission_earned numeric(18, 4) not null default 0,
  total_commission_paid numeric(18, 4) not null default 0,

  agreement_version text,
  agreement_accepted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  rejection_reason text,
  suspended_at timestamptz,
  suspension_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint affiliates_code_check
    check (referral_code ~ '^[a-z0-9][a-z0-9-]{2,29}$'),
  constraint affiliates_display_name_check
    check (length(btrim(display_name)) between 2 and 80),
  constraint affiliates_email_check
    check (public.is_valid_email(contact_email::text)),
  constraint affiliates_commission_check
    check (commission_percentage between 0 and 100),
  constraint affiliates_duration_check
    check (commission_duration_months is null
           or commission_duration_months between 1 and 120),
  constraint affiliates_cookie_window_check
    check (cookie_window_days between 1 and 365),
  constraint affiliates_currency_check
    check (payout_currency ~ '^[A-Z]{3}$'),
  constraint affiliates_country_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$')
);

comment on table public.affiliates is
  'Partners who refer new tenants and earn a share of what those tenants pay.';

create unique index affiliates_user_unique
  on public.affiliates (user_id)
  where deleted_at is null;

create unique index affiliates_code_unique
  on public.affiliates (referral_code)
  where deleted_at is null;

create index affiliates_status_idx
  on public.affiliates (status)
  where deleted_at is null;

-- Row level security helper: true when the caller is the partner in question.
create or replace function public.is_own_affiliate(p_affiliate_id uuid)
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
  if v_user_id is null or p_affiliate_id is null then
    return false;
  end if;

  if public.is_super_admin() then
    return true;
  end if;

  execute 'select exists (
             select 1
               from public.affiliates
              where id = $1
                and user_id = $2
                and deleted_at is null
           )'
    into v_exists
    using p_affiliate_id, v_user_id;

  return coalesce(v_exists, false);
end;
$$;

comment on function public.is_own_affiliate(uuid) is
  'Returns true when the caller owns the supplied referral programme record.';

-- -----------------------------------------------------------------------------
-- Clicks and referrals
-- -----------------------------------------------------------------------------

create table public.affiliate_clicks (
  id uuid primary key default public.generate_uuid_v7(),
  affiliate_id uuid not null,

  landing_path text,
  referrer_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,

  -- Stored as a hash so the programme never holds a plain visitor address.
  ip_hash text,
  user_agent text,
  country_code char(2),
  device_type text,

  visitor_token text not null,
  converted_at timestamptz,
  created_at timestamptz not null default now(),

  constraint affiliate_clicks_ip_hash_check
    check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  constraint affiliate_clicks_visitor_check
    check (length(btrim(visitor_token)) between 8 and 120)
);

comment on table public.affiliate_clicks is
  'Visits that arrived through a referral link, with no personal data stored.';

create index affiliate_clicks_affiliate_idx
  on public.affiliate_clicks (affiliate_id, created_at desc);

create index affiliate_clicks_visitor_idx
  on public.affiliate_clicks (visitor_token, created_at desc);

create table public.affiliate_referrals (
  id uuid primary key default public.generate_uuid_v7(),
  affiliate_id uuid not null,
  company_id uuid not null,
  click_id uuid,

  signed_up_at timestamptz not null default now(),
  first_paid_at timestamptz,
  commission_ends_on date,

  -- A referral stops earning when the tenant leaves or the window closes.
  is_active boolean not null default true,
  deactivated_at timestamptz,
  deactivation_reason text,

  -- Signals kept for the fraud review, never shown to the affiliate.
  signup_ip_hash text,
  is_flagged boolean not null default false,
  flag_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint affiliate_referrals_ip_hash_check
    check (signup_ip_hash is null or signup_ip_hash ~ '^[0-9a-f]{64}$')
);

comment on table public.affiliate_referrals is
  'Tenants that signed up through an affiliate, and how long they still earn.';

create unique index affiliate_referrals_company_unique
  on public.affiliate_referrals (company_id);

create index affiliate_referrals_affiliate_idx
  on public.affiliate_referrals (affiliate_id, signed_up_at desc);

create index affiliate_referrals_flagged_idx
  on public.affiliate_referrals (affiliate_id)
  where is_flagged;

-- -----------------------------------------------------------------------------
-- Commissions
-- -----------------------------------------------------------------------------

create table public.affiliate_commissions (
  id uuid primary key default public.generate_uuid_v7(),
  affiliate_id uuid not null,
  referral_id uuid not null,
  company_id uuid not null,
  subscription_invoice_id uuid,

  amount numeric(18, 4) not null,
  currency char(3) not null default 'USD',
  commission_percentage numeric(5, 2) not null,
  base_amount numeric(18, 4) not null,

  period_start date,
  period_end date,
  -- Held until the refund window of the underlying payment has passed.
  status public.approval_status not null default 'pending',
  available_on date,
  approved_at timestamptz,
  reversed_at timestamptz,
  reversal_reason text,
  wallet_transaction_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint affiliate_commissions_amount_check
    check (amount >= 0 and base_amount >= 0),
  constraint affiliate_commissions_percentage_check
    check (commission_percentage between 0 and 100),
  constraint affiliate_commissions_currency_check
    check (currency ~ '^[A-Z]{3}$')
);

comment on table public.affiliate_commissions is
  'Amounts earned by an affiliate, held until the refund window has passed.';

create index affiliate_commissions_affiliate_idx
  on public.affiliate_commissions (affiliate_id, created_at desc);

create index affiliate_commissions_referral_idx
  on public.affiliate_commissions (referral_id);

create index affiliate_commissions_due_idx
  on public.affiliate_commissions (available_on)
  where status = 'pending';

-- Records the commission due on a platform invoice that has been paid.
create or replace function public.record_affiliate_commission(
  p_subscription_invoice_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.subscription_invoices%rowtype;
  v_referral public.affiliate_referrals%rowtype;
  v_affiliate public.affiliates%rowtype;
  v_amount numeric;
  v_commission_id uuid;
begin
  select * into v_invoice
    from public.subscription_invoices
   where id = p_subscription_invoice_id
     and deleted_at is null;

  if not found or v_invoice.paid_amount <= 0 then
    return null;
  end if;

  select * into v_referral
    from public.affiliate_referrals
   where company_id = v_invoice.company_id
     and is_active;

  if not found then
    return null;
  end if;

  if v_referral.commission_ends_on is not null
     and v_referral.commission_ends_on < current_date then
    return null;
  end if;

  select * into v_affiliate
    from public.affiliates
   where id = v_referral.affiliate_id
     and status = 'approved'
     and deleted_at is null;

  if not found then
    return null;
  end if;

  if exists (
    select 1
      from public.affiliate_commissions
     where subscription_invoice_id = p_subscription_invoice_id
       and reversed_at is null
  ) then
    return null;
  end if;

  v_amount := round(v_invoice.paid_amount * v_affiliate.commission_percentage / 100, 4);

  insert into public.affiliate_commissions (
    affiliate_id, referral_id, company_id, subscription_invoice_id, amount,
    currency, commission_percentage, base_amount, period_start, period_end,
    available_on
  )
  values (
    v_affiliate.id, v_referral.id, v_invoice.company_id, p_subscription_invoice_id,
    v_amount, v_invoice.currency, v_affiliate.commission_percentage,
    v_invoice.paid_amount, v_invoice.period_start, v_invoice.period_end,
    current_date + 30
  )
  returning id into v_commission_id;

  update public.affiliates
     set total_commission_earned = total_commission_earned + v_amount,
         total_conversions = total_conversions + 1,
         updated_at = now()
   where id = v_affiliate.id;

  update public.affiliate_referrals
     set first_paid_at = coalesce(first_paid_at, now()),
         updated_at = now()
   where id = v_referral.id;

  return v_commission_id;
end;
$$;

comment on function public.record_affiliate_commission(uuid) is
  'Creates the commission an affiliate earned on a paid platform invoice.';

-- Approves matured commissions and credits the affiliate wallet.
create or replace function public.release_due_commissions()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_wallet_id uuid;
  v_count integer := 0;
begin
  for v_row in
    select c.*, a.user_id, a.payout_currency
      from public.affiliate_commissions as c
      join public.affiliates as a on a.id = c.affiliate_id
     where c.status = 'pending'
       and c.reversed_at is null
       and c.available_on is not null
       and c.available_on <= current_date
  loop
    select id into v_wallet_id
      from public.wallets
     where user_id = v_row.user_id
       and currency = v_row.currency
       and deleted_at is null;

    if v_wallet_id is null then
      insert into public.wallets (user_id, currency)
      values (v_row.user_id, v_row.currency)
      returning id into v_wallet_id;
    end if;

    update public.affiliate_commissions
       set status = 'approved',
           approved_at = now(),
           wallet_transaction_id = public.post_wallet_transaction(
             v_wallet_id, 'commission', v_row.amount,
             'Referral commission released', false,
             jsonb_build_object('commission_id', v_row.id)
           ),
           updated_at = now()
     where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.release_due_commissions() is
  'Credits matured referral commissions to the wallet of each affiliate.';

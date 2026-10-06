-- supabase/migrations/00164_create_reseller_functions.sql
-- Provisioning accounts, earning commission and being paid for it.

-- Is this caller the partner behind this reseller record?
create or replace function public.is_reseller_owner(p_reseller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.resellers as r
     where r.id = p_reseller_id
       and r.user_id = public.current_user_id()
       and r.deleted_at is null
  );
$$;

comment on function public.is_reseller_owner(uuid) is
  'Returns whether the caller is the partner behind this reseller account.';

-- The reseller the caller runs, if any.
create or replace function public.current_reseller_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.id
    from public.resellers as r
   where r.user_id = public.current_user_id()
     and r.deleted_at is null
   limit 1;
$$;

comment on function public.current_reseller_id() is
  'Returns the reseller account of the caller, or nothing.';

-- Creates an account under a partner. The partner becomes responsible for
-- billing it and never gains access to what the account holds.
create or replace function public.provision_sub_tenant(
  p_reseller_id uuid,
  p_legal_name text,
  p_display_name text,
  p_slug text,
  p_account_reference text default null,
  p_price_book_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_reseller public.resellers%rowtype;
  v_company_id uuid;
begin
  select * into v_reseller
    from public.resellers
   where id = p_reseller_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That partner account does not exist' using errcode = 'P0002';
  end if;

  if not coalesce(
      public.is_service_role()
      or public.is_super_admin()
      or public.is_reseller_owner(p_reseller_id),
      false
    ) then
    raise exception 'Only the partner can create an account under their brand'
      using errcode = '42501';
  end if;

  if v_reseller.status <> 'approved' then
    raise exception 'A partner account has to be approved before it sells anything'
      using errcode = '22023';
  end if;

  if v_reseller.max_sub_tenants is not null
     and v_reseller.sub_tenant_count >= v_reseller.max_sub_tenants then
    raise exception 'That partner has reached the number of accounts they may hold'
      using errcode = '22023';
  end if;

  insert into public.companies (
    reseller_id, slug, legal_name, display_name, status
  )
  values (
    p_reseller_id, p_slug, p_legal_name, coalesce(p_display_name, p_legal_name),
    'active'
  )
  returning id into v_company_id;

  insert into public.reseller_tenant_links (
    reseller_id, company_id, account_reference, price_book_id
  )
  values (p_reseller_id, v_company_id, p_account_reference, p_price_book_id);

  return v_company_id;
end;
$$;

comment on function public.provision_sub_tenant(
  uuid, text, text, text, text, uuid
) is 'Creates an account under a white label partner and links it to them.';

-- Suspends an account a partner manages, without touching its data.
create or replace function public.set_sub_tenant_status(
  p_company_id uuid,
  p_status text,
  p_reason text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_link public.reseller_tenant_links%rowtype;
begin
  if p_status not in ('active', 'suspended', 'released') then
    raise exception 'That is not a state an account can be put in'
      using errcode = '22023';
  end if;

  select * into v_link
    from public.reseller_tenant_links
   where company_id = p_company_id
     for update;

  if not found then
    raise exception 'That account is not managed by a partner'
      using errcode = 'P0002';
  end if;

  if not coalesce(
      public.is_service_role()
      or public.is_super_admin()
      or public.is_reseller_owner(v_link.reseller_id),
      false
    ) then
    raise exception 'Only the partner who holds this account can change it'
      using errcode = '42501';
  end if;

  update public.reseller_tenant_links
     set status = p_status,
         suspended_at = case when p_status = 'suspended' then now() else null end,
         suspension_reason = case when p_status = 'suspended' then p_reason else null end,
         released_at = case when p_status = 'released' then now() else released_at end,
         updated_at = now()
   where company_id = p_company_id;

  update public.companies
     set status = case
           when p_status = 'suspended' then 'suspended'::public.company_status
           when p_status = 'active' then 'active'::public.company_status
           else status
         end,
         updated_at = now()
   where id = p_company_id;

  return true;
end;
$$;

comment on function public.set_sub_tenant_status(uuid, text, text) is
  'Suspends or restores an account a partner manages, leaving its data alone.';

-- Records what a partner earned on one billing period of one account.
create or replace function public.accrue_reseller_commission(
  p_company_id uuid,
  p_period_start date,
  p_period_end date,
  p_retail_amount numeric,
  p_wholesale_amount numeric,
  p_currency char(3) default 'USD',
  p_subscription_invoice_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_link public.reseller_tenant_links%rowtype;
  v_commission_id uuid;
  v_commission numeric;
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Commission is worked out by the platform, not by hand'
      using errcode = '42501';
  end if;

  select * into v_link
    from public.reseller_tenant_links
   where company_id = p_company_id;

  if not found then
    return null;
  end if;

  if coalesce(p_retail_amount, 0) < coalesce(p_wholesale_amount, 0) then
    raise exception 'An account cannot be sold below the price it costs'
      using errcode = '22023';
  end if;

  v_commission := coalesce(p_retail_amount, 0) - coalesce(p_wholesale_amount, 0);

  insert into public.reseller_commissions (
    reseller_id, company_id, subscription_invoice_id, period_start, period_end,
    retail_amount, wholesale_amount, commission_amount, currency
  )
  values (
    v_link.reseller_id, p_company_id, p_subscription_invoice_id, p_period_start,
    p_period_end, coalesce(p_retail_amount, 0), coalesce(p_wholesale_amount, 0),
    v_commission, coalesce(p_currency, 'USD')
  )
  on conflict (subscription_invoice_id) where subscription_invoice_id is not null
    do nothing
  returning id into v_commission_id;

  return v_commission_id;
end;
$$;

comment on function public.accrue_reseller_commission(
  uuid, date, date, numeric, numeric, char, uuid
) is 'Records the commission a partner earned on one billing period.';

-- Moves a commission from pending to earned once the money actually arrived.
create or replace function public.confirm_reseller_commission(
  p_commission_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_commission public.reseller_commissions%rowtype;
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Only the platform can confirm a commission'
      using errcode = '42501';
  end if;

  select * into v_commission
    from public.reseller_commissions
   where id = p_commission_id
     for update;

  if not found or v_commission.status <> 'pending' then
    return false;
  end if;

  update public.reseller_commissions
     set status = 'earned',
         earned_at = now(),
         updated_at = now()
   where id = p_commission_id;

  update public.reseller_tenant_links
     set lifetime_retail_amount = lifetime_retail_amount + v_commission.retail_amount,
         lifetime_commission_amount =
           lifetime_commission_amount + v_commission.commission_amount,
         updated_at = now()
   where company_id = v_commission.company_id;

  return true;
end;
$$;

comment on function public.confirm_reseller_commission(uuid) is
  'Marks a commission as earned once the tenant payment has cleared.';

-- Reverses a commission when the payment behind it was refunded.
create or replace function public.reverse_reseller_commission(
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
  v_commission public.reseller_commissions%rowtype;
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Only the platform can reverse a commission'
      using errcode = '42501';
  end if;

  select * into v_commission
    from public.reseller_commissions
   where id = p_commission_id
     for update;

  if not found then
    return false;
  end if;

  if v_commission.status = 'paid' then
    raise exception
      'A commission that has been paid out is reversed against the next payout'
      using errcode = '22023';
  end if;

  update public.reseller_commissions
     set status = 'reversed',
         reversed_at = now(),
         reversal_reason = p_reason,
         updated_at = now()
   where id = p_commission_id;

  if v_commission.status = 'earned' then
    update public.reseller_tenant_links
       set lifetime_retail_amount =
             greatest(lifetime_retail_amount - v_commission.retail_amount, 0),
           lifetime_commission_amount =
             greatest(lifetime_commission_amount - v_commission.commission_amount, 0),
           updated_at = now()
     where company_id = v_commission.company_id;
  end if;

  return true;
end;
$$;

comment on function public.reverse_reseller_commission(uuid, text) is
  'Reverses a commission when the payment it was earned on came back.';

-- Gathers everything earned in a period into one payment.
create or replace function public.build_reseller_payout(
  p_reseller_id uuid,
  p_period_start date,
  p_period_end date,
  p_fee_amount numeric default 0
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_payout_id uuid;
  v_reference text;
  v_next integer;
  v_gross numeric := 0;
  v_count integer := 0;
  v_currency char(3);
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Only the platform can prepare a partner payout'
      using errcode = '42501';
  end if;

  select coalesce(sum(commission_amount), 0),
         count(*)::int,
         min(currency)
    into v_gross, v_count, v_currency
    from public.reseller_commissions
   where reseller_id = p_reseller_id
     and status = 'earned'
     and payout_id is null
     and period_end between p_period_start and p_period_end;

  if v_count = 0 then
    return null;
  end if;

  select coalesce(
           max(nullif(regexp_replace(payout_reference, '^RP-', ''), '')::integer),
           0
         ) + 1
    into v_next
    from public.reseller_payouts
   where reseller_id = p_reseller_id
     and payout_reference ~ '^RP-[0-9]+$';

  v_reference := 'RP-' || lpad(v_next::text, 4, '0');

  insert into public.reseller_payouts (
    reseller_id, payout_reference, period_start, period_end, gross_amount,
    fee_amount, net_amount, currency, commission_count
  )
  values (
    p_reseller_id, v_reference, p_period_start, p_period_end, v_gross,
    coalesce(p_fee_amount, 0), v_gross - coalesce(p_fee_amount, 0),
    coalesce(v_currency, 'USD'), v_count
  )
  returning id into v_payout_id;

  update public.reseller_commissions
     set payout_id = v_payout_id,
         updated_at = now()
   where reseller_id = p_reseller_id
     and status = 'earned'
     and payout_id is null
     and period_end between p_period_start and p_period_end;

  return v_payout_id;
end;
$$;

comment on function public.build_reseller_payout(uuid, date, date, numeric) is
  'Gathers the commission earned in a period into one payment.';

-- Marks a payout as actually sent, which closes the commissions in it.
create or replace function public.settle_reseller_payout(
  p_payout_id uuid,
  p_external_reference text default null,
  p_method text default 'bank_transfer'
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Only the platform can settle a partner payout'
      using errcode = '42501';
  end if;

  update public.reseller_payouts
     set status = 'paid',
         paid_at = now(),
         external_reference = p_external_reference,
         payout_method = p_method,
         updated_at = now()
   where id = p_payout_id
     and status in ('draft', 'approved', 'processing');

  if not found then
    return false;
  end if;

  update public.reseller_commissions
     set status = 'paid',
         updated_at = now()
   where payout_id = p_payout_id
     and status = 'earned';

  return true;
end;
$$;

comment on function public.settle_reseller_payout(uuid, text, text) is
  'Records that a partner payout was sent and closes the commissions in it.';

-- The statement a partner reads: accounts, what they are worth, what is owed.
create or replace function public.reseller_statement(
  p_reseller_id uuid,
  p_from date,
  p_to date
)
returns table (
  active_accounts integer,
  suspended_accounts integer,
  retail_total numeric,
  wholesale_total numeric,
  commission_earned numeric,
  commission_pending numeric,
  commission_paid numeric,
  currency char(3)
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(
      public.is_service_role()
      or public.is_super_admin()
      or public.is_reseller_owner(p_reseller_id),
      false
    ) then
    raise exception 'That statement belongs to another partner'
      using errcode = '42501';
  end if;

  return query
  select (select count(*) filter (where l.status = 'active')
            from public.reseller_tenant_links as l
           where l.reseller_id = p_reseller_id)::integer,
         (select count(*) filter (where l.status = 'suspended')
            from public.reseller_tenant_links as l
           where l.reseller_id = p_reseller_id)::integer,
         coalesce(sum(c.retail_amount), 0),
         coalesce(sum(c.wholesale_amount), 0),
         coalesce(sum(c.commission_amount) filter (where c.status in ('earned', 'paid')), 0),
         coalesce(sum(c.commission_amount) filter (where c.status = 'pending'), 0),
         coalesce(sum(c.commission_amount) filter (where c.status = 'paid'), 0),
         coalesce(min(c.currency), 'USD'::char(3))
    from public.reseller_commissions as c
   where c.reseller_id = p_reseller_id
     and c.period_end between p_from and p_to
     and c.status <> 'reversed';
end;
$$;

comment on function public.reseller_statement(uuid, date, date) is
  'Summarises a partner period: accounts held, revenue and commission.';

-- The accounts a partner manages, with nothing from inside them.
create or replace function public.reseller_accounts(p_reseller_id uuid)
returns table (
  company_id uuid,
  display_name text,
  account_reference text,
  status text,
  provisioned_at timestamptz,
  lifetime_retail_amount numeric,
  lifetime_commission_amount numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(
      public.is_service_role()
      or public.is_super_admin()
      or public.is_reseller_owner(p_reseller_id),
      false
    ) then
    raise exception 'Those accounts belong to another partner'
      using errcode = '42501';
  end if;

  return query
  select l.company_id,
         c.display_name,
         l.account_reference,
         l.status,
         l.provisioned_at,
         l.lifetime_retail_amount,
         l.lifetime_commission_amount
    from public.reseller_tenant_links as l
    join public.companies as c on c.id = l.company_id
   where l.reseller_id = p_reseller_id
   order by l.provisioned_at desc;
end;
$$;

comment on function public.reseller_accounts(uuid) is
  'Lists the accounts a partner manages, with none of their contents.';

-- supabase/migrations/00213_create_settlement_engine.sql
-- What happens to the money between the client paying and the seller being
-- paid.
--
-- This is the heart of the business model. A freelancer or an online shop
-- sends an invoice, their client pays it by card on a hosted page, and the
-- money arrives with the platform rather than with the seller. From that
-- moment four things have to be true at all times, and this file is what
-- makes them true:
--
--   1. Every settled payment produces exactly one settlement row. Not two if
--      a webhook is delivered twice, and never none.
--   2. The three deductions are explicit and add up: what the card network
--      and the collecting partner charged, what this platform keeps, and
--      what is left for the seller. A seller can always see all three.
--   3. The seller's share is held for a stated number of days before it can
--      be withdrawn, because a card payment can be reversed by the payer for
--      far longer than it takes to withdraw it.
--   4. A refund or a chargeback takes the money back out of the same wallet
--      it went into, so the ledger cannot drift away from reality.
--
-- The fee the platform keeps is a percentage with a floor, because a small
-- invoice costs about as much to process as a large one.

-- -----------------------------------------------------------------------------
-- What this platform charges and how long it holds
-- -----------------------------------------------------------------------------

create table public.settlement_policies (
  id uuid primary key default public.generate_uuid_v7(),
  -- Null for the policy every tenant falls back to.
  company_id uuid,

  name text not null,
  fee_percentage numeric(7, 4) not null default 0.5000,
  minimum_fee numeric(18, 4) not null default 0.50,
  fixed_fee numeric(18, 4) not null default 0,

  hold_days smallint not null default 7,
  payout_sla_hours smallint not null default 24,
  payout_threshold numeric(18, 4) not null default 25,

  is_active boolean not null default true,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint settlement_policies_name_check
    check (length(btrim(name)) between 2 and 60),
  constraint settlement_policies_fee_check
    check (fee_percentage between 0 and 10
           and minimum_fee >= 0
           and fixed_fee >= 0),
  constraint settlement_policies_hold_check
    check (hold_days between 0 and 90),
  constraint settlement_policies_sla_check
    check (payout_sla_hours between 1 and 168),
  constraint settlement_policies_threshold_check
    check (payout_threshold >= 0)
);

comment on table public.settlement_policies is
  'What the platform keeps from a collected payment and how long it holds the rest.';

comment on column public.settlement_policies.minimum_fee is
  'Floor under the percentage, because a small payment costs as much to process as a large one.';

comment on column public.settlement_policies.payout_sla_hours is
  'The promise made to the seller: how long after a withdrawal request the money leaves.';

create unique index settlement_policies_platform_default
  on public.settlement_policies ((true))
  where company_id is null and deleted_at is null;

create unique index settlement_policies_company_unique
  on public.settlement_policies (company_id)
  where company_id is not null and deleted_at is null;

insert into public.settlement_policies (
  company_id, name, fee_percentage, minimum_fee, hold_days, payout_sla_hours,
  payout_threshold, notes
)
values (
  null, 'Standard collection terms', 0.5000, 0.50, 7, 24, 25,
  'Applies to every account that has no terms of its own.'
);

-- -----------------------------------------------------------------------------
-- One row per payment collected on behalf of a seller
-- -----------------------------------------------------------------------------

create table public.settlements (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  payment_id uuid not null,
  invoice_id uuid,
  client_id uuid,
  wallet_id uuid not null,

  currency char(3) not null,
  gross_amount numeric(18, 4) not null,
  gateway_fee_amount numeric(18, 4) not null default 0,
  platform_fee_percentage numeric(7, 4) not null default 0,
  platform_fee_amount numeric(18, 4) not null default 0,
  net_amount numeric(18, 4) not null,

  status text not null default 'held',
  hold_until date not null default current_date,
  released_at timestamptz,
  paid_out_at timestamptz,
  reversed_at timestamptz,
  reversal_reason text,

  payout_id uuid,
  wallet_transaction_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint settlements_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint settlements_amount_check
    check (gross_amount > 0
           and gateway_fee_amount >= 0
           and platform_fee_amount >= 0
           and net_amount >= 0),
  constraint settlements_sum_check
    check (round(net_amount + platform_fee_amount + gateway_fee_amount, 4)
           = round(gross_amount, 4)),
  constraint settlements_status_check
    check (status in ('held', 'available', 'paid_out', 'reversed')),
  constraint settlements_reversed_check
    check (status <> 'reversed' or reversal_reason is not null)
);

comment on table public.settlements is
  'What became of each payment the platform collected for a seller.';

comment on constraint settlements_sum_check on public.settlements is
  'The three parts of a payment always add back up to what the payer was charged.';

create unique index settlements_payment_unique
  on public.settlements (payment_id);

create index settlements_company_idx
  on public.settlements (company_id, created_at desc);

create index settlements_release_idx
  on public.settlements (hold_until)
  where status = 'held';

create index settlements_payable_idx
  on public.settlements (wallet_id, created_at)
  where status = 'available';

-- -----------------------------------------------------------------------------
-- Which terms apply to one seller
-- -----------------------------------------------------------------------------

create or replace function public.resolve_settlement_policy(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_policy public.settlement_policies%rowtype;
  v_plan record;
begin
  -- Terms written for this account alone win over everything else.
  select * into v_policy
    from public.settlement_policies
   where company_id = p_company_id
     and is_active
     and deleted_at is null;

  if found then
    return jsonb_build_object(
      'source', 'account',
      'fee_percentage', v_policy.fee_percentage,
      'minimum_fee', v_policy.minimum_fee,
      'fixed_fee', v_policy.fixed_fee,
      'hold_days', v_policy.hold_days,
      'payout_sla_hours', v_policy.payout_sla_hours,
      'payout_threshold', v_policy.payout_threshold
    );
  end if;

  select * into v_policy
    from public.settlement_policies
   where company_id is null
     and is_active
     and deleted_at is null;

  if not found then
    raise exception 'No collection terms have been configured' using errcode = '22023';
  end if;

  -- A plan may undercut the standard percentage, which is how a larger
  -- subscription pays for itself.
  select p.merchant_of_record_fee_percentage as fee_percentage,
         p.merchant_of_record_fee_fixed as fixed_fee
    into v_plan
    from public.subscriptions as s
    join public.subscription_plans as p on p.id = s.plan_id
   where s.company_id = p_company_id
     and s.status in ('trialing', 'active', 'past_due')
     and s.deleted_at is null
   order by s.created_at desc
   limit 1;

  return jsonb_build_object(
    'source', case when v_plan.fee_percentage is null then 'platform' else 'plan' end,
    'fee_percentage', coalesce(nullif(v_plan.fee_percentage, 0), v_policy.fee_percentage),
    'minimum_fee', v_policy.minimum_fee,
    'fixed_fee', coalesce(v_plan.fixed_fee, v_policy.fixed_fee),
    'hold_days', v_policy.hold_days,
    'payout_sla_hours', v_policy.payout_sla_hours,
    'payout_threshold', v_policy.payout_threshold
  );
end;
$$;

comment on function public.resolve_settlement_policy(uuid) is
  'Returns the collection terms that apply to one seller, account first, then plan, then platform.';

-- The arithmetic on its own, so a screen can quote a fee before a payment
-- exists and always quote the same number the ledger will later use.
create or replace function public.quote_settlement_fee(
  p_company_id uuid,
  p_amount numeric,
  p_gateway_fee numeric default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_policy jsonb;
  v_percentage numeric;
  v_fee numeric;
  v_gateway numeric;
  v_net numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'A payment has to be worth something' using errcode = '22023';
  end if;

  v_policy := public.resolve_settlement_policy(p_company_id);
  v_percentage := (v_policy ->> 'fee_percentage')::numeric;
  v_gateway := round(greatest(coalesce(p_gateway_fee, 0), 0), 4);

  v_fee := round(p_amount * v_percentage / 100, 4) + (v_policy ->> 'fixed_fee')::numeric;
  v_fee := greatest(v_fee, (v_policy ->> 'minimum_fee')::numeric);
  v_fee := round(v_fee, 4);

  -- The platform never takes so much that the seller is left with nothing;
  -- whatever is left after the collecting partner is the ceiling.
  v_fee := least(v_fee, round(p_amount - v_gateway, 4));
  v_fee := greatest(v_fee, 0);
  v_net := round(p_amount - v_gateway - v_fee, 4);

  return jsonb_build_object(
    'gross_amount', round(p_amount, 4),
    'gateway_fee_amount', v_gateway,
    'platform_fee_percentage', v_percentage,
    'platform_fee_amount', v_fee,
    'net_amount', v_net,
    'hold_days', (v_policy ->> 'hold_days')::int,
    'payout_sla_hours', (v_policy ->> 'payout_sla_hours')::int,
    'source', v_policy ->> 'source'
  );
end;
$$;

comment on function public.quote_settlement_fee(uuid, numeric, numeric) is
  'Breaks one payment into the collecting fee, the platform fee and the seller share.';

-- -----------------------------------------------------------------------------
-- A ledger entry that remembers which payment produced it
-- -----------------------------------------------------------------------------

-- The ledger is append only, so an entry cannot be annotated afterwards.
-- This writes the document references at the moment the entry is created.
create or replace function public.post_settlement_entry(
  p_wallet_id uuid,
  p_transaction_type public.wallet_transaction_type,
  p_amount numeric,
  p_description text,
  p_hold_days integer,
  p_payment_id uuid,
  p_invoice_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet public.wallets%rowtype;
  v_entry_id uuid;
  v_available numeric;
  v_pending numeric;
  v_is_pending boolean := coalesce(p_hold_days, 0) > 0;
begin
  select * into v_wallet from public.wallets where id = p_wallet_id for update;

  if not found then
    raise exception 'Wallet % was not found', p_wallet_id using errcode = 'P0002';
  end if;

  if p_amount = 0 then
    raise exception 'A ledger entry must move a non zero amount' using errcode = '22023';
  end if;

  v_available := v_wallet.available_balance;
  v_pending := v_wallet.pending_balance;

  if v_is_pending then
    v_pending := v_pending + p_amount;
  else
    v_available := v_available + p_amount;
  end if;

  if v_available < 0 then
    raise exception 'The wallet balance is not sufficient for this entry'
      using errcode = '22023';
  end if;

  insert into public.wallet_transactions (
    wallet_id, company_id, transaction_type, amount, currency, balance_after,
    is_pending, available_from, payment_id, invoice_id, description, metadata
  )
  values (
    p_wallet_id, v_wallet.company_id, p_transaction_type, p_amount,
    v_wallet.currency, v_available, v_is_pending,
    case when v_is_pending then current_date + p_hold_days else null end,
    p_payment_id, p_invoice_id, p_description, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_entry_id;

  update public.wallets
     set available_balance = v_available,
         pending_balance = v_pending,
         lifetime_credited = lifetime_credited + greatest(p_amount, 0),
         lifetime_debited = lifetime_debited + greatest(-p_amount, 0),
         updated_at = now()
   where id = p_wallet_id;

  return v_entry_id;
end;
$$;

comment on function public.post_settlement_entry(
  uuid, public.wallet_transaction_type, numeric, text, integer, uuid, uuid, jsonb
) is 'Appends a ledger entry that already carries the payment it came from.';

-- -----------------------------------------------------------------------------
-- Turning a collected payment into money the seller can see
-- -----------------------------------------------------------------------------

-- Returns the wallet of a seller in one currency, opening one the first time
-- they are paid in it.
create or replace function public.ensure_company_wallet(
  p_company_id uuid,
  p_currency char(3)
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet_id uuid;
  v_policy jsonb;
begin
  select id into v_wallet_id
    from public.wallets
   where company_id = p_company_id
     and currency = p_currency
     and deleted_at is null;

  if v_wallet_id is not null then
    return v_wallet_id;
  end if;

  v_policy := public.resolve_settlement_policy(p_company_id);

  insert into public.wallets (
    company_id, currency, payout_hold_days, payout_threshold
  )
  values (
    p_company_id, p_currency,
    (v_policy ->> 'hold_days')::smallint,
    (v_policy ->> 'payout_threshold')::numeric
  )
  returning id into v_wallet_id;

  return v_wallet_id;
end;
$$;

comment on function public.ensure_company_wallet(uuid, char) is
  'Returns the wallet of a seller in one currency, opening it on first use.';

-- The one place a collected payment becomes a balance. Calling it twice for
-- the same payment changes nothing the second time, which is what makes a
-- repeated webhook harmless.
create or replace function public.settle_invoice_funds(p_payment_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_existing uuid;
  v_breakdown jsonb;
  v_wallet_id uuid;
  v_entry_id uuid;
  v_settlement_id uuid;
  v_hold_days integer;
  v_invoice_id uuid;
begin
  select * into v_payment
    from public.payments
   where id = p_payment_id
     and deleted_at is null;

  if not found then
    raise exception 'That payment was not found' using errcode = 'P0002';
  end if;

  if not (public.is_service_role()
          or public.can_write_company_data(v_payment.company_id)) then
    raise exception 'You are not allowed to settle money in this account'
      using errcode = '42501';
  end if;

  select id into v_existing
    from public.settlements
   where payment_id = p_payment_id;

  if v_existing is not null then
    return v_existing;
  end if;

  if v_payment.status <> 'succeeded' then
    raise exception 'Only a payment that actually arrived can be settled'
      using errcode = '22023';
  end if;

  v_breakdown := public.quote_settlement_fee(
    v_payment.company_id, v_payment.amount, v_payment.gateway_fee_amount
  );

  v_wallet_id := public.ensure_company_wallet(v_payment.company_id, v_payment.currency);
  v_hold_days := (v_breakdown ->> 'hold_days')::int;

  select invoice_id into v_invoice_id
    from public.payment_allocations
   where payment_id = p_payment_id
   order by created_at
   limit 1;

  -- The seller sees the money at once, marked as held, because hiding it
  -- until the hold expires only produces support messages.
  v_entry_id := public.post_settlement_entry(
    v_wallet_id,
    'credit',
    (v_breakdown ->> 'net_amount')::numeric,
    'Invoice payment received',
    v_hold_days,
    p_payment_id,
    v_invoice_id,
    jsonb_build_object(
      'gross_amount', v_breakdown -> 'gross_amount',
      'platform_fee_amount', v_breakdown -> 'platform_fee_amount',
      'gateway_fee_amount', v_breakdown -> 'gateway_fee_amount'
    )
  );

  insert into public.settlements (
    company_id, payment_id, invoice_id, client_id, wallet_id, currency,
    gross_amount, gateway_fee_amount, platform_fee_percentage,
    platform_fee_amount, net_amount, status, hold_until, released_at,
    wallet_transaction_id
  )
  values (
    v_payment.company_id, p_payment_id, v_invoice_id, v_payment.client_id,
    v_wallet_id, v_payment.currency,
    (v_breakdown ->> 'gross_amount')::numeric,
    (v_breakdown ->> 'gateway_fee_amount')::numeric,
    (v_breakdown ->> 'platform_fee_percentage')::numeric,
    (v_breakdown ->> 'platform_fee_amount')::numeric,
    (v_breakdown ->> 'net_amount')::numeric,
    case when v_hold_days > 0 then 'held' else 'available' end,
    current_date + v_hold_days,
    case when v_hold_days > 0 then null else now() end,
    v_entry_id
  )
  returning id into v_settlement_id;

  update public.payments
     set platform_fee_amount = (v_breakdown ->> 'platform_fee_amount')::numeric,
         updated_at = now()
   where id = p_payment_id;

  return v_settlement_id;
end;
$$;

comment on function public.settle_invoice_funds(uuid) is
  'Splits one collected payment into fees and seller share, exactly once.';

-- Settling a checkout now also moves the money into the wallet of the
-- seller, so the two can never disagree.
create or replace function public.settle_payment_intent(
  p_intent_id uuid,
  p_provider_reference text default null,
  p_amount numeric default null,
  p_fee numeric default 0,
  p_method public.payment_method_type default 'card'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_intent public.payment_intents%rowtype;
  v_existing uuid;
  v_amount numeric;
  v_payment_id uuid;
begin
  select * into v_intent from public.payment_intents
   where id = p_intent_id for update;

  if not found then
    raise exception 'Payment attempt % was not found', p_intent_id using errcode = 'P0002';
  end if;

  if not (public.is_service_role() or public.can_write_company_data(v_intent.company_id)) then
    raise exception 'You are not allowed to settle payments in this company'
      using errcode = '42501';
  end if;

  select id into v_existing from public.payments
   where payment_intent_id = p_intent_id and deleted_at is null
   limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  v_amount := coalesce(p_amount, v_intent.amount);

  if v_amount <= 0 then
    raise exception 'A settled payment must be greater than zero' using errcode = '22023';
  end if;

  insert into public.payments (
    company_id, client_id, amount, amount_minor, currency, currency_exponent,
    method_type, provider, gateway_id, payment_intent_id,
    provider_payment_reference, gateway_fee_amount, is_manual, status
  )
  values (
    v_intent.company_id, v_intent.client_id, v_amount,
    public.to_minor_units(v_amount, v_intent.currency_exponent),
    v_intent.currency, v_intent.currency_exponent,
    p_method, v_intent.provider, v_intent.gateway_id, v_intent.id,
    coalesce(p_provider_reference, v_intent.provider_intent_reference),
    coalesce(p_fee, 0), false, 'succeeded'
  )
  returning id into v_payment_id;

  if v_intent.invoice_id is not null then
    perform public.allocate_payment_to_invoice(v_payment_id, v_intent.invoice_id, null);
  end if;

  update public.payment_intents
     set status = 'succeeded',
         completed_at = now(),
         failure_code = null,
         failure_message = null,
         provider_intent_reference =
           coalesce(provider_intent_reference, p_provider_reference),
         updated_at = now()
   where id = p_intent_id;

  perform public.settle_invoice_funds(v_payment_id);

  return v_payment_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- The hold expiring, the money leaving, and the money coming back
-- -----------------------------------------------------------------------------

create or replace function public.release_matured_settlements()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  -- The settlement row is the single source of truth for how long money is
  -- held, so the ledger entry behind it is released from here rather than
  -- from a second date that could drift away from it.
  for v_row in
    select s.id,
           s.wallet_id,
           s.wallet_transaction_id,
           t.amount,
           t.is_pending
      from public.settlements as s
      left join public.wallet_transactions as t on t.id = s.wallet_transaction_id
     where s.status = 'held'
       and s.hold_until <= current_date
     order by s.created_at
  loop
    if v_row.is_pending then
      update public.wallet_transactions
         set is_pending = false,
             released_at = now()
       where id = v_row.wallet_transaction_id;

      update public.wallets
         set pending_balance = greatest(pending_balance - v_row.amount, 0),
             available_balance = available_balance + v_row.amount,
             updated_at = now()
       where id = v_row.wallet_id;
    end if;

    update public.settlements
       set status = 'available',
           released_at = now(),
           updated_at = now()
     where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  -- Anything credited outside a settlement, such as a manual adjustment,
  -- still matures on its own date.
  perform public.release_matured_wallet_funds();

  return v_count;
end;
$$;

comment on function public.release_matured_settlements() is
  'Moves settlements out of the hold window once their date has passed.';

-- Marks the oldest available settlements as covered by one payout, so a
-- seller can see which invoices a transfer actually paid them for.
create or replace function public.attach_settlements_to_payout(p_payout_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_payout public.payouts%rowtype;
  v_remaining numeric;
  v_row record;
  v_count integer := 0;
begin
  if not public.is_service_role() then
    raise exception 'Only the server attaches settlements to a payout'
      using errcode = '42501';
  end if;

  select * into v_payout from public.payouts where id = p_payout_id;

  if not found then
    raise exception 'That payout was not found' using errcode = 'P0002';
  end if;

  v_remaining := v_payout.amount;

  for v_row in
    select id, net_amount
      from public.settlements
     where wallet_id = v_payout.wallet_id
       and status = 'available'
     order by created_at
  loop
    exit when v_remaining <= 0;

    update public.settlements
       set status = 'paid_out',
           payout_id = p_payout_id,
           paid_out_at = now(),
           updated_at = now()
     where id = v_row.id;

    v_remaining := v_remaining - v_row.net_amount;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.attach_settlements_to_payout(uuid) is
  'Records which settlements one transfer to the seller actually paid out.';

-- A refund or a chargeback takes the seller share back out of the same
-- wallet it went into. The fees already charged are not invented back; what
-- the platform returns is decided by hand, because a reversal costs money.
create or replace function public.reverse_settlement(
  p_payment_id uuid,
  p_reason text,
  p_return_platform_fee boolean default false
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_settlement public.settlements%rowtype;
  v_amount numeric;
begin
  if not public.is_service_role() then
    raise exception 'Only the server reverses a settlement' using errcode = '42501';
  end if;

  select * into v_settlement
    from public.settlements
   where payment_id = p_payment_id;

  if not found then
    raise exception 'That payment was never settled' using errcode = 'P0002';
  end if;

  if v_settlement.status = 'reversed' then
    return false;
  end if;

  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reversal has to say why' using errcode = '22023';
  end if;

  v_amount := v_settlement.net_amount
            + case when p_return_platform_fee then v_settlement.platform_fee_amount else 0 end;

  perform public.post_wallet_transaction(
    v_settlement.wallet_id,
    (case when v_settlement.status = 'paid_out' then 'chargeback' else 'refund' end)
      ::public.wallet_transaction_type,
    -v_amount,
    left('Payment reversed: ' || btrim(p_reason), 300),
    false,
    jsonb_build_object('payment_id', p_payment_id, 'settlement_id', v_settlement.id)
  );

  update public.settlements
     set status = 'reversed',
         reversed_at = now(),
         reversal_reason = left(btrim(p_reason), 300),
         updated_at = now()
   where id = v_settlement.id;

  return true;
end;
$$;

comment on function public.reverse_settlement(uuid, text, boolean) is
  'Takes a settled payment back out of the wallet it was credited to.';

-- -----------------------------------------------------------------------------
-- What the seller and the platform team see
-- -----------------------------------------------------------------------------

create or replace function public.company_settlements(
  p_company_id uuid,
  p_status text default null,
  p_limit integer default 50
)
returns table (
  settlement_id uuid,
  invoice_id uuid,
  invoice_number text,
  client_name text,
  currency char(3),
  gross_amount numeric,
  gateway_fee_amount numeric,
  platform_fee_amount numeric,
  net_amount numeric,
  status text,
  hold_until date,
  released_at timestamptz,
  paid_out_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You do not have permission to read this money'
      using errcode = '42501';
  end if;

  return query
    select s.id,
           s.invoice_id,
           i.invoice_number,
           c.display_name,
           s.currency,
           s.gross_amount,
           s.gateway_fee_amount,
           s.platform_fee_amount,
           s.net_amount,
           s.status,
           s.hold_until,
           s.released_at,
           s.paid_out_at,
           s.created_at
      from public.settlements as s
      left join public.invoices as i on i.id = s.invoice_id
      left join public.clients as c on c.id = s.client_id
     where s.company_id = p_company_id
       and (p_status is null or s.status = p_status)
     order by s.created_at desc
     limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

comment on function public.company_settlements(uuid, text, integer) is
  'Lists what became of each payment collected for one seller.';

create or replace function public.company_settlement_summary(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_policy jsonb;
  v_held numeric;
  v_available numeric;
  v_paid numeric;
  v_fees numeric;
  v_next date;
  v_wallet public.wallets%rowtype;
begin
  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You do not have permission to read this money'
      using errcode = '42501';
  end if;

  v_policy := public.resolve_settlement_policy(p_company_id);

  select coalesce(sum(net_amount) filter (where status = 'held'), 0),
         coalesce(sum(net_amount) filter (where status = 'available'), 0),
         coalesce(sum(net_amount) filter (where status = 'paid_out'), 0),
         coalesce(sum(platform_fee_amount + gateway_fee_amount)
                  filter (where status <> 'reversed'), 0),
         min(hold_until) filter (where status = 'held')
    into v_held, v_available, v_paid, v_fees, v_next
    from public.settlements
   where company_id = p_company_id;

  select * into v_wallet
    from public.wallets
   where company_id = p_company_id
     and deleted_at is null
   order by created_at
   limit 1;

  return jsonb_build_object(
    'held_amount', v_held,
    'available_amount', v_available,
    'paid_out_amount', v_paid,
    'fees_paid', v_fees,
    'next_release_date', v_next,
    'currency', coalesce(v_wallet.currency, 'USD'),
    'wallet_id', v_wallet.id,
    'is_frozen', coalesce(v_wallet.is_frozen, false),
    'fee_percentage', (v_policy ->> 'fee_percentage')::numeric,
    'minimum_fee', (v_policy ->> 'minimum_fee')::numeric,
    'hold_days', (v_policy ->> 'hold_days')::int,
    'payout_sla_hours', (v_policy ->> 'payout_sla_hours')::int,
    'payout_threshold', (v_policy ->> 'payout_threshold')::numeric
  );
end;
$$;

comment on function public.company_settlement_summary(uuid) is
  'Sums what one seller is holding, what is ready and what the fees have cost.';

-- Withdrawal requests that are running out of time against the promise made
-- to the seller. This is the queue the money team works from.
create or replace function public.payout_sla_queue(p_limit integer default 100)
returns table (
  payout_id uuid,
  company_id uuid,
  company_name text,
  amount numeric,
  currency char(3),
  status public.payout_status,
  requested_at timestamptz,
  due_at timestamptz,
  hours_remaining numeric,
  is_breached boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may read the withdrawal queue'
      using errcode = '42501';
  end if;

  return query
    select p.id,
           p.company_id,
           c.legal_name,
           p.amount,
           p.currency,
           p.status,
           p.requested_at,
           p.requested_at
             + make_interval(hours =>
                 (public.resolve_settlement_policy(p.company_id) ->> 'payout_sla_hours')::int),
           round(
             extract(
               epoch from (
                 p.requested_at
                 + make_interval(hours =>
                     (public.resolve_settlement_policy(p.company_id) ->> 'payout_sla_hours')::int)
                 - now()
               )
             ) / 3600.0,
             2
           ),
           now() > p.requested_at
             + make_interval(hours =>
                 (public.resolve_settlement_policy(p.company_id) ->> 'payout_sla_hours')::int)
      from public.payouts as p
      left join public.companies as c on c.id = p.company_id
     where p.status in ('requested', 'approved', 'processing')
       and p.deleted_at is null
     order by p.requested_at
     limit greatest(coalesce(p_limit, 100), 1);
end;
$$;

comment on function public.payout_sla_queue(integer) is
  'Withdrawal requests still open, with how long is left of the promise made.';

-- -----------------------------------------------------------------------------
-- Changing the terms
-- -----------------------------------------------------------------------------

create or replace function public.save_settlement_policy(
  p_name text,
  p_fee_percentage numeric,
  p_minimum_fee numeric,
  p_company_id uuid default null,
  p_fixed_fee numeric default 0,
  p_hold_days integer default 7,
  p_payout_sla_hours integer default 24,
  p_payout_threshold numeric default 25,
  p_notes text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may change the collection terms'
      using errcode = '42501';
  end if;

  select id into v_id
    from public.settlement_policies
   where company_id is not distinct from p_company_id
     and deleted_at is null;

  if v_id is null then
    insert into public.settlement_policies (
      company_id, name, fee_percentage, minimum_fee, fixed_fee, hold_days,
      payout_sla_hours, payout_threshold, notes, created_by, updated_by
    )
    values (
      p_company_id, btrim(p_name), p_fee_percentage, p_minimum_fee,
      coalesce(p_fixed_fee, 0), coalesce(p_hold_days, 7)::smallint,
      coalesce(p_payout_sla_hours, 24)::smallint, coalesce(p_payout_threshold, 25),
      nullif(btrim(coalesce(p_notes, '')), ''),
      public.current_user_id(), public.current_user_id()
    )
    returning id into v_id;

    return v_id;
  end if;

  update public.settlement_policies
     set name = btrim(p_name),
         fee_percentage = p_fee_percentage,
         minimum_fee = p_minimum_fee,
         fixed_fee = coalesce(p_fixed_fee, 0),
         hold_days = coalesce(p_hold_days, 7)::smallint,
         payout_sla_hours = coalesce(p_payout_sla_hours, 24)::smallint,
         payout_threshold = coalesce(p_payout_threshold, 25),
         notes = nullif(btrim(coalesce(p_notes, '')), ''),
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = v_id;

  return v_id;
end;
$$;

comment on function public.save_settlement_policy(
  text, numeric, numeric, uuid, numeric, integer, integer, numeric, text
) is 'Sets the collection terms for the platform or for one account.';

create or replace function public.platform_settlement_policies()
returns table (
  policy_id uuid,
  company_id uuid,
  company_name text,
  name text,
  fee_percentage numeric,
  minimum_fee numeric,
  fixed_fee numeric,
  hold_days smallint,
  payout_sla_hours smallint,
  payout_threshold numeric,
  settled_count integer,
  fees_collected numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may read the collection terms'
      using errcode = '42501';
  end if;

  return query
    select p.id,
           p.company_id,
           c.legal_name,
           p.name,
           p.fee_percentage,
           p.minimum_fee,
           p.fixed_fee,
           p.hold_days,
           p.payout_sla_hours,
           p.payout_threshold,
           coalesce(s.settled_count, 0)::int,
           coalesce(s.fees_collected, 0)::numeric
      from public.settlement_policies as p
      left join public.companies as c on c.id = p.company_id
      left join lateral (
        select count(*)::int as settled_count,
               coalesce(sum(x.platform_fee_amount), 0)::numeric as fees_collected
          from public.settlements as x
         where p.company_id is null or x.company_id = p.company_id
      ) as s on true
     where p.deleted_at is null
     order by p.company_id nulls first, p.created_at;
end;
$$;

comment on function public.platform_settlement_policies() is
  'Lists the collection terms in force and what they have earned.';

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.settlement_policies enable row level security;
alter table public.settlements enable row level security;
alter table public.settlement_policies force row level security;
alter table public.settlements force row level security;

create policy settlement_policies_select on public.settlement_policies
  for select to authenticated
  using (
    deleted_at is null
    and (company_id is null or public.has_company_access(company_id))
  );

create policy settlements_select on public.settlements
  for select to authenticated
  using (public.has_company_access(company_id));

comment on policy settlements_select on public.settlements is
  'A seller sees what became of their own money and nobody else can.';

grant select on public.settlement_policies to authenticated;
grant select on public.settlements to authenticated;

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.resolve_settlement_policy(uuid)
  from public, authenticated;
revoke execute on function public.quote_settlement_fee(uuid, numeric, numeric)
  from public, authenticated;
revoke execute on function public.ensure_company_wallet(uuid, char)
  from public, authenticated;
revoke execute on function public.post_settlement_entry(
  uuid, public.wallet_transaction_type, numeric, text, integer, uuid, uuid, jsonb
) from public, authenticated;
revoke execute on function public.settle_invoice_funds(uuid)
  from public, authenticated;
revoke execute on function public.release_matured_settlements()
  from public, authenticated;
revoke execute on function public.attach_settlements_to_payout(uuid)
  from public, authenticated;
revoke execute on function public.reverse_settlement(uuid, text, boolean)
  from public, authenticated;
revoke execute on function public.company_settlements(uuid, text, integer)
  from public, authenticated;
revoke execute on function public.company_settlement_summary(uuid)
  from public, authenticated;
revoke execute on function public.payout_sla_queue(integer)
  from public, authenticated;
revoke execute on function public.save_settlement_policy(
  text, numeric, numeric, uuid, numeric, integer, integer, numeric, text
) from public, authenticated;
revoke execute on function public.platform_settlement_policies()
  from public, authenticated;

grant execute on function public.resolve_settlement_policy(uuid)
  to authenticated, service_role;
grant execute on function public.quote_settlement_fee(uuid, numeric, numeric)
  to authenticated, service_role;
grant execute on function public.ensure_company_wallet(uuid, char) to service_role;
grant execute on function public.post_settlement_entry(
  uuid, public.wallet_transaction_type, numeric, text, integer, uuid, uuid, jsonb
) to service_role;
grant execute on function public.settle_invoice_funds(uuid)
  to authenticated, service_role;
grant execute on function public.release_matured_settlements() to service_role;
grant execute on function public.attach_settlements_to_payout(uuid) to service_role;
grant execute on function public.reverse_settlement(uuid, text, boolean) to service_role;
grant execute on function public.company_settlements(uuid, text, integer)
  to authenticated, service_role;
grant execute on function public.company_settlement_summary(uuid)
  to authenticated, service_role;
grant execute on function public.payout_sla_queue(integer)
  to authenticated, service_role;
grant execute on function public.save_settlement_policy(
  text, numeric, numeric, uuid, numeric, integer, integer, numeric, text
) to authenticated, service_role;
grant execute on function public.platform_settlement_policies()
  to authenticated, service_role;

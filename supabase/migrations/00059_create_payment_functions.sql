-- supabase/migrations/00059_create_payment_functions.sql
-- Recording money and applying it to invoices.
--
-- Everything that touches a balance goes through these routines, so a payment
-- can never be counted twice, allocated beyond its amount, or applied to an
-- invoice in another currency or another tenant.

-- Allocates part of a payment to one invoice.
create or replace function public.allocate_payment_to_invoice(
  p_payment_id uuid,
  p_invoice_id uuid,
  p_amount numeric default null
)
returns numeric
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_invoice public.invoices%rowtype;
  v_amount numeric;
begin
  select * into v_payment from public.payments
   where id = p_payment_id and deleted_at is null for update;

  if not found then
    raise exception 'Payment % was not found', p_payment_id using errcode = 'P0002';
  end if;

  select * into v_invoice from public.invoices
   where id = p_invoice_id and deleted_at is null for update;

  if not found then
    raise exception 'Invoice % was not found', p_invoice_id using errcode = 'P0002';
  end if;

  if v_payment.company_id <> v_invoice.company_id then
    raise exception 'A payment can only settle invoices of its own company'
      using errcode = '42501';
  end if;

  if not public.can_write_company_data(v_payment.company_id) then
    raise exception 'You are not allowed to allocate payments in this company'
      using errcode = '42501';
  end if;

  if v_payment.currency <> v_invoice.currency then
    raise exception 'The payment and the invoice must use the same currency'
      using errcode = '22023';
  end if;

  if v_invoice.status = 'draft' then
    raise exception 'A draft invoice cannot receive a payment' using errcode = '42501';
  end if;

  v_amount := least(
    coalesce(p_amount, v_payment.unallocated_amount),
    v_payment.unallocated_amount,
    v_invoice.balance_due
  );

  if v_amount <= 0 then
    raise exception 'There is nothing left to allocate' using errcode = '22023';
  end if;

  insert into public.payment_allocations (company_id, payment_id, invoice_id, amount)
  values (v_payment.company_id, p_payment_id, p_invoice_id, v_amount);

  update public.payments
     set allocated_amount = allocated_amount + v_amount,
         updated_at = now()
   where id = p_payment_id;

  update public.invoices
     set paid_amount = paid_amount + v_amount,
         updated_at = now()
   where id = p_invoice_id;

  perform public.refresh_invoice_settlement(p_invoice_id);

  insert into public.document_events (
    company_id, document_kind, document_id, event_type, detail
  )
  values (
    v_payment.company_id, 'invoice', p_invoice_id, 'paid',
    jsonb_build_object('amount', v_amount, 'payment_id', p_payment_id)
  );

  return v_amount;
end;
$$;

comment on function public.allocate_payment_to_invoice(uuid, uuid, numeric) is
  'Applies part of a received payment to one invoice and updates both sides.';

-- Records a payment and, when an invoice is supplied, settles it in one step.
create or replace function public.record_payment(
  p_company_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_method public.payment_method_type default 'bank_transfer',
  p_provider public.gateway_provider default 'manual',
  p_received_at timestamptz default now(),
  p_reference text default null,
  p_gateway_fee numeric default 0
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_company public.companies%rowtype;
  v_payment_id uuid;
  v_currency char(3);
  v_exponent smallint;
  v_client_id uuid;
begin
  if not public.can_write_company_data(p_company_id) then
    raise exception 'You are not allowed to record payments in this company'
      using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'A payment must be greater than zero' using errcode = '22023';
  end if;

  select * into v_company from public.companies where id = p_company_id;

  if not found then
    raise exception 'Company % was not found', p_company_id using errcode = 'P0002';
  end if;

  if p_invoice_id is not null then
    select * into v_invoice from public.invoices
     where id = p_invoice_id and deleted_at is null;

    if not found then
      raise exception 'Invoice % was not found', p_invoice_id using errcode = 'P0002';
    end if;

    v_currency := v_invoice.currency;
    v_exponent := v_invoice.currency_exponent;
    v_client_id := v_invoice.client_id;
  else
    v_currency := v_company.base_currency;
    v_exponent := v_company.currency_exponent;
  end if;

  insert into public.payments (
    company_id, client_id, amount, amount_minor, currency, currency_exponent,
    method_type, provider, received_at, provider_payment_reference,
    gateway_fee_amount, is_manual, recorded_by, status
  )
  values (
    p_company_id, v_client_id, p_amount,
    public.to_minor_units(p_amount, v_exponent), v_currency, v_exponent,
    p_method, p_provider, p_received_at, p_reference, coalesce(p_gateway_fee, 0),
    p_provider = 'manual', public.current_user_id(), 'succeeded'
  )
  returning id into v_payment_id;

  if p_invoice_id is not null then
    perform public.allocate_payment_to_invoice(v_payment_id, p_invoice_id, null);
  end if;

  return v_payment_id;
end;
$$;

comment on function public.record_payment(
  uuid, uuid, numeric, public.payment_method_type, public.gateway_provider,
  timestamptz, text, numeric
) is 'Records money received and settles the invoice it belongs to.';

-- Reverses an allocation, for example when a payment was applied to the wrong
-- invoice. The money stays on the payment and can be allocated again.
create or replace function public.reverse_payment_allocation(
  p_allocation_id uuid,
  p_reason text default null
)
returns numeric
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_allocation public.payment_allocations%rowtype;
begin
  select * into v_allocation from public.payment_allocations
   where id = p_allocation_id for update;

  if not found then
    raise exception 'Allocation % was not found', p_allocation_id using errcode = 'P0002';
  end if;

  if v_allocation.reversed_at is not null then
    return 0;
  end if;

  if not public.can_write_company_data(v_allocation.company_id) then
    raise exception 'You are not allowed to change allocations in this company'
      using errcode = '42501';
  end if;

  update public.payment_allocations
     set reversed_at = now(),
         reversal_reason = p_reason,
         updated_at = now()
   where id = p_allocation_id;

  update public.payments
     set allocated_amount = greatest(allocated_amount - v_allocation.amount, 0),
         updated_at = now()
   where id = v_allocation.payment_id;

  update public.invoices
     set paid_amount = greatest(paid_amount - v_allocation.amount, 0),
         updated_at = now()
   where id = v_allocation.invoice_id;

  perform public.refresh_invoice_settlement(v_allocation.invoice_id);

  return v_allocation.amount;
end;
$$;

comment on function public.reverse_payment_allocation(uuid, text) is
  'Undoes an allocation and returns the amount to the unallocated balance.';

-- Credits the tenant wallet with the net proceeds of a payment the platform
-- collected as merchant of record, and states every fee that was taken.
create or replace function public.settle_merchant_of_record_payment(
  p_payment_id uuid,
  p_platform_fee numeric default 0
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_wallet_id uuid;
  v_net numeric;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;

  if not found then
    raise exception 'Payment % was not found', p_payment_id using errcode = 'P0002';
  end if;

  update public.payments
     set platform_fee_amount = coalesce(p_platform_fee, 0),
         updated_at = now()
   where id = p_payment_id;

  select id into v_wallet_id
    from public.wallets
   where company_id = v_payment.company_id
     and currency = v_payment.currency
     and deleted_at is null;

  if v_wallet_id is null then
    insert into public.wallets (company_id, currency)
    values (v_payment.company_id, v_payment.currency)
    returning id into v_wallet_id;
  end if;

  v_net := v_payment.amount - v_payment.gateway_fee_amount - coalesce(p_platform_fee, 0);

  if v_net <= 0 then
    raise exception 'The fees cannot exceed the amount received' using errcode = '22023';
  end if;

  perform public.post_wallet_transaction(
    v_wallet_id,
    'credit',
    v_net,
    'Net proceeds of a collected payment',
    true,
    jsonb_build_object(
      'payment_id', p_payment_id,
      'gross_amount', v_payment.amount,
      'gateway_fee', v_payment.gateway_fee_amount,
      'platform_fee', coalesce(p_platform_fee, 0)
    )
  );

  return v_wallet_id;
end;
$$;

comment on function public.settle_merchant_of_record_payment(uuid, numeric) is
  'Credits the tenant wallet with the net proceeds and records every fee taken.';

-- Returns the fee breakdown of a payment, used by the transparency report and
-- by the monthly fee invoice.
create or replace function public.payment_fee_breakdown(p_payment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'gross_amount', p.amount,
           'currency', p.currency,
           'gateway_fee', p.gateway_fee_amount,
           'platform_fee', p.platform_fee_amount,
           'net_amount', p.net_amount,
           'effective_fee_percentage',
             case when p.amount > 0
                  then round(
                         (p.gateway_fee_amount + p.platform_fee_amount) * 100 / p.amount, 4
                       )
                  else 0
             end,
           'provider', p.provider,
           'received_at', p.received_at
         )
    from public.payments as p
   where p.id = p_payment_id;
$$;

comment on function public.payment_fee_breakdown(uuid) is
  'Returns the gross, fee and net amounts of a payment as a single record.';

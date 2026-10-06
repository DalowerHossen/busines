-- supabase/migrations/00191_create_checkout_settlement.sql
-- Turning a started online payment into money against an invoice.
--
-- A client who pays online has no account, so the browser never settles
-- anything. The provider tells us what happened through a webhook, and the
-- webhook handler runs with the service role. These routines are the only way
-- that handler is allowed to touch a balance, and they are written so that a
-- provider which delivers the same event twice cannot create two payments.

-- The allocation routine predates online checkout and only trusted a signed in
-- member of the business. The webhook handler has no session, so the service
-- role is accepted here as well. Everything else about the routine is
-- unchanged.
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

  if not (public.is_service_role() or public.can_write_company_data(v_payment.company_id)) then
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

-- Records the money behind a finished checkout.
--
-- The intent is the unit of idempotency: once it carries a payment, that
-- payment is returned again rather than a second one being created.
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

  return v_payment_id;
end;
$$;

comment on function public.settle_payment_intent(
  uuid, text, numeric, numeric, public.payment_method_type
) is 'Records the money behind a finished checkout exactly once.';

-- Writes down why a checkout did not finish, so the client can be told
-- something useful and the business can see what is going wrong.
create or replace function public.fail_payment_intent(
  p_intent_id uuid,
  p_failure_code text default null,
  p_failure_message text default null
)
returns public.payment_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_intent public.payment_intents%rowtype;
begin
  select * into v_intent from public.payment_intents
   where id = p_intent_id for update;

  if not found then
    raise exception 'Payment attempt % was not found', p_intent_id using errcode = 'P0002';
  end if;

  if not (public.is_service_role() or public.can_write_company_data(v_intent.company_id)) then
    raise exception 'You are not allowed to change payments in this company'
      using errcode = '42501';
  end if;

  -- Money that already arrived is never undone by a late failure notice.
  if v_intent.status = 'succeeded' then
    return v_intent.status;
  end if;

  update public.payment_intents
     set status = 'failed',
         failure_code = p_failure_code,
         failure_message = p_failure_message,
         completed_at = now(),
         updated_at = now()
   where id = p_intent_id;

  return 'failed'::public.payment_status;
end;
$$;

comment on function public.fail_payment_intent(uuid, text, text) is
  'Records why an online payment attempt did not finish.';

revoke all on function public.settle_payment_intent(
  uuid, text, numeric, numeric, public.payment_method_type
) from public, authenticated;

revoke all on function public.fail_payment_intent(uuid, text, text)
  from public, authenticated;

grant execute on function public.settle_payment_intent(
  uuid, text, numeric, numeric, public.payment_method_type
) to service_role;

grant execute on function public.fail_payment_intent(uuid, text, text) to service_role;

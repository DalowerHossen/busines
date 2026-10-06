-- supabase/migrations/00054_create_refunds.sql
-- Refunds.
--
-- A refund always points at the payment it reverses, so the money trail stays
-- closed: received, allocated, refunded. Refunds above a configured amount can
-- require a second approval, which is recorded on the row itself.

create table public.refunds (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  payment_id uuid not null,
  invoice_id uuid,
  credit_note_id uuid,
  client_id uuid,

  refund_number text,
  status public.refund_status not null default 'requested',

  amount numeric(18, 4) not null,
  amount_minor bigint not null default 0,
  currency char(3) not null,
  gateway_fee_returned numeric(18, 4) not null default 0,

  reason text not null,
  reason_code text,
  is_partial boolean not null default false,

  provider public.gateway_provider not null default 'manual',
  provider_refund_reference text,
  failure_code text,
  failure_message text,

  -- Four eyes approval for large refunds.
  requires_approval boolean not null default false,
  approval_status public.approval_status,
  requested_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,

  processed_at timestamptz,
  settled_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint refunds_amount_check
    check (amount > 0),
  constraint refunds_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint refunds_reason_check
    check (length(btrim(reason)) between 3 and 500),
  constraint refunds_fee_check
    check (gateway_fee_returned >= 0),
  constraint refunds_approval_check
    check (not requires_approval or approval_status is not null),
  constraint refunds_approved_check
    check (approval_status is distinct from 'approved'
           or (approved_by is not null and approved_at is not null)),
  constraint refunds_metadata_check
    check (jsonb_typeof(metadata) = 'object')
);

comment on table public.refunds is
  'Money returned to a client, tied to the payment it reverses.';
comment on column public.refunds.requires_approval is
  'Set when the amount passes the four eyes threshold of the company.';

create unique index refunds_number_unique
  on public.refunds (company_id, refund_number)
  where refund_number is not null and deleted_at is null;

create unique index refunds_provider_reference_unique
  on public.refunds (provider, provider_refund_reference)
  where provider_refund_reference is not null and deleted_at is null;

create index refunds_payment_idx
  on public.refunds (payment_id)
  where deleted_at is null;

create index refunds_company_idx
  on public.refunds (company_id, status, created_at desc)
  where deleted_at is null;

create index refunds_pending_approval_idx
  on public.refunds (company_id)
  where deleted_at is null and requires_approval and approval_status = 'pending';

-- Records a refund and keeps the payment and the invoice in step.
create or replace function public.record_refund(
  p_payment_id uuid,
  p_amount numeric,
  p_reason text,
  p_provider_reference text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_refund_id uuid;
  v_available numeric;
  v_threshold numeric;
  v_requires_approval boolean := false;
begin
  select * into v_payment
    from public.payments
   where id = p_payment_id
     and deleted_at is null
     for update;

  if not found then
    raise exception 'Payment % was not found', p_payment_id using errcode = 'P0002';
  end if;

  if not public.can_write_company_data(v_payment.company_id) then
    raise exception 'You are not allowed to refund payments in this company'
      using errcode = '42501';
  end if;

  if v_payment.status not in ('succeeded', 'partially_refunded') then
    raise exception 'Only a settled payment can be refunded' using errcode = '42501';
  end if;

  v_available := v_payment.amount - v_payment.refunded_amount;

  if p_amount is null or p_amount <= 0 or p_amount > v_available + 0.0001 then
    raise exception 'The refund amount must be between 0 and %', v_available
      using errcode = '22023';
  end if;

  select (settings -> 'payments' ->> 'refund_approval_threshold')::numeric
    into v_threshold
    from public.companies
   where id = v_payment.company_id;

  if v_threshold is not null and p_amount >= v_threshold then
    v_requires_approval := true;
  end if;

  insert into public.refunds (
    company_id, payment_id, client_id, amount, amount_minor, currency, reason,
    is_partial, provider, provider_refund_reference, status, requires_approval,
    approval_status, requested_by
  )
  values (
    v_payment.company_id, p_payment_id, v_payment.client_id, p_amount,
    public.to_minor_units(p_amount, v_payment.currency_exponent), v_payment.currency,
    p_reason, p_amount < v_payment.amount, v_payment.provider, p_provider_reference,
    case when v_requires_approval
         then 'requested'::public.refund_status
         else 'succeeded'::public.refund_status
    end,
    v_requires_approval,
    case when v_requires_approval then 'pending'::public.approval_status else null end,
    public.current_user_id()
  )
  returning id into v_refund_id;

  if not v_requires_approval then
    perform public.settle_refund(v_refund_id);
  end if;

  return v_refund_id;
end;
$$;

comment on function public.record_refund(uuid, numeric, text, text) is
  'Creates a refund, requesting approval when it passes the company threshold.';

-- Applies an approved or automatic refund to the payment and the invoice.
create or replace function public.settle_refund(p_refund_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_refund public.refunds%rowtype;
  v_payment public.payments%rowtype;
  v_allocation record;
  v_remaining numeric;
begin
  select * into v_refund from public.refunds where id = p_refund_id for update;

  if not found then
    raise exception 'Refund % was not found', p_refund_id using errcode = 'P0002';
  end if;

  if v_refund.settled_at is not null then
    return;
  end if;

  select * into v_payment from public.payments where id = v_refund.payment_id for update;

  -- The allocations are unwound first, newest first, so the invoices show the
  -- money as outstanding again before the payment itself is adjusted.
  v_remaining := v_refund.amount;

  for v_allocation in
    select *
      from public.payment_allocations
     where payment_id = v_refund.payment_id
       and reversed_at is null
     order by allocated_at desc
  loop
    exit when v_remaining <= 0;

    if v_allocation.amount <= v_remaining then
      update public.payment_allocations
         set reversed_at = now(),
             reversal_reason = 'Refunded',
             updated_at = now()
       where id = v_allocation.id;

      update public.invoices
         set paid_amount = greatest(paid_amount - v_allocation.amount, 0),
             updated_at = now()
       where id = v_allocation.invoice_id;

      v_remaining := v_remaining - v_allocation.amount;
    else
      update public.payment_allocations
         set amount = amount - v_remaining,
             updated_at = now()
       where id = v_allocation.id;

      update public.invoices
         set paid_amount = greatest(paid_amount - v_remaining, 0),
             updated_at = now()
       where id = v_allocation.invoice_id;

      v_remaining := 0;
    end if;

    perform public.refresh_invoice_settlement(v_allocation.invoice_id);
  end loop;

  update public.payments
     set allocated_amount = coalesce((
           select sum(amount)
             from public.payment_allocations
            where payment_id = v_refund.payment_id
              and reversed_at is null
         ), 0),
         refunded_amount = refunded_amount + v_refund.amount,
         status = case
                    when refunded_amount + v_refund.amount >= amount - 0.0001
                      then 'refunded'::public.payment_status
                    else 'partially_refunded'::public.payment_status
                  end,
         updated_at = now()
   where id = v_refund.payment_id;

  update public.refunds
     set status = 'succeeded',
         processed_at = coalesce(processed_at, now()),
         settled_at = now(),
         updated_at = now()
   where id = p_refund_id;
end;
$$;

comment on function public.settle_refund(uuid) is
  'Applies a refund to the payment and reopens the invoices it had settled.';

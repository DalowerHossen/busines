-- supabase/migrations/00094_create_purchase_orders.sql
-- Purchase orders and what actually arrived.
--
-- An order is a promise to buy; a receipt is what turned up. Keeping them
-- apart is what lets a business see the difference, chase a short delivery and
-- refuse a bill for goods it never received.

create table public.purchase_orders (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  vendor_id uuid not null,

  order_number text not null,
  status public.purchase_order_status not null default 'draft',

  order_date date not null default current_date,
  expected_date date,
  delivery_address text,

  currency char(3) not null default 'USD',
  subtotal_amount numeric(18, 4) not null default 0,
  tax_amount numeric(18, 4) not null default 0,
  shipping_amount numeric(18, 4) not null default 0,
  total_amount numeric(18, 4) not null default 0,

  received_value numeric(18, 4) not null default 0,
  billed_value numeric(18, 4) not null default 0,

  notes text,
  terms text,

  sent_at timestamptz,
  confirmed_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint purchase_orders_number_check
    check (order_number ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{1,31}$'),
  constraint purchase_orders_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint purchase_orders_amounts_check
    check (subtotal_amount >= 0 and tax_amount >= 0 and shipping_amount >= 0
           and total_amount >= 0 and received_value >= 0 and billed_value >= 0),
  constraint purchase_orders_expected_check
    check (expected_date is null or expected_date >= order_date),
  constraint purchase_orders_cancelled_check
    check (status <> 'cancelled' or cancellation_reason is not null)
);

comment on table public.purchase_orders is
  'What a tenant ordered from a supplier, and how far along the order is.';

create unique index purchase_orders_number_unique
  on public.purchase_orders (company_id, order_number)
  where deleted_at is null;

create index purchase_orders_vendor_idx
  on public.purchase_orders (vendor_id, order_date desc)
  where deleted_at is null;

create index purchase_orders_open_idx
  on public.purchase_orders (company_id, expected_date)
  where deleted_at is null
    and status in ('sent', 'confirmed', 'partially_received');

-- -----------------------------------------------------------------------------
-- Order lines
-- -----------------------------------------------------------------------------

create table public.purchase_order_items (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  purchase_order_id uuid not null,
  product_id uuid,

  line_number smallint not null default 1,
  description text not null,
  sku text,

  quantity numeric(18, 4) not null default 1,
  unit_price numeric(18, 4) not null default 0,
  tax_rate_id uuid,
  tax_amount numeric(18, 4) not null default 0,
  line_total numeric(18, 4) not null default 0,

  quantity_received numeric(18, 4) not null default 0,
  quantity_billed numeric(18, 4) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_order_items_description_check
    check (length(btrim(description)) between 1 and 300),
  constraint purchase_order_items_quantity_check
    check (quantity > 0 and quantity_received >= 0 and quantity_billed >= 0),
  constraint purchase_order_items_received_check
    check (quantity_received <= quantity),
  constraint purchase_order_items_price_check
    check (unit_price >= 0 and tax_amount >= 0 and line_total >= 0)
);

comment on table public.purchase_order_items is
  'One ordered item, with how much of it has arrived and been billed.';

create unique index purchase_order_items_line_unique
  on public.purchase_order_items (purchase_order_id, line_number);

create index purchase_order_items_order_idx
  on public.purchase_order_items (purchase_order_id);

-- -----------------------------------------------------------------------------
-- Receipts
-- -----------------------------------------------------------------------------

create table public.purchase_receipts (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  purchase_order_id uuid not null,

  received_date date not null default current_date,
  reference text,
  received_by uuid,
  notes text,
  -- Set when part of the delivery was refused.
  has_discrepancy boolean not null default false,
  discrepancy_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_receipts_discrepancy_check
    check (not has_discrepancy or discrepancy_note is not null)
);

comment on table public.purchase_receipts is
  'One delivery against a purchase order, including what was refused.';

create index purchase_receipts_order_idx
  on public.purchase_receipts (purchase_order_id, received_date desc);

create table public.purchase_receipt_items (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  receipt_id uuid not null,
  purchase_order_item_id uuid not null,

  quantity_received numeric(18, 4) not null,
  quantity_rejected numeric(18, 4) not null default 0,
  rejection_reason text,

  created_at timestamptz not null default now(),

  constraint purchase_receipt_items_quantity_check
    check (quantity_received > 0 and quantity_rejected >= 0),
  constraint purchase_receipt_items_rejection_check
    check (quantity_rejected = 0 or rejection_reason is not null)
);

comment on table public.purchase_receipt_items is
  'How much of one ordered line arrived in one delivery.';

create index purchase_receipt_items_receipt_idx
  on public.purchase_receipt_items (receipt_id);

create index purchase_receipt_items_line_idx
  on public.purchase_receipt_items (purchase_order_item_id);

-- -----------------------------------------------------------------------------
-- Totals and progress
-- -----------------------------------------------------------------------------

-- Recalculates the money on an order from its lines.
create or replace function public.recalculate_purchase_order_totals(
  p_purchase_order_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_subtotal numeric;
  v_tax numeric;
  v_received numeric;
  v_billed numeric;
begin
  select coalesce(sum(round(quantity * unit_price, 4)), 0),
         coalesce(sum(tax_amount), 0),
         coalesce(sum(round(quantity_received * unit_price, 4)), 0),
         coalesce(sum(round(quantity_billed * unit_price, 4)), 0)
    into v_subtotal, v_tax, v_received, v_billed
    from public.purchase_order_items
   where purchase_order_id = p_purchase_order_id;

  update public.purchase_orders
     set subtotal_amount = v_subtotal,
         tax_amount = v_tax,
         total_amount = v_subtotal + v_tax + shipping_amount,
         received_value = v_received,
         billed_value = v_billed,
         updated_at = now()
   where id = p_purchase_order_id;
end;
$$;

comment on function public.recalculate_purchase_order_totals(uuid) is
  'Rebuilds the totals of a purchase order from its lines.';

-- Records a delivery and moves the order along.
create or replace function public.receive_purchase_order(
  p_purchase_order_id uuid,
  p_lines jsonb,
  p_received_date date default current_date,
  p_reference text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_receipt_id uuid;
  v_line jsonb;
  v_item public.purchase_order_items%rowtype;
  v_quantity numeric;
  v_outstanding numeric;
  v_fully_received boolean;
begin
  select * into v_order
    from public.purchase_orders
   where id = p_purchase_order_id and deleted_at is null for update;

  if not found then
    raise exception 'Purchase order % was not found', p_purchase_order_id
      using errcode = 'P0002';
  end if;

  if v_order.status in ('cancelled', 'received', 'billed') then
    raise exception 'This order is closed and cannot receive more goods'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Please say what was delivered' using errcode = '22023';
  end if;

  insert into public.purchase_receipts (
    company_id, purchase_order_id, received_date, reference, received_by
  )
  values (
    v_order.company_id, p_purchase_order_id, p_received_date, p_reference,
    public.current_user_id()
  )
  returning id into v_receipt_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    select * into v_item
      from public.purchase_order_items
     where id = (v_line ->> 'purchase_order_item_id')::uuid
       and purchase_order_id = p_purchase_order_id
       for update;

    if not found then
      raise exception 'A delivered line does not belong to this order'
        using errcode = '22023';
    end if;

    v_quantity := round(coalesce((v_line ->> 'quantity_received')::numeric, 0), 4);
    v_outstanding := v_item.quantity - v_item.quantity_received;

    if v_quantity <= 0 then
      raise exception 'A delivered quantity must be greater than zero'
        using errcode = '22023';
    end if;

    if v_quantity > v_outstanding then
      raise exception 'More was delivered than ordered on line %: % against %',
        v_item.line_number, v_quantity, v_outstanding using errcode = '22023';
    end if;

    insert into public.purchase_receipt_items (
      company_id, receipt_id, purchase_order_item_id, quantity_received,
      quantity_rejected, rejection_reason
    )
    values (
      v_order.company_id, v_receipt_id, v_item.id, v_quantity,
      round(coalesce((v_line ->> 'quantity_rejected')::numeric, 0), 4),
      v_line ->> 'rejection_reason'
    );

    update public.purchase_order_items
       set quantity_received = quantity_received + v_quantity,
           updated_at = now()
     where id = v_item.id;
  end loop;

  perform public.recalculate_purchase_order_totals(p_purchase_order_id);

  select bool_and(quantity_received >= quantity)
    into v_fully_received
    from public.purchase_order_items
   where purchase_order_id = p_purchase_order_id;

  update public.purchase_orders
     set status = case when coalesce(v_fully_received, false)
                       then 'received'::public.purchase_order_status
                       else 'partially_received'::public.purchase_order_status
                  end,
         closed_at = case when coalesce(v_fully_received, false) then now() else null end,
         updated_at = now()
   where id = p_purchase_order_id;

  return v_receipt_id;
end;
$$;

comment on function public.receive_purchase_order(uuid, jsonb, date, text) is
  'Records a delivery against an order and refuses more than was ordered.';

-- Allocates the order number from the tenant sequence.
create or replace function public.assign_purchase_order_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.order_number is not null and length(btrim(new.order_number)) > 0 then
    return new;
  end if;

  new.order_number := public.next_document_number(
    new.company_id, 'purchase_order', 'PO-', 4::smallint, 'yearly', null,
    new.order_date
  );

  return new;
end;
$$;

comment on function public.assign_purchase_order_number() is
  'Gives a new purchase order the next number in its tenant sequence.';

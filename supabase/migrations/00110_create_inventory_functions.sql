-- supabase/migrations/00110_create_inventory_functions.sql
-- Moving stock, valuing it, and telling the ledger about it.
--
-- Weighted average costing is used because it is the method a small business
-- and its accountant can both follow: the cost of what is on hand changes
-- only when stock is bought, never when it is sold.

-- Returns the warehouse a movement should default to.
create or replace function public.default_warehouse_id(p_company_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id
    from public.warehouses
   where company_id = p_company_id
     and deleted_at is null
     and is_active
   order by is_default desc, created_at
   limit 1;
$$;

comment on function public.default_warehouse_id(uuid) is
  'Returns the warehouse to use when a movement does not name one.';

-- Records one movement and brings the cached level with it.
create or replace function public.record_stock_movement(
  p_product_id uuid,
  p_movement_type public.stock_movement_type,
  p_quantity numeric,
  p_unit_cost numeric default null,
  p_warehouse_id uuid default null,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_reference_label text default null,
  p_movement_date date default current_date,
  p_notes text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_warehouse_id uuid;
  v_level public.stock_levels%rowtype;
  v_direction integer;
  v_signed numeric;
  v_unit_cost numeric;
  v_new_quantity numeric;
  v_new_average numeric;
  v_movement_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'A stock movement must move a positive quantity'
      using errcode = '22023';
  end if;

  select * into v_product
    from public.products
   where id = p_product_id and deleted_at is null;

  if not found then
    raise exception 'Product % was not found', p_product_id using errcode = 'P0002';
  end if;

  if not v_product.track_inventory then
    raise exception 'Stock is not tracked for %', v_product.name
      using errcode = '22023';
  end if;

  if not (public.is_service_role()
          or public.can_write_company_data(v_product.company_id)) then
    raise exception 'You do not have permission to move stock'
      using errcode = '42501';
  end if;

  v_warehouse_id := coalesce(
    p_warehouse_id,
    public.default_warehouse_id(v_product.company_id)
  );

  if v_warehouse_id is null then
    raise exception 'Create a warehouse before moving stock' using errcode = '22023';
  end if;

  v_direction := case p_movement_type
    when 'opening_balance' then 1
    when 'purchase' then 1
    when 'sales_return' then 1
    when 'transfer_in' then 1
    when 'adjustment_increase' then 1
    else -1
  end;

  v_signed := v_direction * p_quantity;

  select * into v_level
    from public.stock_levels
   where product_id = p_product_id and warehouse_id = v_warehouse_id
     for update;

  if not found then
    insert into public.stock_levels (company_id, product_id, warehouse_id)
    values (v_product.company_id, p_product_id, v_warehouse_id)
    returning * into v_level;
  end if;

  v_new_quantity := v_level.quantity_on_hand + v_signed;

  if v_new_quantity < 0 then
    raise exception
      'There is not enough stock of %: % on hand against % requested',
      v_product.name, v_level.quantity_on_hand, p_quantity
      using errcode = '22023';
  end if;

  -- Stock coming in may change the average cost; stock going out leaves the
  -- average alone and is valued at it.
  if v_direction = 1 then
    v_unit_cost := coalesce(p_unit_cost, v_level.average_cost, v_product.cost_price, 0);
    if v_new_quantity = 0 then
      v_new_average := v_level.average_cost;
    else
      v_new_average := round(
        (v_level.quantity_on_hand * v_level.average_cost
         + p_quantity * v_unit_cost) / v_new_quantity,
        4
      );
    end if;
  else
    v_unit_cost := coalesce(p_unit_cost, v_level.average_cost, 0);
    v_new_average := v_level.average_cost;
  end if;

  insert into public.stock_movements (
    company_id, product_id, warehouse_id, movement_type, quantity, unit_cost,
    total_cost, quantity_after, movement_date, reference_type, reference_id,
    reference_label, notes, transfer_group_id, created_by
  )
  values (
    v_product.company_id, p_product_id, v_warehouse_id, p_movement_type,
    v_signed, v_unit_cost, round(p_quantity * v_unit_cost, 4), v_new_quantity,
    p_movement_date, p_reference_type, p_reference_id, p_reference_label,
    p_notes,
    -- The two halves of a transfer are written with the same group, because
    -- the history itself can never be edited afterwards.
    case when p_reference_type = 'transfer' then p_reference_id end,
    public.current_user_id()
  )
  returning id into v_movement_id;

  update public.stock_levels
     set quantity_on_hand = v_new_quantity,
         average_cost = v_new_average,
         stock_value = round(v_new_quantity * v_new_average, 4),
         last_movement_at = now(),
         updated_at = now()
   where id = v_level.id;

  return v_movement_id;
end;
$$;

comment on function public.record_stock_movement(
  uuid, public.stock_movement_type, numeric, numeric, uuid, text, uuid, text,
  date, text
) is 'Records one stock movement and updates the quantity and average cost.';

-- Moves stock between two warehouses as a matched pair of movements.
create or replace function public.transfer_stock(
  p_product_id uuid,
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_quantity numeric,
  p_notes text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_group_id uuid := public.generate_uuid_v7();
  v_out_id uuid;
  v_in_id uuid;
  v_unit_cost numeric;
begin
  if p_from_warehouse_id = p_to_warehouse_id then
    raise exception 'Stock cannot be transferred to the same warehouse'
      using errcode = '22023';
  end if;

  select average_cost into v_unit_cost
    from public.stock_levels
   where product_id = p_product_id and warehouse_id = p_from_warehouse_id;

  v_out_id := public.record_stock_movement(
    p_product_id, 'transfer_out', p_quantity, v_unit_cost, p_from_warehouse_id,
    'transfer', v_group_id, null, current_date, p_notes
  );

  v_in_id := public.record_stock_movement(
    p_product_id, 'transfer_in', p_quantity, v_unit_cost, p_to_warehouse_id,
    'transfer', v_group_id, null, current_date, p_notes
  );

  if v_out_id is null or v_in_id is null then
    raise exception 'The transfer could not be recorded' using errcode = '22023';
  end if;

  return v_group_id;
end;
$$;

comment on function public.transfer_stock(uuid, uuid, uuid, numeric, text) is
  'Moves stock between warehouses as one matched pair of movements.';

-- Takes the goods on an issued invoice out of stock, once.
create or replace function public.release_invoice_stock(p_invoice_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_item record;
  v_count integer := 0;
begin
  select * into v_invoice
    from public.invoices
   where id = p_invoice_id and deleted_at is null;

  if not found or v_invoice.status in ('draft', 'cancelled') then
    return 0;
  end if;

  if exists (
    select 1 from public.stock_movements
     where reference_type = 'invoice' and reference_id = p_invoice_id
  ) then
    return 0;
  end if;

  for v_item in
    select i.product_id, i.quantity, i.description
      from public.invoice_items as i
      join public.products as p on p.id = i.product_id
     where i.invoice_id = p_invoice_id
       and i.deleted_at is null
       and p.track_inventory
  loop
    perform public.record_stock_movement(
      v_item.product_id, 'sale', v_item.quantity, null, null,
      'invoice', p_invoice_id, v_invoice.invoice_number, v_invoice.issue_date,
      v_item.description
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.release_invoice_stock(uuid) is
  'Takes the goods sold on an issued invoice out of stock, once per invoice.';

-- Brings a delivery into stock at the price that was paid for it.
create or replace function public.receive_stock_from_purchase(p_receipt_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt public.purchase_receipts%rowtype;
  v_line record;
  v_count integer := 0;
begin
  select * into v_receipt
    from public.purchase_receipts
   where id = p_receipt_id;

  if not found then
    return 0;
  end if;

  if exists (
    select 1 from public.stock_movements
     where reference_type = 'purchase_receipt' and reference_id = p_receipt_id
  ) then
    return 0;
  end if;

  for v_line in
    select ri.quantity_received, oi.product_id, oi.unit_price, oi.description
      from public.purchase_receipt_items as ri
      join public.purchase_order_items as oi
        on oi.id = ri.purchase_order_item_id
      join public.products as p on p.id = oi.product_id
     where ri.receipt_id = p_receipt_id
       and p.track_inventory
       and ri.quantity_received > 0
  loop
    perform public.record_stock_movement(
      v_line.product_id, 'purchase', v_line.quantity_received, v_line.unit_price,
      v_receipt.warehouse_id, 'purchase_receipt', p_receipt_id, null,
      v_receipt.received_date, v_line.description
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.receive_stock_from_purchase(uuid) is
  'Brings a delivery into stock at the purchase price, once per receipt.';

-- Posts the cost of the goods sold on an invoice to the ledger.
create or replace function public.post_cost_of_goods_sold(p_invoice_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_cost numeric;
  v_cogs uuid;
  v_inventory uuid;
begin
  select * into v_invoice
    from public.invoices
   where id = p_invoice_id and deleted_at is null;

  if not found then
    return null;
  end if;

  if exists (
    select 1 from public.journal_entries
     where source_type = 'stock_movement'
       and source_id = p_invoice_id
       and status = 'posted'
       and deleted_at is null
  ) then
    return null;
  end if;

  select round(coalesce(sum(total_cost), 0), 4)
    into v_cost
    from public.stock_movements
   where reference_type = 'invoice' and reference_id = p_invoice_id;

  if coalesce(v_cost, 0) = 0 then
    return null;
  end if;

  v_cogs := public.system_account_id(v_invoice.company_id, 'cost_of_goods_sold');
  v_inventory := public.system_account_id(v_invoice.company_id, 'inventory');

  if v_cogs is null or v_inventory is null then
    return null;
  end if;

  return public.post_journal_entry(
    v_invoice.company_id,
    jsonb_build_array(
      jsonb_build_object(
        'account_id', v_cogs, 'debit', v_cost, 'credit', 0,
        'description', 'Cost of goods on ' || coalesce(v_invoice.invoice_number, 'invoice')
      ),
      jsonb_build_object(
        'account_id', v_inventory, 'debit', 0, 'credit', v_cost,
        'description', 'Stock released on ' || coalesce(v_invoice.invoice_number, 'invoice')
      )
    ),
    'Cost of goods sold',
    v_invoice.issue_date,
    'stock_movement',
    p_invoice_id,
    v_invoice.invoice_number
  );
end;
$$;

comment on function public.post_cost_of_goods_sold(uuid) is
  'Moves the cost of the stock sold on an invoice from inventory to expense.';

-- Settles a stock take by writing the differences as adjustments.
create or replace function public.apply_stock_count(p_stock_count_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count public.stock_counts%rowtype;
  v_item record;
  v_applied integer := 0;
  v_value numeric := 0;
begin
  select * into v_count
    from public.stock_counts
   where id = p_stock_count_id and deleted_at is null for update;

  if not found then
    raise exception 'Stock take % was not found', p_stock_count_id
      using errcode = 'P0002';
  end if;

  if v_count.status <> 'in_progress' then
    raise exception 'This stock take has already been settled'
      using errcode = '22023';
  end if;

  if not (public.is_service_role()
          or public.can_write_company_data(v_count.company_id)) then
    raise exception 'You do not have permission to settle a stock take'
      using errcode = '42501';
  end if;

  for v_item in
    select * from public.stock_count_items
     where stock_count_id = p_stock_count_id
       and difference_quantity <> 0
  loop
    perform public.record_stock_movement(
      v_item.product_id,
      case
        when v_item.difference_quantity > 0 then 'adjustment_increase'
        else 'adjustment_decrease'
      end::public.stock_movement_type,
      abs(v_item.difference_quantity),
      nullif(v_item.unit_cost, 0),
      v_count.warehouse_id,
      'stock_count',
      p_stock_count_id,
      v_count.reference,
      v_count.counted_on,
      v_item.notes
    );

    v_value := v_value + abs(v_item.difference_quantity) * v_item.unit_cost;
    v_applied := v_applied + 1;
  end loop;

  update public.stock_counts
     set status = 'completed',
         completed_at = now(),
         completed_by = public.current_user_id(),
         discrepancy_value = round(v_value, 4),
         updated_at = now()
   where id = p_stock_count_id;

  return v_applied;
end;
$$;

comment on function public.apply_stock_count(uuid) is
  'Turns the differences found on a stock take into adjustment movements.';

-- What needs reordering, and how much it would cost to do it.
create or replace function public.low_stock_report(p_company_id uuid)
returns table (
  product_id uuid,
  product_name text,
  warehouse_name text,
  quantity_available numeric,
  reorder_point numeric,
  reorder_quantity numeric,
  estimated_cost numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id,
         p.name,
         w.name,
         l.quantity_available,
         l.reorder_point,
         coalesce(l.reorder_quantity, 0),
         round(coalesce(l.reorder_quantity, 0) * l.average_cost, 4)
    from public.stock_levels as l
    join public.products as p on p.id = l.product_id
    join public.warehouses as w on w.id = l.warehouse_id
   where l.company_id = p_company_id
     and l.reorder_point is not null
     and l.quantity_available <= l.reorder_point
     and p.deleted_at is null
     and w.deleted_at is null
   order by p.name;
$$;

comment on function public.low_stock_report(uuid) is
  'Lists the products that have fallen to or below their reorder point.';

-- The value of everything on hand, which the balance sheet should agree with.
create or replace function public.inventory_valuation(p_company_id uuid)
returns table (
  product_id uuid,
  product_name text,
  quantity_on_hand numeric,
  average_cost numeric,
  stock_value numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id,
         p.name,
         round(sum(l.quantity_on_hand), 3),
         round(
           case
             when sum(l.quantity_on_hand) = 0 then 0
             else sum(l.stock_value) / sum(l.quantity_on_hand)
           end,
           4
         ),
         round(sum(l.stock_value), 4)
    from public.stock_levels as l
    join public.products as p on p.id = l.product_id
   where l.company_id = p_company_id
     and p.deleted_at is null
   group by p.id, p.name
  having sum(l.quantity_on_hand) <> 0
   order by p.name;
$$;

comment on function public.inventory_valuation(uuid) is
  'Values the stock on hand per product across every warehouse.';

-- supabase/migrations/00041_create_invoice_calculations.sql
-- The arithmetic of a document.
--
-- Every amount on an invoice is derived here, in one place, so the screen, the
-- PDF, the payment request and the reports can never disagree. The engine
-- honours the tax mode (exclusive, inclusive or none), the discount stage
-- (before or after tax), compound rates and the rounding mode of the company.

-- Recomputes one line and stores the derived amounts on it.
create or replace function public.calculate_invoice_item_amounts()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_tax_mode public.tax_mode;
  v_scale smallint;
  v_mode public.rounding_mode;
  v_gross numeric;
  v_net numeric;
begin
  select i.tax_mode, i.decimal_scale, i.rounding_mode
    into v_tax_mode, v_scale, v_mode
    from public.invoices as i
   where i.id = new.invoice_id;

  if v_tax_mode is null then
    raise exception 'Invoice % was not found', new.invoice_id
      using errcode = 'P0002';
  end if;

  if new.line_type = 'text' then
    new.discount_amount := 0;
    new.tax_amount := 0;
    new.line_subtotal := 0;
    new.line_total := 0;
    return new;
  end if;

  v_gross := new.quantity * new.unit_price;

  if new.discount_type is null or new.discount_value = 0 then
    new.discount_amount := 0;
  else
    new.discount_amount := public.calculate_discount_amount(
      v_gross, new.discount_value, new.discount_type
    );
  end if;

  v_net := v_gross - new.discount_amount;

  if not new.is_taxable or v_tax_mode = 'none' or new.tax_percentage = 0 then
    new.tax_amount := 0;
    new.line_subtotal := public.round_money(v_net, v_scale, v_mode);
    new.line_total := new.line_subtotal;
    return new;
  end if;

  if v_tax_mode = 'inclusive' then
    -- The entered price already contains the tax, so the net is extracted.
    new.tax_amount := public.calculate_tax_amount(v_net, new.tax_percentage, 'inclusive');
    new.line_subtotal := public.round_money(v_net - new.tax_amount, v_scale, v_mode);
    new.line_total := public.round_money(v_net, v_scale, v_mode);
  else
    new.tax_amount := public.calculate_tax_amount(v_net, new.tax_percentage, 'exclusive');
    new.line_subtotal := public.round_money(v_net, v_scale, v_mode);
    new.line_total := public.round_money(v_net + new.tax_amount, v_scale, v_mode);
  end if;

  new.tax_amount := public.round_money(new.tax_amount, v_scale, v_mode);

  return new;
end;
$$;

comment on function public.calculate_invoice_item_amounts() is
  'Derives the discount, tax and totals of a single invoice line.';

create trigger invoice_items_30_calculate_amounts
  before insert or update of quantity, unit_price, discount_type, discount_value,
    tax_percentage, is_taxable, line_type on public.invoice_items
  for each row execute function public.calculate_invoice_item_amounts();

-- Rebuilds the totals and the tax summary of a whole document.
create or replace function public.recalculate_invoice_totals(p_invoice_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_subtotal numeric := 0;
  v_line_discounts numeric := 0;
  v_document_discount numeric := 0;
  v_tax_total numeric := 0;
  v_taxable numeric := 0;
  v_shipping_tax numeric := 0;
  v_discount_ratio numeric := 1;
  v_total numeric;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id;

  if not found then
    raise exception 'Invoice % was not found', p_invoice_id
      using errcode = 'P0002';
  end if;

  select coalesce(sum(line_subtotal), 0),
         coalesce(sum(discount_amount), 0),
         coalesce(sum(tax_amount), 0),
         coalesce(sum(case when is_taxable and tax_percentage > 0 then line_subtotal else 0 end), 0)
    into v_subtotal, v_line_discounts, v_tax_total, v_taxable
    from public.invoice_items
   where invoice_id = p_invoice_id
     and deleted_at is null;

  -- Document level discount, applied to the net of the lines.
  if v_invoice.discount_type is not null and v_invoice.discount_value > 0 then
    v_document_discount := public.calculate_discount_amount(
      v_subtotal, v_invoice.discount_value, v_invoice.discount_type
    );
  end if;

  v_document_discount := public.round_money(
    v_document_discount, v_invoice.decimal_scale, v_invoice.rounding_mode
  );

  -- A discount taken before tax reduces the taxable base proportionally.
  if v_document_discount > 0 and v_subtotal > 0
     and v_invoice.discount_stage = 'before_tax' then
    v_discount_ratio := (v_subtotal - v_document_discount) / v_subtotal;
    v_tax_total := public.round_money(
      v_tax_total * v_discount_ratio, v_invoice.decimal_scale, v_invoice.rounding_mode
    );
    v_taxable := public.round_money(
      v_taxable * v_discount_ratio, v_invoice.decimal_scale, v_invoice.rounding_mode
    );
  end if;

  -- Shipping is taxed at its own rate when one is selected.
  if v_invoice.shipping_amount > 0 and v_invoice.shipping_tax_rate_id is not null
     and v_invoice.tax_mode <> 'none' then
    select public.calculate_tax_amount(
             v_invoice.shipping_amount, r.rate_percentage, v_invoice.tax_mode
           )
      into v_shipping_tax
      from public.tax_rates as r
     where r.id = v_invoice.shipping_tax_rate_id;

    v_shipping_tax := public.round_money(
      coalesce(v_shipping_tax, 0), v_invoice.decimal_scale, v_invoice.rounding_mode
    );
    v_tax_total := v_tax_total + v_shipping_tax;
  end if;

  -- A reverse charged document shows the tax as zero and states the reason.
  if v_invoice.applies_reverse_charge then
    v_tax_total := 0;
  end if;

  v_total := v_subtotal - v_document_discount + v_invoice.shipping_amount;

  if v_invoice.tax_mode <> 'inclusive' then
    v_total := v_total + v_tax_total;
  end if;

  v_total := public.round_money(v_total, v_invoice.decimal_scale, v_invoice.rounding_mode);

  update public.invoices
     set subtotal_amount = public.round_money(
           v_subtotal, v_invoice.decimal_scale, v_invoice.rounding_mode
         ),
         line_discount_amount = public.round_money(
           v_line_discounts, v_invoice.decimal_scale, v_invoice.rounding_mode
         ),
         document_discount_amount = v_document_discount,
         taxable_amount = v_taxable,
         tax_amount = v_tax_total,
         total_amount = v_total,
         total_amount_minor = public.to_minor_units(v_total, v_invoice.currency_exponent),
         total_in_base_currency = public.round_money(
           v_total * v_invoice.exchange_rate, v_invoice.decimal_scale, v_invoice.rounding_mode
         ),
         updated_at = now()
   where id = p_invoice_id;

  -- Rebuild the printed tax summary.
  delete from public.invoice_taxes where invoice_id = p_invoice_id;

  if not v_invoice.applies_reverse_charge and v_invoice.tax_mode <> 'none' then
    insert into public.invoice_taxes (
      company_id, invoice_id, tax_rate_id, tax_name, tax_percentage,
      is_compound, taxable_amount, tax_amount, display_order
    )
    select v_invoice.company_id,
           p_invoice_id,
           (array_agg(item.tax_rate_id order by item.tax_rate_id))[1],
           coalesce(item.tax_name_snapshot, 'Tax'),
           item.tax_percentage,
           bool_or(item.is_tax_compound),
           public.round_money(
             sum(item.line_subtotal) * v_discount_ratio,
             v_invoice.decimal_scale, v_invoice.rounding_mode
           ),
           public.round_money(
             sum(item.tax_amount) * v_discount_ratio,
             v_invoice.decimal_scale, v_invoice.rounding_mode
           ),
           row_number() over (order by item.tax_percentage desc)
      from public.invoice_items as item
     where item.invoice_id = p_invoice_id
       and item.deleted_at is null
       and item.is_taxable
       and item.tax_percentage > 0
     group by coalesce(item.tax_name_snapshot, 'Tax'), item.tax_percentage;
  end if;
end;
$$;

comment on function public.recalculate_invoice_totals(uuid) is
  'Rebuilds the totals and the printed tax summary of an invoice from its lines.';

-- Keeps the document in step whenever a line changes.
create or replace function public.refresh_invoice_totals_from_item()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_invoice_totals(old.invoice_id);
    return old;
  end if;

  perform public.recalculate_invoice_totals(new.invoice_id);
  return new;
end;
$$;

comment on function public.refresh_invoice_totals_from_item() is
  'Trigger function that recalculates a document after one of its lines changes.';

create trigger invoice_items_refresh_totals
  after insert or update or delete on public.invoice_items
  for each row execute function public.refresh_invoice_totals_from_item();

-- Keeps the document in step when the header itself changes.
create or replace function public.refresh_invoice_totals_from_header()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform public.recalculate_invoice_totals(new.id);
  return new;
end;
$$;

comment on function public.refresh_invoice_totals_from_header() is
  'Trigger function that recalculates a document after its header changes.';

create trigger invoices_refresh_totals
  after update of discount_type, discount_value, discount_stage, shipping_amount,
    shipping_tax_rate_id, tax_mode, exchange_rate, applies_reverse_charge,
    decimal_scale, rounding_mode, currency_exponent on public.invoices
  for each row execute function public.refresh_invoice_totals_from_header();

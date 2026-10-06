-- supabase/migrations/00042_create_invoice_lifecycle.sql
-- Issuing, locking, revising and settling an invoice.
--
-- The rule the whole module is built around: a draft may change freely, an
-- issued document may not. Issuing assigns the number, freezes the business
-- identity and the client details, and locks the row. After that a mistake is
-- corrected with a credit note or a formal revision, both of which leave the
-- original intact.

-- Blocks edits to an issued document, except for the columns that describe
-- what happened to it afterwards.
create or replace function public.guard_locked_invoice()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not old.is_locked then
    return new;
  end if;

  if new.company_id is distinct from old.company_id
     or new.client_id is distinct from old.client_id
     or new.invoice_number is distinct from old.invoice_number
     or new.issue_date is distinct from old.issue_date
     or new.supply_date is distinct from old.supply_date
     or new.currency is distinct from old.currency
     or new.exchange_rate is distinct from old.exchange_rate
     or new.tax_mode is distinct from old.tax_mode
     or new.discount_stage is distinct from old.discount_stage
     or new.discount_type is distinct from old.discount_type
     or new.discount_value is distinct from old.discount_value
     or new.shipping_amount is distinct from old.shipping_amount
     or new.subtotal_amount is distinct from old.subtotal_amount
     or new.tax_amount is distinct from old.tax_amount
     or new.total_amount is distinct from old.total_amount
     or new.bill_to is distinct from old.bill_to
     or new.company_profile_snapshot_id is distinct from old.company_profile_snapshot_id
  then
    raise exception
      'Invoice % is issued and cannot be edited. Use a credit note or a revision.',
      coalesce(old.invoice_number, old.id::text)
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_locked_invoice() is
  'Keeps the printed content of an issued invoice unchanged.';

create trigger invoices_guard_locked
  before update on public.invoices
  for each row execute function public.guard_locked_invoice();

-- Lines of an issued document are frozen as well.
create or replace function public.guard_locked_invoice_items()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_locked boolean;
  v_invoice_id uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  select is_locked into v_locked from public.invoices where id = v_invoice_id;

  if coalesce(v_locked, false) then
    raise exception 'The lines of an issued invoice cannot be changed'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

comment on function public.guard_locked_invoice_items() is
  'Prevents any line change on a document that has already been issued.';

create trigger invoice_items_05_guard_locked
  before insert or update or delete on public.invoice_items
  for each row execute function public.guard_locked_invoice_items();

-- Issues a draft: assigns the number, freezes the identity and locks the row.
create or replace function public.issue_invoice(
  p_invoice_id uuid,
  p_issue_date date default current_date
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_profile public.company_profiles%rowtype;
  v_client public.clients%rowtype;
  v_address public.client_addresses%rowtype;
  v_number text;
  v_snapshot_id uuid;
  v_prefix text;
  v_due date;
  v_item_count integer;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id and deleted_at is null;

  if not found then
    raise exception 'Invoice % was not found', p_invoice_id using errcode = 'P0002';
  end if;

  if not public.can_write_company_data(v_invoice.company_id) then
    raise exception 'You are not allowed to issue invoices for this company'
      using errcode = '42501';
  end if;

  if v_invoice.is_locked then
    raise exception 'Invoice % has already been issued', v_invoice.invoice_number
      using errcode = '42501';
  end if;

  select count(*) into v_item_count
    from public.invoice_items
   where invoice_id = p_invoice_id and deleted_at is null;

  if v_item_count = 0 then
    raise exception 'An invoice must contain at least one line before it is issued'
      using errcode = '22023';
  end if;

  select * into v_profile
    from public.company_profiles
   where company_id = v_invoice.company_id and deleted_at is null;

  select * into v_client
    from public.clients
   where id = v_invoice.client_id and deleted_at is null;

  select * into v_address
    from public.client_addresses
   where client_id = v_invoice.client_id
     and address_type = 'billing'
     and deleted_at is null
   order by is_default desc, created_at asc
   limit 1;

  v_snapshot_id := public.capture_company_profile_snapshot(v_invoice.company_id);

  v_prefix := case v_invoice.document_type
                when 'proforma_invoice' then coalesce(v_profile.proforma_prefix, 'PF-')
                else coalesce(v_profile.invoice_prefix, 'INV-')
              end;

  v_number := coalesce(
    v_invoice.invoice_number,
    public.next_document_number(
      v_invoice.company_id,
      v_invoice.document_type,
      v_prefix,
      coalesce(v_profile.number_padding, 4)::smallint,
      coalesce(v_profile.numbering_reset_policy, 'never'),
      null::text,
      p_issue_date
    )
  );

  v_due := p_issue_date + make_interval(
    days => coalesce(
      v_invoice.payment_terms_days,
      v_client.default_payment_terms_days,
      v_profile.default_payment_terms_days,
      30
    )
  );

  update public.invoices
     set invoice_number = v_number,
         status = 'sent',
         issue_date = p_issue_date,
         due_date = greatest(v_due, p_issue_date),
         issued_at = now(),
         is_locked = true,
         locked_at = now(),
         company_profile_snapshot_id = v_snapshot_id,
         client_name_snapshot = coalesce(v_client.legal_name, v_client.display_name),
         client_tax_id_snapshot = coalesce(v_client.vat_number, v_client.tax_id),
         bill_to = jsonb_strip_nulls(jsonb_build_object(
           'name', coalesce(v_client.legal_name, v_client.display_name),
           'attention_to', v_address.attention_to,
           'email', v_client.email::text,
           'phone', v_client.phone,
           'tax_id', coalesce(v_client.vat_number, v_client.tax_id),
           'address_line1', v_address.address_line1,
           'address_line2', v_address.address_line2,
           'city', v_address.city,
           'state_region', v_address.state_region,
           'postal_code', v_address.postal_code,
           'country_code', coalesce(v_address.country_code, v_client.country_code)
         )),
         updated_at = now()
   where id = p_invoice_id;

  insert into public.document_events (company_id, document_kind, document_id, event_type, detail)
  values (
    v_invoice.company_id,
    'invoice',
    p_invoice_id,
    'issued',
    jsonb_build_object('invoice_number', v_number)
  );

  update public.clients
     set first_invoiced_at = coalesce(first_invoiced_at, now()),
         last_invoiced_at = now(),
         updated_at = now()
   where id = v_invoice.client_id;

  return v_number;
end;
$$;

comment on function public.issue_invoice(uuid, date) is
  'Assigns the number, freezes the identity and locks a draft invoice.';

-- Creates a corrected copy of an issued invoice and cancels the original.
create or replace function public.revise_invoice(p_invoice_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_new_id uuid;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id and deleted_at is null;

  if not found then
    raise exception 'Invoice % was not found', p_invoice_id using errcode = 'P0002';
  end if;

  if not public.can_write_company_data(v_invoice.company_id) then
    raise exception 'You are not allowed to revise invoices for this company'
      using errcode = '42501';
  end if;

  if v_invoice.paid_amount > 0 then
    raise exception 'A paid invoice is corrected with a credit note, not a revision'
      using errcode = '42501';
  end if;

  insert into public.invoices (
    company_id, client_id, client_contact_id, document_type, status,
    currency, currency_exponent, base_currency, exchange_rate, decimal_scale,
    rounding_mode, tax_mode, discount_stage, issue_date, supply_date, due_date,
    payment_terms_days, discount_type, discount_value, shipping_amount,
    shipping_tax_rate_id, applies_reverse_charge, tax_note, place_of_supply_country,
    purchase_order_reference, project_reference, notes, terms_and_conditions,
    footer_note, template_key, accent_color, revision_of_invoice_id, revision_number
  )
  select company_id, client_id, client_contact_id, document_type, 'draft',
         currency, currency_exponent, base_currency, exchange_rate, decimal_scale,
         rounding_mode, tax_mode, discount_stage, current_date, supply_date,
         greatest(due_date, current_date), payment_terms_days, discount_type,
         discount_value, shipping_amount, shipping_tax_rate_id, applies_reverse_charge,
         tax_note, place_of_supply_country, purchase_order_reference, project_reference,
         notes, terms_and_conditions, footer_note, template_key, accent_color,
         p_invoice_id, revision_number + 1
    from public.invoices
   where id = p_invoice_id
  returning id into v_new_id;

  insert into public.invoice_items (
    company_id, invoice_id, line_number, line_type, product_id, sku_snapshot,
    description, long_description, quantity, unit_label, unit_price,
    discount_type, discount_value, tax_rate_id, tax_group_id, tax_name_snapshot,
    tax_percentage, is_tax_compound, is_taxable, cost_price_snapshot, metadata
  )
  select company_id, v_new_id, line_number, line_type, product_id, sku_snapshot,
         description, long_description, quantity, unit_label, unit_price,
         discount_type, discount_value, tax_rate_id, tax_group_id, tax_name_snapshot,
         tax_percentage, is_tax_compound, is_taxable, cost_price_snapshot, metadata
    from public.invoice_items
   where invoice_id = p_invoice_id
     and deleted_at is null
   order by line_number;

  update public.invoices
     set status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = 'Replaced by a revised invoice',
         updated_at = now()
   where id = p_invoice_id;

  perform public.recalculate_invoice_totals(v_new_id);

  return v_new_id;
end;
$$;

comment on function public.revise_invoice(uuid) is
  'Copies an issued invoice into a new draft and cancels the original.';

-- Recalculates the settlement state after a payment or a credit note.
create or replace function public.refresh_invoice_settlement(p_invoice_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_status public.invoice_status;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id;

  if not found then
    return;
  end if;

  if v_invoice.status in ('draft', 'cancelled', 'written_off', 'disputed') then
    return;
  end if;

  if v_invoice.paid_amount + v_invoice.credited_amount >= v_invoice.total_amount - 0.0001 then
    v_status := 'paid';
  elsif v_invoice.paid_amount > 0 then
    v_status := 'partially_paid';
  elsif v_invoice.due_date < current_date then
    v_status := 'overdue';
  elsif v_invoice.first_viewed_at is not null then
    v_status := 'viewed';
  else
    v_status := 'sent';
  end if;

  update public.invoices
     set status = v_status,
         paid_at = case when v_status = 'paid' then coalesce(paid_at, now()) else null end,
         updated_at = now()
   where id = p_invoice_id
     and status is distinct from v_status;
end;
$$;

comment on function public.refresh_invoice_settlement(uuid) is
  'Moves an invoice between sent, viewed, overdue, partially paid and paid.';

-- Marks every overdue invoice, run by the scheduled collections job.
create or replace function public.mark_overdue_invoices()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.invoices
     set status = 'overdue',
         updated_at = now()
   where deleted_at is null
     and status in ('sent', 'viewed')
     and due_date < current_date
     and total_amount > paid_amount + credited_amount;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.mark_overdue_invoices() is
  'Moves every unpaid invoice past its due date into the overdue state.';

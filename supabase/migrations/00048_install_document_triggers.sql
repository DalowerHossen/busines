-- supabase/migrations/00048_install_document_triggers.sql
-- Standard triggers and audit coverage for the document module.

select public.install_standard_triggers('invoices');
select public.install_standard_triggers('invoice_items');
select public.install_standard_triggers('estimates');
select public.install_standard_triggers('estimate_items');
select public.install_standard_triggers('credit_notes');
select public.install_standard_triggers('credit_note_items');
select public.install_standard_triggers('recurring_invoice_schedules');

select public.install_timestamp_trigger('invoice_taxes');
select public.install_timestamp_trigger('credit_note_applications');
select public.install_timestamp_trigger('document_links');

-- Documents and the money they represent are fully audited.
select public.install_audit_trigger('invoices');
select public.install_audit_trigger('invoice_items');
select public.install_audit_trigger('estimates');
select public.install_audit_trigger('credit_notes');
select public.install_audit_trigger('credit_note_applications');
select public.install_audit_trigger('recurring_invoice_schedules');

-- Copies the company and client defaults onto a new document so the caller
-- only has to supply the client.
create or replace function public.apply_invoice_defaults()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company public.companies%rowtype;
  v_client public.clients%rowtype;
  v_terms smallint;
begin
  select * into v_company from public.companies where id = new.company_id;

  if not found then
    raise exception 'Company % was not found', new.company_id using errcode = 'P0002';
  end if;

  select * into v_client from public.clients where id = new.client_id;

  new.base_currency := coalesce(new.base_currency, v_company.base_currency);
  new.currency := coalesce(new.currency, v_client.billing_currency, v_company.base_currency);
  new.currency_exponent := coalesce(new.currency_exponent, v_company.currency_exponent);
  new.decimal_scale := coalesce(new.decimal_scale, v_company.decimal_scale);
  new.rounding_mode := coalesce(new.rounding_mode, v_company.rounding_mode);
  new.tax_mode := coalesce(new.tax_mode, v_company.tax_mode);
  new.discount_stage := coalesce(new.discount_stage, v_company.discount_stage);
  new.place_of_supply_country := coalesce(
    new.place_of_supply_country, v_client.country_code, v_company.country_code
  );

  if new.applies_reverse_charge is not true and v_client.applies_reverse_charge then
    new.applies_reverse_charge := true;
  end if;

  v_terms := coalesce(new.payment_terms_days, v_client.default_payment_terms_days);

  if v_terms is not null then
    new.payment_terms_days := v_terms;

    if new.due_date = new.issue_date then
      new.due_date := new.issue_date + make_interval(days => v_terms);
    end if;
  end if;

  return new;
end;
$$;

comment on function public.apply_invoice_defaults() is
  'Fills the currency, tax and payment term defaults of a new invoice.';

create trigger invoices_apply_defaults
  before insert on public.invoices
  for each row execute function public.apply_invoice_defaults();

-- The same defaults apply to an estimate.
create or replace function public.apply_estimate_defaults()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company public.companies%rowtype;
  v_client public.clients%rowtype;
begin
  select * into v_company from public.companies where id = new.company_id;

  if not found then
    raise exception 'Company % was not found', new.company_id using errcode = 'P0002';
  end if;

  select * into v_client from public.clients where id = new.client_id;

  new.base_currency := coalesce(new.base_currency, v_company.base_currency);
  new.currency := coalesce(new.currency, v_client.billing_currency, v_company.base_currency);
  new.currency_exponent := coalesce(new.currency_exponent, v_company.currency_exponent);
  new.decimal_scale := coalesce(new.decimal_scale, v_company.decimal_scale);
  new.rounding_mode := coalesce(new.rounding_mode, v_company.rounding_mode);
  new.tax_mode := coalesce(new.tax_mode, v_company.tax_mode);
  new.discount_stage := coalesce(new.discount_stage, v_company.discount_stage);

  if new.valid_until is null then
    new.valid_until := new.issue_date + 30;
  end if;

  return new;
end;
$$;

comment on function public.apply_estimate_defaults() is
  'Fills the currency, tax and validity defaults of a new estimate.';

create trigger estimates_apply_defaults
  before insert on public.estimates
  for each row execute function public.apply_estimate_defaults();

-- Records the creation of every document, which starts the evidence chain.
create or replace function public.record_document_creation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind public.shared_document_type;
begin
  v_kind := case tg_table_name
              when 'invoices' then 'invoice'
              when 'estimates' then 'estimate'
              else 'credit_note'
            end::public.shared_document_type;

  insert into public.document_events (
    company_id, document_kind, document_id, event_type, actor_user_id
  )
  values (new.company_id, v_kind, new.id, 'created', public.current_user_id());

  return new;
end;
$$;

comment on function public.record_document_creation() is
  'Opens the evidence chain of a document the moment it is created.';

create trigger invoices_record_creation
  after insert on public.invoices
  for each row execute function public.record_document_creation();

create trigger estimates_record_creation
  after insert on public.estimates
  for each row execute function public.record_document_creation();

create trigger credit_notes_record_creation
  after insert on public.credit_notes
  for each row execute function public.record_document_creation();

-- Marks expired estimates, run by the same nightly job as the invoice sweep.
create or replace function public.expire_stale_estimates()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.estimates
     set status = 'expired',
         updated_at = now()
   where deleted_at is null
     and status in ('sent', 'viewed')
     and valid_until is not null
     and valid_until < current_date;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.expire_stale_estimates() is
  'Moves every estimate past its validity date into the expired state.';

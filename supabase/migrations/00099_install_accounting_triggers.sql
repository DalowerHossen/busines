-- supabase/migrations/00099_install_accounting_triggers.sql
-- Standard triggers, the immutability of the ledger, and the automatic
-- postings that keep the books in step with the documents.

select public.install_standard_triggers('ledger_accounts');
select public.install_standard_triggers('journal_entries');
select public.install_standard_triggers('vendors');
select public.install_standard_triggers('vendor_contacts');
select public.install_standard_triggers('expense_categories');
select public.install_standard_triggers('expenses');
select public.install_standard_triggers('supplier_bills');
select public.install_standard_triggers('purchase_orders');
select public.install_standard_triggers('bank_accounts');
select public.install_standard_triggers('reconciliation_rules');

select public.install_timestamp_trigger('purchase_order_items');
select public.install_timestamp_trigger('purchase_receipts');
select public.install_timestamp_trigger('bank_transactions');
select public.install_timestamp_trigger('bank_import_batches');
select public.install_timestamp_trigger('reconciliation_matches');

select public.install_audit_trigger('ledger_accounts');
select public.install_audit_trigger('journal_entries');
select public.install_audit_trigger('vendors');
select public.install_audit_trigger('expenses');
select public.install_audit_trigger('supplier_bills');
select public.install_audit_trigger('purchase_orders');
select public.install_audit_trigger('bank_accounts');
select public.install_audit_trigger('reconciliation_matches');

-- -----------------------------------------------------------------------------
-- Ledger immutability
-- -----------------------------------------------------------------------------

-- A posted entry can only change status, and only to reversed. Everything
-- else about it is history.
create or replace function public.guard_posted_journal_entry()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status = 'posted'
     and (new.entry_date is distinct from old.entry_date
          or new.total_debit is distinct from old.total_debit
          or new.total_credit is distinct from old.total_credit
          or new.entry_number is distinct from old.entry_number
          or new.company_id is distinct from old.company_id
          or new.memo is distinct from old.memo
          or new.reference is distinct from old.reference
          or new.source_type is distinct from old.source_type
          or new.source_id is distinct from old.source_id) then
    raise exception 'A posted entry cannot be edited. Reverse it instead.'
      using errcode = '42501';
  end if;

  if old.status = 'reversed' and new.status <> 'reversed' then
    raise exception 'A reversed entry cannot be reopened' using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_posted_journal_entry() is
  'Keeps posted entries unchanged; corrections go through a reversal.';

create trigger journal_entries_10_posted_guard
  before update on public.journal_entries
  for each row execute function public.guard_posted_journal_entry();

-- The lines of a posted entry are fixed for the same reason.
create or replace function public.guard_posted_journal_lines()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_status public.journal_entry_status;
  v_entry_id uuid := coalesce(new.entry_id, old.entry_id);
begin
  select status into v_status from public.journal_entries where id = v_entry_id;

  if v_status in ('posted', 'reversed') and not public.is_service_role() then
    raise exception 'The lines of a posted entry cannot be changed'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

comment on function public.guard_posted_journal_lines() is
  'Blocks any change to the lines of an entry that has already been posted.';

create trigger journal_lines_10_posted_guard
  before update or delete on public.journal_lines
  for each row execute function public.guard_posted_journal_lines();

-- Keeps the cached balance on each account in step with the lines.
create or replace function public.refresh_ledger_account_balance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account_id uuid := coalesce(new.account_id, old.account_id);
begin
  update public.ledger_accounts
     set current_balance = public.account_balance(v_account_id),
         updated_at = now()
   where id = v_account_id;

  return coalesce(new, old);
end;
$$;

comment on function public.refresh_ledger_account_balance() is
  'Keeps the cached account balance in step with the posted lines.';

create trigger journal_lines_20_balance_refresh
  after insert or update or delete on public.journal_lines
  for each row execute function public.refresh_ledger_account_balance();

-- A system account is wired into the postings and cannot be taken away.
create or replace function public.guard_system_ledger_account()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.is_system then
    if new.deleted_at is not null and old.deleted_at is null then
      raise exception 'The % account is used by the automatic postings and cannot be removed',
        old.name using errcode = '42501';
    end if;

    if new.system_key is distinct from old.system_key
       or new.account_type is distinct from old.account_type then
      raise exception 'The role of a system account cannot be changed'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.guard_system_ledger_account() is
  'Protects the accounts the automatic postings depend on.';

create trigger ledger_accounts_10_system_guard
  before update on public.ledger_accounts
  for each row execute function public.guard_system_ledger_account();

-- -----------------------------------------------------------------------------
-- Suppliers and spending
-- -----------------------------------------------------------------------------

create trigger vendors_05_reference
  before insert on public.vendors
  for each row execute function public.assign_vendor_reference();

create trigger vendors_06_normalise
  before insert or update of display_name, email on public.vendors
  for each row execute function public.set_vendor_normalized_columns();

create trigger vendor_contacts_10_primary_guard
  before insert or update of is_primary on public.vendor_contacts
  for each row execute function public.guard_primary_vendor_contact();

create trigger expenses_05_number
  before insert on public.expenses
  for each row execute function public.assign_expense_number();

-- Keeps the money on an expense consistent, whatever the caller supplied.
create or replace function public.recalculate_expense_totals()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_rate numeric := 0;
begin
  if new.tax_rate_id is not null then
    select rate_percentage into v_rate from public.tax_rates where id = new.tax_rate_id;
    new.tax_amount := round(new.subtotal_amount * coalesce(v_rate, 0) / 100, 4);
  end if;

  new.total_amount := round(new.subtotal_amount + new.tax_amount, 4);
  new.base_currency_amount := round(new.total_amount * new.exchange_rate, 4);

  if new.is_paid and new.paid_at is null then
    new.paid_at := now();
  end if;

  return new;
end;
$$;

comment on function public.recalculate_expense_totals() is
  'Recomputes the tax, the total and the base currency value of an expense.';

create trigger expenses_10_totals
  before insert or update of subtotal_amount, tax_rate_id, tax_amount,
    exchange_rate, is_paid on public.expenses
  for each row execute function public.recalculate_expense_totals();

-- Posts an expense to the ledger the moment it is approved.
create or replace function public.post_expense_on_approval()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    perform public.post_expense_to_ledger(new.id);
  end if;

  return new;
end;
$$;

comment on function public.post_expense_on_approval() is
  'Writes the ledger entry of an expense as soon as it is approved.';

create trigger expenses_90_ledger_posting
  after update of status on public.expenses
  for each row execute function public.post_expense_on_approval();

create trigger purchase_orders_05_number
  before insert on public.purchase_orders
  for each row execute function public.assign_purchase_order_number();

-- Keeps the line total and the order totals in step with the quantities.
create or replace function public.recalculate_purchase_line_total()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.line_total := round(new.quantity * new.unit_price + new.tax_amount, 4);
  return new;
end;
$$;

comment on function public.recalculate_purchase_line_total() is
  'Recomputes the value of one ordered line.';

create trigger purchase_order_items_10_line_total
  before insert or update of quantity, unit_price, tax_amount
  on public.purchase_order_items
  for each row execute function public.recalculate_purchase_line_total();

create or replace function public.refresh_purchase_order_totals()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.recalculate_purchase_order_totals(
    coalesce(new.purchase_order_id, old.purchase_order_id)
  );
  return coalesce(new, old);
end;
$$;

comment on function public.refresh_purchase_order_totals() is
  'Rebuilds the totals of an order whenever one of its lines changes.';

create trigger purchase_order_items_20_order_totals
  after insert or update or delete on public.purchase_order_items
  for each row execute function public.refresh_purchase_order_totals();

-- -----------------------------------------------------------------------------
-- Banking
-- -----------------------------------------------------------------------------

create trigger bank_transactions_10_immutable
  before update on public.bank_transactions
  for each row execute function public.guard_bank_transaction();

-- Keeps one primary bank account per tenant.
create or replace function public.guard_primary_bank_account()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_primary then
    update public.bank_accounts
       set is_primary = false,
           updated_at = now()
     where company_id = new.company_id
       and id <> new.id
       and is_primary
       and deleted_at is null;
  end if;

  return new;
end;
$$;

comment on function public.guard_primary_bank_account() is
  'Keeps a single primary bank account for each tenant.';

create trigger bank_accounts_10_primary_guard
  before insert or update of is_primary on public.bank_accounts
  for each row execute function public.guard_primary_bank_account();

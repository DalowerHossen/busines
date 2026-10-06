-- supabase/migrations/00100_enable_rls_accounting.sql
-- Row level security for the ledger, suppliers, spending and the bank feed.
--
-- The accountant role matters here more than anywhere else in the platform:
-- it may read everything in the books of a company that granted access, and
-- it may post journal entries, but it may not touch bank credentials or
-- approve spending. Those limits live in the policies below.

alter table public.ledger_accounts enable row level security;
alter table public.chart_templates enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.vendors enable row level security;
alter table public.vendor_contacts enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.supplier_bills enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.purchase_receipts enable row level security;
alter table public.purchase_receipt_items enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.bank_import_batches enable row level security;
alter table public.reconciliation_matches enable row level security;
alter table public.reconciliation_rules enable row level security;

alter table public.ledger_accounts force row level security;
alter table public.chart_templates force row level security;
alter table public.journal_entries force row level security;
alter table public.journal_lines force row level security;
alter table public.vendors force row level security;
alter table public.vendor_contacts force row level security;
alter table public.expense_categories force row level security;
alter table public.expenses force row level security;
alter table public.supplier_bills force row level security;
alter table public.purchase_orders force row level security;
alter table public.purchase_order_items force row level security;
alter table public.purchase_receipts force row level security;
alter table public.purchase_receipt_items force row level security;
alter table public.bank_accounts force row level security;
alter table public.bank_transactions force row level security;
alter table public.bank_import_batches force row level security;
alter table public.reconciliation_matches force row level security;
alter table public.reconciliation_rules force row level security;

select public.install_tenant_policies('vendors');
select public.install_tenant_policies('vendor_contacts');
select public.install_tenant_policies('expense_categories');
select public.install_tenant_policies('expenses');
select public.install_tenant_policies('supplier_bills');
select public.install_tenant_policies('purchase_orders');
select public.install_tenant_policies('reconciliation_rules');

-- -----------------------------------------------------------------------------
-- Chart of accounts
-- -----------------------------------------------------------------------------

create policy ledger_accounts_select on public.ledger_accounts
  for select to authenticated
  using (deleted_at is null and public.has_company_access(company_id));

create policy ledger_accounts_insert on public.ledger_accounts
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy ledger_accounts_update on public.ledger_accounts
  for update to authenticated
  using (deleted_at is null and public.can_write_company_data(company_id))
  with check (public.can_write_company_data(company_id));

-- The ready made charts are reference data every signed in user may read.
create policy chart_templates_select on public.chart_templates
  for select to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- Journal
-- -----------------------------------------------------------------------------

create policy journal_entries_select on public.journal_entries
  for select to authenticated
  using (deleted_at is null and public.has_company_access(company_id));

create policy journal_entries_insert on public.journal_entries
  for insert to authenticated
  with check (public.can_post_journal_entries(company_id));

create policy journal_entries_update on public.journal_entries
  for update to authenticated
  using (deleted_at is null and public.can_post_journal_entries(company_id))
  with check (public.can_post_journal_entries(company_id));

create policy journal_lines_select on public.journal_lines
  for select to authenticated
  using (public.has_company_access(company_id));

create policy journal_lines_insert on public.journal_lines
  for insert to authenticated
  with check (public.can_post_journal_entries(company_id));

comment on policy journal_entries_insert on public.journal_entries is
  'An accountant with an active grant may post entries, which is the point of the role.';

-- -----------------------------------------------------------------------------
-- Purchasing
-- -----------------------------------------------------------------------------

create policy purchase_order_items_select on public.purchase_order_items
  for select to authenticated
  using (public.has_company_access(company_id));

create policy purchase_order_items_insert on public.purchase_order_items
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy purchase_order_items_update on public.purchase_order_items
  for update to authenticated
  using (public.can_write_company_data(company_id))
  with check (public.can_write_company_data(company_id));

create policy purchase_receipts_select on public.purchase_receipts
  for select to authenticated
  using (public.has_company_access(company_id));

create policy purchase_receipts_insert on public.purchase_receipts
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy purchase_receipt_items_select on public.purchase_receipt_items
  for select to authenticated
  using (public.has_company_access(company_id));

create policy purchase_receipt_items_insert on public.purchase_receipt_items
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

-- -----------------------------------------------------------------------------
-- Banking
-- -----------------------------------------------------------------------------

-- The feed credentials and the balances are owner level information.
create policy bank_accounts_select on public.bank_accounts
  for select to authenticated
  using (deleted_at is null and public.has_company_access(company_id));

create policy bank_accounts_insert on public.bank_accounts
  for insert to authenticated
  with check (public.is_company_owner(company_id) or public.is_super_admin());

create policy bank_accounts_update on public.bank_accounts
  for update to authenticated
  using (
    deleted_at is null
    and (public.is_company_owner(company_id) or public.is_super_admin())
  )
  with check (public.is_company_owner(company_id) or public.is_super_admin());

comment on policy bank_accounts_update on public.bank_accounts is
  'Connecting or disconnecting a bank feed is a decision for the owner.';

create policy bank_transactions_select on public.bank_transactions
  for select to authenticated
  using (public.has_company_access(company_id));

create policy bank_transactions_insert on public.bank_transactions
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy bank_transactions_update on public.bank_transactions
  for update to authenticated
  using (public.can_write_company_data(company_id))
  with check (public.can_write_company_data(company_id));

create policy bank_import_batches_select on public.bank_import_batches
  for select to authenticated
  using (public.has_company_access(company_id));

create policy bank_import_batches_insert on public.bank_import_batches
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy reconciliation_matches_select on public.reconciliation_matches
  for select to authenticated
  using (public.has_company_access(company_id));

create policy reconciliation_matches_insert on public.reconciliation_matches
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy reconciliation_matches_update on public.reconciliation_matches
  for update to authenticated
  using (public.can_write_company_data(company_id))
  with check (public.can_write_company_data(company_id));

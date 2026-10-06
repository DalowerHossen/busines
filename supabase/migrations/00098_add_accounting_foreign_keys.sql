-- supabase/migrations/00098_add_accounting_foreign_keys.sql
-- Relationships for the ledger, suppliers, spending and the bank feed.
--
-- A posted entry outlives the document that produced it, so those links are
-- deliberately loose. What must never dangle is a journal line without an
-- account, which is why that one reference is restricted.

-- Ledger ----------------------------------------------------------------------

alter table public.ledger_accounts
  add constraint ledger_accounts_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.ledger_accounts
  add constraint ledger_accounts_parent_fkey
  foreign key (parent_account_id) references public.ledger_accounts (id)
  on delete set null;

alter table public.ledger_accounts
  add constraint ledger_accounts_tax_rate_fkey
  foreign key (tax_rate_id) references public.tax_rates (id) on delete set null;

alter table public.ledger_accounts
  add constraint ledger_accounts_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.ledger_accounts
  add constraint ledger_accounts_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.journal_entries
  add constraint journal_entries_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.journal_entries
  add constraint journal_entries_reversal_fkey
  foreign key (reversal_of_entry_id) references public.journal_entries (id)
  on delete set null;

alter table public.journal_entries
  add constraint journal_entries_posted_by_fkey
  foreign key (posted_by) references public.users (id) on delete set null;

alter table public.journal_entries
  add constraint journal_entries_reversed_by_fkey
  foreign key (reversed_by) references public.users (id) on delete set null;

alter table public.journal_entries
  add constraint journal_entries_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.journal_entries
  add constraint journal_entries_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.journal_lines
  add constraint journal_lines_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.journal_lines
  add constraint journal_lines_entry_fkey
  foreign key (entry_id) references public.journal_entries (id) on delete cascade;

alter table public.journal_lines
  add constraint journal_lines_account_fkey
  foreign key (account_id) references public.ledger_accounts (id) on delete restrict;

alter table public.journal_lines
  add constraint journal_lines_client_fkey
  foreign key (client_id) references public.clients (id) on delete set null;

alter table public.journal_lines
  add constraint journal_lines_tax_rate_fkey
  foreign key (tax_rate_id) references public.tax_rates (id) on delete set null;

-- Suppliers -------------------------------------------------------------------

alter table public.vendors
  add constraint vendors_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.vendors
  add constraint vendors_tax_rate_fkey
  foreign key (tax_rate_id) references public.tax_rates (id) on delete set null;

alter table public.vendors
  add constraint vendors_expense_account_fkey
  foreign key (default_expense_account_id) references public.ledger_accounts (id)
  on delete set null;

alter table public.vendors
  add constraint vendors_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.vendors
  add constraint vendors_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.vendor_contacts
  add constraint vendor_contacts_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.vendor_contacts
  add constraint vendor_contacts_vendor_fkey
  foreign key (vendor_id) references public.vendors (id) on delete cascade;

alter table public.vendor_contacts
  add constraint vendor_contacts_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.vendor_contacts
  add constraint vendor_contacts_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.journal_lines
  add constraint journal_lines_vendor_fkey
  foreign key (vendor_id) references public.vendors (id) on delete set null;

-- Spending --------------------------------------------------------------------

alter table public.expense_categories
  add constraint expense_categories_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.expense_categories
  add constraint expense_categories_account_fkey
  foreign key (ledger_account_id) references public.ledger_accounts (id)
  on delete set null;

alter table public.expense_categories
  add constraint expense_categories_tax_rate_fkey
  foreign key (tax_rate_id) references public.tax_rates (id) on delete set null;

alter table public.expense_categories
  add constraint expense_categories_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.expense_categories
  add constraint expense_categories_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.expenses
  add constraint expenses_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.expenses
  add constraint expenses_vendor_fkey
  foreign key (vendor_id) references public.vendors (id) on delete set null;

alter table public.expenses
  add constraint expenses_category_fkey
  foreign key (category_id) references public.expense_categories (id)
  on delete set null;

alter table public.expenses
  add constraint expenses_ledger_account_fkey
  foreign key (ledger_account_id) references public.ledger_accounts (id)
  on delete set null;

alter table public.expenses
  add constraint expenses_payment_account_fkey
  foreign key (payment_account_id) references public.ledger_accounts (id)
  on delete set null;

alter table public.expenses
  add constraint expenses_tax_rate_fkey
  foreign key (tax_rate_id) references public.tax_rates (id) on delete set null;

alter table public.expenses
  add constraint expenses_client_fkey
  foreign key (client_id) references public.clients (id) on delete set null;

alter table public.expenses
  add constraint expenses_invoice_fkey
  foreign key (invoice_id) references public.invoices (id) on delete set null;

alter table public.expenses
  add constraint expenses_paid_by_fkey
  foreign key (paid_by_user_id) references public.users (id) on delete set null;

alter table public.expenses
  add constraint expenses_journal_entry_fkey
  foreign key (journal_entry_id) references public.journal_entries (id)
  on delete set null;

alter table public.expenses
  add constraint expenses_submitted_by_fkey
  foreign key (submitted_by) references public.users (id) on delete set null;

alter table public.expenses
  add constraint expenses_approved_by_fkey
  foreign key (approved_by) references public.users (id) on delete set null;

alter table public.expenses
  add constraint expenses_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.expenses
  add constraint expenses_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.supplier_bills
  add constraint supplier_bills_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.supplier_bills
  add constraint supplier_bills_vendor_fkey
  foreign key (vendor_id) references public.vendors (id) on delete restrict;

alter table public.supplier_bills
  add constraint supplier_bills_journal_entry_fkey
  foreign key (journal_entry_id) references public.journal_entries (id)
  on delete set null;

alter table public.supplier_bills
  add constraint supplier_bills_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.supplier_bills
  add constraint supplier_bills_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

-- Purchasing ------------------------------------------------------------------

alter table public.purchase_orders
  add constraint purchase_orders_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.purchase_orders
  add constraint purchase_orders_vendor_fkey
  foreign key (vendor_id) references public.vendors (id) on delete restrict;

alter table public.purchase_orders
  add constraint purchase_orders_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.purchase_orders
  add constraint purchase_orders_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.supplier_bills
  add constraint supplier_bills_purchase_order_fkey
  foreign key (purchase_order_id) references public.purchase_orders (id)
  on delete set null;

alter table public.purchase_order_items
  add constraint purchase_order_items_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.purchase_order_items
  add constraint purchase_order_items_order_fkey
  foreign key (purchase_order_id) references public.purchase_orders (id)
  on delete cascade;

alter table public.purchase_order_items
  add constraint purchase_order_items_product_fkey
  foreign key (product_id) references public.products (id) on delete set null;

alter table public.purchase_order_items
  add constraint purchase_order_items_tax_rate_fkey
  foreign key (tax_rate_id) references public.tax_rates (id) on delete set null;

alter table public.purchase_receipts
  add constraint purchase_receipts_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.purchase_receipts
  add constraint purchase_receipts_order_fkey
  foreign key (purchase_order_id) references public.purchase_orders (id)
  on delete cascade;

alter table public.purchase_receipts
  add constraint purchase_receipts_received_by_fkey
  foreign key (received_by) references public.users (id) on delete set null;

alter table public.purchase_receipt_items
  add constraint purchase_receipt_items_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.purchase_receipt_items
  add constraint purchase_receipt_items_receipt_fkey
  foreign key (receipt_id) references public.purchase_receipts (id) on delete cascade;

alter table public.purchase_receipt_items
  add constraint purchase_receipt_items_line_fkey
  foreign key (purchase_order_item_id) references public.purchase_order_items (id)
  on delete cascade;

-- Banking ---------------------------------------------------------------------

alter table public.bank_accounts
  add constraint bank_accounts_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.bank_accounts
  add constraint bank_accounts_ledger_account_fkey
  foreign key (ledger_account_id) references public.ledger_accounts (id)
  on delete set null;

alter table public.bank_accounts
  add constraint bank_accounts_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.bank_accounts
  add constraint bank_accounts_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.bank_transactions
  add constraint bank_transactions_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.bank_transactions
  add constraint bank_transactions_account_fkey
  foreign key (bank_account_id) references public.bank_accounts (id) on delete cascade;

alter table public.bank_transactions
  add constraint bank_transactions_batch_fkey
  foreign key (import_batch_id) references public.bank_import_batches (id)
  on delete set null;

alter table public.bank_transactions
  add constraint bank_transactions_journal_entry_fkey
  foreign key (journal_entry_id) references public.journal_entries (id)
  on delete set null;

alter table public.bank_transactions
  add constraint bank_transactions_matched_by_fkey
  foreign key (matched_by) references public.users (id) on delete set null;

alter table public.bank_import_batches
  add constraint bank_import_batches_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.bank_import_batches
  add constraint bank_import_batches_account_fkey
  foreign key (bank_account_id) references public.bank_accounts (id) on delete cascade;

alter table public.bank_import_batches
  add constraint bank_import_batches_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

-- The payment side of the reconciliation, deferred until the bank feed existed.
alter table public.payments
  add constraint payments_bank_transaction_fkey
  foreign key (bank_transaction_id) references public.bank_transactions (id)
  on delete set null;

alter table public.reconciliation_matches
  add constraint reconciliation_matches_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.reconciliation_matches
  add constraint reconciliation_matches_transaction_fkey
  foreign key (bank_transaction_id) references public.bank_transactions (id)
  on delete cascade;

alter table public.reconciliation_matches
  add constraint reconciliation_matches_payment_fkey
  foreign key (payment_id) references public.payments (id) on delete cascade;

alter table public.reconciliation_matches
  add constraint reconciliation_matches_expense_fkey
  foreign key (expense_id) references public.expenses (id) on delete cascade;

alter table public.reconciliation_matches
  add constraint reconciliation_matches_bill_fkey
  foreign key (supplier_bill_id) references public.supplier_bills (id)
  on delete cascade;

alter table public.reconciliation_matches
  add constraint reconciliation_matches_payout_fkey
  foreign key (payout_id) references public.payouts (id) on delete cascade;

alter table public.reconciliation_matches
  add constraint reconciliation_matches_entry_fkey
  foreign key (journal_entry_id) references public.journal_entries (id)
  on delete cascade;

alter table public.reconciliation_matches
  add constraint reconciliation_matches_confirmed_by_fkey
  foreign key (confirmed_by) references public.users (id) on delete set null;

alter table public.reconciliation_rules
  add constraint reconciliation_rules_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.reconciliation_rules
  add constraint reconciliation_rules_bank_account_fkey
  foreign key (bank_account_id) references public.bank_accounts (id) on delete cascade;

alter table public.reconciliation_rules
  add constraint reconciliation_rules_ledger_account_fkey
  foreign key (set_ledger_account_id) references public.ledger_accounts (id)
  on delete set null;

alter table public.reconciliation_rules
  add constraint reconciliation_rules_vendor_fkey
  foreign key (set_vendor_id) references public.vendors (id) on delete set null;

alter table public.reconciliation_rules
  add constraint reconciliation_rules_category_fkey
  foreign key (set_expense_category_id) references public.expense_categories (id)
  on delete set null;

alter table public.reconciliation_rules
  add constraint reconciliation_rules_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.reconciliation_rules
  add constraint reconciliation_rules_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

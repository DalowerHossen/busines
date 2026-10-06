-- supabase/migrations/00101_grant_accounting_privileges.sql
-- Table and routine privileges for the accounting module.
--
-- Posting is done through the routines, never by writing journal rows by
-- hand, because only the routines can guarantee that an entry balances.

grant select, insert, update on public.ledger_accounts to authenticated;
grant select on public.chart_templates to authenticated;
grant select on public.journal_entries to authenticated;
grant select on public.journal_lines to authenticated;

grant select, insert, update on public.vendors to authenticated;
grant select, insert, update on public.vendor_contacts to authenticated;
grant select, insert, update on public.expense_categories to authenticated;
grant select, insert, update on public.expenses to authenticated;
grant select, insert, update on public.supplier_bills to authenticated;

grant select, insert, update on public.purchase_orders to authenticated;
grant select, insert, update on public.purchase_order_items to authenticated;
grant select, insert on public.purchase_receipts to authenticated;
grant select, insert on public.purchase_receipt_items to authenticated;

grant select, insert, update on public.bank_accounts to authenticated;
grant select, insert, update on public.bank_transactions to authenticated;
grant select, insert on public.bank_import_batches to authenticated;
grant select, insert, update on public.reconciliation_matches to authenticated;
grant select, insert, update on public.reconciliation_rules to authenticated;

-- -----------------------------------------------------------------------------
-- Routines the application may call
-- -----------------------------------------------------------------------------

grant execute on function public.install_chart_of_accounts(uuid, text) to authenticated;
grant execute on function public.system_account_id(uuid, text) to authenticated;
grant execute on function public.can_post_journal_entries(uuid) to authenticated;
grant execute on function public.account_balance(uuid, date, date) to authenticated;
grant execute on function public.trial_balance(uuid, date, date) to authenticated;
grant execute on function public.profit_and_loss(uuid, date, date) to authenticated;
grant execute on function public.balance_sheet(uuid, date) to authenticated;
grant execute on function public.verify_ledger_balance(uuid) to authenticated;

grant execute on function public.post_journal_entry(
  uuid, jsonb, text, date, text, uuid, text
) to authenticated;
grant execute on function public.reverse_journal_entry(uuid, text, date)
  to authenticated;

grant execute on function public.review_expense(uuid, boolean, text) to authenticated;
grant execute on function public.write_off_invoice(uuid, text) to authenticated;

grant execute on function public.recalculate_purchase_order_totals(uuid)
  to authenticated;
grant execute on function public.receive_purchase_order(uuid, jsonb, date, text)
  to authenticated;

grant execute on function public.import_bank_transaction(
  uuid, numeric, date, text, text, text, text, uuid, text
) to authenticated;
grant execute on function public.suggest_bank_matches(uuid, integer) to authenticated;
grant execute on function public.match_bank_transaction(uuid, uuid, text, numeric)
  to authenticated;
grant execute on function public.unmatch_bank_transaction(uuid, text) to authenticated;
grant execute on function public.apply_reconciliation_rules(uuid, integer)
  to authenticated;
grant execute on function public.reconciliation_summary(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Reserved for the trusted server layer and the scheduled jobs
-- -----------------------------------------------------------------------------

revoke all on function public.post_invoice_to_ledger(uuid) from anon, authenticated;
revoke all on function public.post_payment_to_ledger(uuid) from anon, authenticated;
revoke all on function public.post_expense_to_ledger(uuid) from anon, authenticated;

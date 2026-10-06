-- supabase/migrations/00060_add_payment_foreign_keys.sql
-- Relationships for gateways, payments, refunds, disputes, wallets and payouts.
--
-- Nothing that represents money is ever cascaded away: payments, refunds and
-- ledger entries outlive the records that produced them.

alter table public.payment_gateways
  add constraint payment_gateways_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.payment_gateways
  add constraint payment_gateways_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.payment_gateways
  add constraint payment_gateways_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.gateway_availability
  add constraint gateway_availability_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.gateway_availability
  add constraint gateway_availability_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.gateway_availability
  add constraint gateway_availability_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.client_payment_methods
  add constraint client_payment_methods_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.client_payment_methods
  add constraint client_payment_methods_client_fkey
  foreign key (client_id) references public.clients (id) on delete cascade;

alter table public.client_payment_methods
  add constraint client_payment_methods_gateway_fkey
  foreign key (gateway_id) references public.payment_gateways (id) on delete set null;

alter table public.client_payment_methods
  add constraint client_payment_methods_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.client_payment_methods
  add constraint client_payment_methods_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.payment_intents
  add constraint payment_intents_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.payment_intents
  add constraint payment_intents_client_fkey
  foreign key (client_id) references public.clients (id) on delete set null;

alter table public.payment_intents
  add constraint payment_intents_invoice_fkey
  foreign key (invoice_id) references public.invoices (id) on delete set null;

alter table public.payment_intents
  add constraint payment_intents_gateway_fkey
  foreign key (gateway_id) references public.payment_gateways (id) on delete set null;

alter table public.payment_intents
  add constraint payment_intents_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.payments
  add constraint payments_company_fkey
  foreign key (company_id) references public.companies (id) on delete restrict;

alter table public.payments
  add constraint payments_client_fkey
  foreign key (client_id) references public.clients (id) on delete set null;

alter table public.payments
  add constraint payments_gateway_fkey
  foreign key (gateway_id) references public.payment_gateways (id) on delete set null;

alter table public.payments
  add constraint payments_intent_fkey
  foreign key (payment_intent_id) references public.payment_intents (id) on delete set null;

alter table public.payments
  add constraint payments_method_fkey
  foreign key (client_payment_method_id)
  references public.client_payment_methods (id) on delete set null;

alter table public.payments
  add constraint payments_recorded_by_fkey
  foreign key (recorded_by) references public.users (id) on delete set null;

alter table public.payments
  add constraint payments_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.payments
  add constraint payments_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.payment_allocations
  add constraint payment_allocations_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.payment_allocations
  add constraint payment_allocations_payment_fkey
  foreign key (payment_id) references public.payments (id) on delete restrict;

alter table public.payment_allocations
  add constraint payment_allocations_invoice_fkey
  foreign key (invoice_id) references public.invoices (id) on delete restrict;

alter table public.payment_allocations
  add constraint payment_allocations_payment_same_company_fkey
  foreign key (payment_id, company_id) references public.payments (id, company_id);

alter table public.payment_allocations
  add constraint payment_allocations_invoice_same_company_fkey
  foreign key (invoice_id, company_id) references public.invoices (id, company_id);

alter table public.payment_allocations
  add constraint payment_allocations_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.payment_receipts
  add constraint payment_receipts_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.payment_receipts
  add constraint payment_receipts_payment_fkey
  foreign key (payment_id) references public.payments (id) on delete restrict;

alter table public.payment_receipts
  add constraint payment_receipts_client_fkey
  foreign key (client_id) references public.clients (id) on delete set null;

alter table public.payment_receipts
  add constraint payment_receipts_snapshot_fkey
  foreign key (company_profile_snapshot_id)
  references public.company_profile_snapshots (id) on delete restrict;

alter table public.payment_receipts
  add constraint payment_receipts_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.payment_receipts
  add constraint payment_receipts_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.refunds
  add constraint refunds_company_fkey
  foreign key (company_id) references public.companies (id) on delete restrict;

alter table public.refunds
  add constraint refunds_payment_fkey
  foreign key (payment_id) references public.payments (id) on delete restrict;

alter table public.refunds
  add constraint refunds_invoice_fkey
  foreign key (invoice_id) references public.invoices (id) on delete set null;

alter table public.refunds
  add constraint refunds_credit_note_fkey
  foreign key (credit_note_id) references public.credit_notes (id) on delete set null;

alter table public.refunds
  add constraint refunds_client_fkey
  foreign key (client_id) references public.clients (id) on delete set null;

alter table public.refunds
  add constraint refunds_requested_by_fkey
  foreign key (requested_by) references public.users (id) on delete set null;

alter table public.refunds
  add constraint refunds_approved_by_fkey
  foreign key (approved_by) references public.users (id) on delete set null;

alter table public.refunds
  add constraint refunds_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.refunds
  add constraint refunds_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.disputes
  add constraint disputes_company_fkey
  foreign key (company_id) references public.companies (id) on delete restrict;

alter table public.disputes
  add constraint disputes_payment_fkey
  foreign key (payment_id) references public.payments (id) on delete restrict;

alter table public.disputes
  add constraint disputes_invoice_fkey
  foreign key (invoice_id) references public.invoices (id) on delete set null;

alter table public.disputes
  add constraint disputes_client_fkey
  foreign key (client_id) references public.clients (id) on delete set null;

alter table public.disputes
  add constraint disputes_submitted_by_fkey
  foreign key (submitted_by) references public.users (id) on delete set null;

alter table public.disputes
  add constraint disputes_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.disputes
  add constraint disputes_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.dispute_evidence_items
  add constraint dispute_evidence_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.dispute_evidence_items
  add constraint dispute_evidence_dispute_fkey
  foreign key (dispute_id) references public.disputes (id) on delete cascade;

alter table public.dispute_evidence_items
  add constraint dispute_evidence_collected_by_fkey
  foreign key (collected_by) references public.users (id) on delete set null;

alter table public.webhook_events
  add constraint webhook_events_company_fkey
  foreign key (company_id) references public.companies (id) on delete set null;

alter table public.webhook_events
  add constraint webhook_events_gateway_fkey
  foreign key (gateway_id) references public.payment_gateways (id) on delete set null;

alter table public.webhook_events
  add constraint webhook_events_resolved_by_fkey
  foreign key (resolved_by) references public.users (id) on delete set null;

alter table public.wallets
  add constraint wallets_company_fkey
  foreign key (company_id) references public.companies (id) on delete restrict;

alter table public.wallets
  add constraint wallets_reseller_fkey
  foreign key (reseller_id) references public.resellers (id) on delete restrict;

alter table public.wallets
  add constraint wallets_user_fkey
  foreign key (user_id) references public.users (id) on delete restrict;

alter table public.wallets
  add constraint wallets_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.wallets
  add constraint wallets_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.wallet_transactions
  add constraint wallet_transactions_wallet_fkey
  foreign key (wallet_id) references public.wallets (id) on delete restrict;

alter table public.wallet_transactions
  add constraint wallet_transactions_company_fkey
  foreign key (company_id) references public.companies (id) on delete set null;

alter table public.wallet_transactions
  add constraint wallet_transactions_payment_fkey
  foreign key (payment_id) references public.payments (id) on delete set null;

alter table public.wallet_transactions
  add constraint wallet_transactions_refund_fkey
  foreign key (refund_id) references public.refunds (id) on delete set null;

alter table public.wallet_transactions
  add constraint wallet_transactions_dispute_fkey
  foreign key (dispute_id) references public.disputes (id) on delete set null;

alter table public.wallet_transactions
  add constraint wallet_transactions_payout_fkey
  foreign key (payout_id) references public.payouts (id) on delete set null;

alter table public.wallet_transactions
  add constraint wallet_transactions_invoice_fkey
  foreign key (invoice_id) references public.invoices (id) on delete set null;

alter table public.wallet_transactions
  add constraint wallet_transactions_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.payout_accounts
  add constraint payout_accounts_wallet_fkey
  foreign key (wallet_id) references public.wallets (id) on delete cascade;

alter table public.payout_accounts
  add constraint payout_accounts_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.payout_accounts
  add constraint payout_accounts_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.payout_accounts
  add constraint payout_accounts_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.payouts
  add constraint payouts_wallet_fkey
  foreign key (wallet_id) references public.wallets (id) on delete restrict;

alter table public.payouts
  add constraint payouts_account_fkey
  foreign key (payout_account_id) references public.payout_accounts (id) on delete set null;

alter table public.payouts
  add constraint payouts_company_fkey
  foreign key (company_id) references public.companies (id) on delete set null;

alter table public.payouts
  add constraint payouts_requested_by_fkey
  foreign key (requested_by) references public.users (id) on delete set null;

alter table public.payouts
  add constraint payouts_reviewed_by_fkey
  foreign key (reviewed_by) references public.users (id) on delete set null;

alter table public.payouts
  add constraint payouts_approved_by_fkey
  foreign key (approved_by) references public.users (id) on delete set null;

alter table public.payouts
  add constraint payouts_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.payouts
  add constraint payouts_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.payments
  add constraint payments_bank_transaction_check
  check (bank_transaction_id is null or reconciled_at is not null);

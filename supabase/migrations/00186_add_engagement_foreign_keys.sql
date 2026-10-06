-- supabase/migrations/00186_add_engagement_foreign_keys.sql
-- The relationships of messaging, bank feeds, receipts, instalments and points.

-- -----------------------------------------------------------------------------
-- Messaging
-- -----------------------------------------------------------------------------

alter table public.messaging_channels
  add constraint messaging_channels_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint messaging_channels_credential_fk
    foreign key (credential_id) references public.integration_credentials (id)
      on delete set null,
  add constraint messaging_channels_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint messaging_channels_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.contact_channel_identities
  add constraint contact_channel_identities_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint contact_channel_identities_client_fk
    foreign key (client_id) references public.clients (id) on delete cascade,
  add constraint contact_channel_identities_user_fk
    foreign key (user_id) references public.users (id) on delete cascade,
  add constraint contact_channel_identities_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint contact_channel_identities_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.channel_suppressions
  add constraint channel_suppressions_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint channel_suppressions_released_by_fk
    foreign key (released_by) references public.users (id) on delete set null;

alter table public.message_routes
  add constraint message_routes_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint message_routes_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint message_routes_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.message_route_steps
  add constraint message_route_steps_route_fk
    foreign key (route_id) references public.message_routes (id) on delete cascade;

alter table public.message_route_runs
  add constraint message_route_runs_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint message_route_runs_route_fk
    foreign key (route_id) references public.message_routes (id) on delete cascade,
  add constraint message_route_runs_client_fk
    foreign key (client_id) references public.clients (id) on delete cascade,
  add constraint message_route_runs_user_fk
    foreign key (user_id) references public.users (id) on delete cascade,
  add constraint message_route_runs_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null;

alter table public.messages
  add constraint messages_route_run_fk
    foreign key (route_run_id) references public.message_route_runs (id)
      on delete set null;

alter table public.inbound_messages
  add constraint inbound_messages_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint inbound_messages_client_fk
    foreign key (client_id) references public.clients (id) on delete set null,
  add constraint inbound_messages_message_fk
    foreign key (related_message_id) references public.messages (id)
      on delete set null,
  add constraint inbound_messages_route_run_fk
    foreign key (route_run_id) references public.message_route_runs (id)
      on delete set null,
  add constraint inbound_messages_handled_by_fk
    foreign key (handled_by) references public.users (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Bank feeds and reconciliation
-- -----------------------------------------------------------------------------

alter table public.bank_feed_connections
  add constraint bank_feed_connections_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint bank_feed_connections_credential_fk
    foreign key (credential_id) references public.integration_credentials (id)
      on delete set null,
  add constraint bank_feed_connections_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint bank_feed_connections_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.bank_feed_accounts
  add constraint bank_feed_accounts_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint bank_feed_accounts_connection_fk
    foreign key (connection_id) references public.bank_feed_connections (id)
      on delete cascade,
  add constraint bank_feed_accounts_bank_account_fk
    foreign key (bank_account_id) references public.bank_accounts (id)
      on delete set null;

alter table public.bank_feed_syncs
  add constraint bank_feed_syncs_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint bank_feed_syncs_connection_fk
    foreign key (connection_id) references public.bank_feed_connections (id)
      on delete cascade,
  add constraint bank_feed_syncs_feed_account_fk
    foreign key (feed_account_id) references public.bank_feed_accounts (id)
      on delete set null;

alter table public.bank_transaction_splits
  add constraint bank_transaction_splits_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint bank_transaction_splits_transaction_fk
    foreign key (bank_transaction_id) references public.bank_transactions (id)
      on delete cascade,
  add constraint bank_transaction_splits_ledger_account_fk
    foreign key (ledger_account_id) references public.ledger_accounts (id)
      on delete set null,
  add constraint bank_transaction_splits_category_fk
    foreign key (expense_category_id) references public.expense_categories (id)
      on delete set null,
  add constraint bank_transaction_splits_vendor_fk
    foreign key (vendor_id) references public.vendors (id) on delete set null,
  add constraint bank_transaction_splits_client_fk
    foreign key (client_id) references public.clients (id) on delete set null,
  add constraint bank_transaction_splits_project_fk
    foreign key (project_id) references public.projects (id) on delete set null,
  add constraint bank_transaction_splits_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null;

alter table public.reconciliation_memory
  add constraint reconciliation_memory_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint reconciliation_memory_ledger_account_fk
    foreign key (ledger_account_id) references public.ledger_accounts (id)
      on delete set null,
  add constraint reconciliation_memory_category_fk
    foreign key (expense_category_id) references public.expense_categories (id)
      on delete set null,
  add constraint reconciliation_memory_vendor_fk
    foreign key (vendor_id) references public.vendors (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Receipts
-- -----------------------------------------------------------------------------

alter table public.receipt_scans
  add constraint receipt_scans_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint receipt_scans_uploaded_by_fk
    foreign key (uploaded_by) references public.users (id) on delete set null,
  add constraint receipt_scans_reviewed_by_fk
    foreign key (reviewed_by) references public.users (id) on delete set null,
  add constraint receipt_scans_expense_fk
    foreign key (expense_id) references public.expenses (id) on delete set null,
  add constraint receipt_scans_duplicate_fk
    foreign key (duplicate_of_scan_id) references public.receipt_scans (id)
      on delete set null;

alter table public.receipt_scan_lines
  add constraint receipt_scan_lines_scan_fk
    foreign key (scan_id) references public.receipt_scans (id) on delete cascade,
  add constraint receipt_scan_lines_category_fk
    foreign key (suggested_category_id) references public.expense_categories (id)
      on delete set null;

-- -----------------------------------------------------------------------------
-- Instalments
-- -----------------------------------------------------------------------------

alter table public.instalment_offers
  add constraint instalment_offers_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint instalment_offers_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint instalment_offers_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.instalment_plans
  add constraint instalment_plans_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint instalment_plans_invoice_fk
    foreign key (invoice_id) references public.invoices (id) on delete cascade,
  add constraint instalment_plans_client_fk
    foreign key (client_id) references public.clients (id) on delete set null,
  add constraint instalment_plans_offer_fk
    foreign key (offer_id) references public.instalment_offers (id)
      on delete set null,
  add constraint instalment_plans_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint instalment_plans_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.instalment_schedule_items
  add constraint instalment_schedule_items_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint instalment_schedule_items_plan_fk
    foreign key (plan_id) references public.instalment_plans (id)
      on delete cascade,
  add constraint instalment_schedule_items_payment_fk
    foreign key (payment_id) references public.payments (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Loyalty
-- -----------------------------------------------------------------------------

alter table public.loyalty_programs
  add constraint loyalty_programs_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint loyalty_programs_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint loyalty_programs_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.loyalty_accounts
  add constraint loyalty_accounts_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint loyalty_accounts_program_fk
    foreign key (program_id) references public.loyalty_programs (id)
      on delete cascade,
  add constraint loyalty_accounts_client_fk
    foreign key (client_id) references public.clients (id) on delete cascade;

alter table public.loyalty_transactions
  add constraint loyalty_transactions_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint loyalty_transactions_account_fk
    foreign key (account_id) references public.loyalty_accounts (id)
      on delete cascade,
  add constraint loyalty_transactions_payment_fk
    foreign key (payment_id) references public.payments (id) on delete set null,
  add constraint loyalty_transactions_invoice_fk
    foreign key (invoice_id) references public.invoices (id) on delete set null,
  add constraint loyalty_transactions_reward_fk
    foreign key (reward_id) references public.loyalty_rewards (id)
      on delete set null,
  add constraint loyalty_transactions_redemption_fk
    foreign key (redemption_id) references public.loyalty_redemptions (id)
      on delete set null,
  add constraint loyalty_transactions_reversal_fk
    foreign key (reversal_of_id) references public.loyalty_transactions (id)
      on delete set null,
  add constraint loyalty_transactions_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null;

alter table public.loyalty_rewards
  add constraint loyalty_rewards_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint loyalty_rewards_program_fk
    foreign key (program_id) references public.loyalty_programs (id)
      on delete cascade,
  add constraint loyalty_rewards_product_fk
    foreign key (product_id) references public.products (id) on delete set null,
  add constraint loyalty_rewards_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint loyalty_rewards_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.loyalty_redemptions
  add constraint loyalty_redemptions_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint loyalty_redemptions_account_fk
    foreign key (account_id) references public.loyalty_accounts (id)
      on delete cascade,
  add constraint loyalty_redemptions_reward_fk
    foreign key (reward_id) references public.loyalty_rewards (id)
      on delete restrict,
  add constraint loyalty_redemptions_invoice_fk
    foreign key (applied_to_invoice_id) references public.invoices (id)
      on delete set null,
  add constraint loyalty_redemptions_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null;

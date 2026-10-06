-- supabase/migrations/00170_phase18_rls_isolation.sql
-- Phase 18: RLS part 2 for every table not covered by Phase 17, including
-- accounting, inventory, communication, ecommerce, KYC, wallet, partner,
-- admin, tax, project, contract, loyalty, and platform data boundaries.
-- All browser-role policies are default-deny, company-scoped, and soft-delete aware.

create function public.current_user_is_accountant_for_company(p_company_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.accountant_company_access as a join public.companies as c on c.id = a.company_id where a.company_id = p_company_id and a.accountant_user_id = (select auth.uid()) and a.is_active and a.deleted_at is null and c.deleted_at is null);
$$;
comment on function public.current_user_is_accountant_for_company(uuid) is 'Returns true for an active accountant-company delegation without granting global tenant visibility.';

create function public.current_user_can_read_domain(p_company_id uuid, p_domain text)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if public.is_super_admin() then return true; end if;
  if p_domain = 'accounting' then return public.current_user_owns_company(p_company_id) or public.current_user_is_accountant_for_company(p_company_id) or public.current_user_has_company_permission(p_company_id, 'read:manage_expenses') or public.current_user_has_company_permission(p_company_id, 'read:view_reports'); end if;
  if p_domain = 'journal' then return public.current_user_owns_company(p_company_id) or public.current_user_is_accountant_for_company(p_company_id); end if;
  if p_domain = 'inventory' then return public.current_user_owns_company(p_company_id) or public.current_user_has_company_permission(p_company_id, 'read:manage_inventory') or public.current_user_has_company_permission(p_company_id, 'read:manage_products'); end if;
  if p_domain = 'support' then return public.current_user_has_company_access(p_company_id); end if;
  if p_domain = 'tax' then return public.current_user_owns_company(p_company_id) or public.current_user_is_accountant_for_company(p_company_id); end if;
  if p_domain = 'accountant' then return public.current_user_owns_company(p_company_id) or public.current_user_is_accountant_for_company(p_company_id); end if;
  return public.current_user_owns_company(p_company_id);
end;
$$;
comment on function public.current_user_can_read_domain(uuid, text) is 'Maps a database domain to the narrowest Phase 18 read boundary; super_admin is the only global bypass.';

create function public.current_user_can_write_domain(p_company_id uuid, p_domain text)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if public.is_super_admin() then return true; end if;
  if p_domain = 'accounting' then return public.current_user_has_company_permission(p_company_id, 'manage_expenses'); end if;
  if p_domain = 'journal' then return public.current_user_can_manage_company(p_company_id) or (public.current_user_is_accountant_for_company(p_company_id) and exists (select 1 from public.companies where id = p_company_id and not is_suspended and deleted_at is null)); end if;
  if p_domain = 'inventory' then return public.current_user_has_company_permission(p_company_id, 'manage_inventory') or public.current_user_has_company_permission(p_company_id, 'manage_products'); end if;
  if p_domain = 'support' then return public.current_user_can_manage_company(p_company_id); end if;
  if p_domain = 'tax' then return public.current_user_can_manage_company(p_company_id); end if;
  return public.current_user_can_manage_company(p_company_id);
end;
$$;
comment on function public.current_user_can_write_domain(uuid, text) is 'Maps a database domain to a non-suspended write boundary; provider callbacks and immutable ledgers remain service-role-only.';

revoke all on function public.current_user_is_accountant_for_company(uuid) from public;
grant execute on function public.current_user_is_accountant_for_company(uuid) to authenticated, service_role;
revoke all on function public.current_user_can_read_domain(uuid, text) from public;
grant execute on function public.current_user_can_read_domain(uuid, text) to authenticated, service_role;
revoke all on function public.current_user_can_write_domain(uuid, text) from public;
grant execute on function public.current_user_can_write_domain(uuid, text) to authenticated, service_role;

-- RLS inventory: every remaining Phase 18 table is listed exactly once here.
do $$
declare table_name text;
begin
  foreach table_name in array ARRAY['expense_categories', 'expenses', 'recurring_expenses', 'income', 'tax_rates', 'chart_of_accounts', 'journal_entries', 'journal_entry_lines', 'bills', 'bill_line_items', 'bank_accounts', 'bank_transactions', 'bank_matching_rules', 'bank_reconciliation_logs', 'product_categories', 'products', 'product_bundles', 'product_bundle_items', 'warehouses', 'warehouse_stock_levels', 'stock_movements', 'stock_transfers', 'stock_transfer_line_items', 'suppliers', 'purchase_orders', 'purchase_order_line_items', 'communication_channels', 'whatsapp_templates', 'email_templates', 'notifications', 'notification_preferences', 'client_communication_preferences', 'message_deliveries', 'message_delivery_events', 'communication_automation_rules', 'communication_campaigns', 'communication_campaign_recipients', 'communication_webhook_events', 'ecommerce_connections', 'ecommerce_product_mappings', 'ecommerce_orders', 'ecommerce_order_line_items', 'ecommerce_webhook_events', 'ecommerce_sync_logs', 'direct_checkout_api_key_pairs', 'direct_checkout_webhook_endpoints', 'direct_checkout_sessions', 'kyc_submissions', 'kyc_documents', 'wallet_accounts', 'payment_holds', 'wallet_transactions', 'platform_fee_rules', 'platform_fee_charges', 'payout_destinations', 'payout_requests', 'mor_agreements', 'accountant_company_access', 'reseller_profiles', 'reseller_sub_tenants', 'affiliate_profiles', 'affiliate_clicks', 'affiliate_referrals', 'affiliate_commissions', 'affiliate_payout_requests', 'coupons', 'coupon_redemptions', 'audit_logs', 'cms_pages', 'cms_page_revisions', 'blog_categories', 'blog_tags', 'blog_posts', 'blog_post_tags', 'faq_items', 'branding_settings', 'announcement_bars', 'status_services', 'status_incidents', 'status_incident_updates', 'api_keys', 'api_usage_logs', 'outgoing_webhook_endpoints', 'outgoing_webhook_deliveries', 'support_tickets', 'support_ticket_messages', 'gdpr_requests', 'backups', 'exchange_rates', 'projects', 'project_members', 'time_entries', 'contract_templates', 'contracts', 'contract_signers', 'contract_signature_events', 'bnpl_applications', 'bnpl_installments', 'loyalty_programs', 'loyalty_accounts', 'loyalty_transactions', 'review_requests', 'platform_tax_compliance_settings', 'tax_jurisdiction_rules', 'payee_tax_profiles', 'company_tax_registrations', 'tax_transaction_records', 'tax_return_periods', 'tax_document_runs', 'tax_document_rows', 'tax_compliance_events', 'tax_withholding_entries', 'email_suppressions', 'security_rate_limit_buckets'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', table_name);
  end loop;
end;
$$;

-- Required company_id tables use domain-specific read/write policies.
grant select, insert, update on public.expense_categories to authenticated;
create policy phase18_expense_categories_select
  on public.expense_categories for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'accounting')) and deleted_at is null));
create policy phase18_expense_categories_insert
  on public.expense_categories for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));
create policy phase18_expense_categories_update
  on public.expense_categories for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'accounting')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));

grant select, insert, update on public.expenses to authenticated;
create policy phase18_expenses_select
  on public.expenses for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'accounting')) and deleted_at is null));
create policy phase18_expenses_insert
  on public.expenses for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));
create policy phase18_expenses_update
  on public.expenses for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'accounting')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));

grant select, insert, update on public.recurring_expenses to authenticated;
create policy phase18_recurring_expenses_select
  on public.recurring_expenses for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'accounting')) and deleted_at is null));
create policy phase18_recurring_expenses_insert
  on public.recurring_expenses for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));
create policy phase18_recurring_expenses_update
  on public.recurring_expenses for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'accounting')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));

grant select, insert, update on public.income to authenticated;
create policy phase18_income_select
  on public.income for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'accounting')) and deleted_at is null));
create policy phase18_income_insert
  on public.income for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));
create policy phase18_income_update
  on public.income for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'accounting')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));

grant select, insert, update on public.tax_rates to authenticated;
create policy phase18_tax_rates_select
  on public.tax_rates for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'accounting')) and deleted_at is null));
create policy phase18_tax_rates_insert
  on public.tax_rates for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));
create policy phase18_tax_rates_update
  on public.tax_rates for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'accounting')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));

grant select, insert, update on public.chart_of_accounts to authenticated;
create policy phase18_chart_of_accounts_select
  on public.chart_of_accounts for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'journal')) and deleted_at is null));
create policy phase18_chart_of_accounts_insert
  on public.chart_of_accounts for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'journal')));
create policy phase18_chart_of_accounts_update
  on public.chart_of_accounts for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'journal')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'journal')));

grant select, insert, update on public.journal_entries to authenticated;
create policy phase18_journal_entries_select
  on public.journal_entries for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'journal')) and deleted_at is null));
create policy phase18_journal_entries_insert
  on public.journal_entries for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'journal')));
create policy phase18_journal_entries_update
  on public.journal_entries for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'journal')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'journal')));

grant select, insert, update on public.journal_entry_lines to authenticated;
create policy phase18_journal_entry_lines_select
  on public.journal_entry_lines for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'journal')) and true));
create policy phase18_journal_entry_lines_insert
  on public.journal_entry_lines for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'journal')));
create policy phase18_journal_entry_lines_update
  on public.journal_entry_lines for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'journal')) and true))
  with check ((select public.current_user_can_write_domain(company_id, 'journal')));

grant select, insert, update on public.bills to authenticated;
create policy phase18_bills_select
  on public.bills for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'accounting')) and deleted_at is null));
create policy phase18_bills_insert
  on public.bills for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));
create policy phase18_bills_update
  on public.bills for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'accounting')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));

grant select, insert, update on public.bill_line_items to authenticated;
create policy phase18_bill_line_items_select
  on public.bill_line_items for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'accounting')) and deleted_at is null));
create policy phase18_bill_line_items_insert
  on public.bill_line_items for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));
create policy phase18_bill_line_items_update
  on public.bill_line_items for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'accounting')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));

grant select, insert, update on public.bank_accounts to authenticated;
create policy phase18_bank_accounts_select
  on public.bank_accounts for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'accounting')) and deleted_at is null));
create policy phase18_bank_accounts_insert
  on public.bank_accounts for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));
create policy phase18_bank_accounts_update
  on public.bank_accounts for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'accounting')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));

grant select, insert, update on public.bank_transactions to authenticated;
create policy phase18_bank_transactions_select
  on public.bank_transactions for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'accounting')) and deleted_at is null));
create policy phase18_bank_transactions_insert
  on public.bank_transactions for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));
create policy phase18_bank_transactions_update
  on public.bank_transactions for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'accounting')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));

grant select, insert, update on public.bank_matching_rules to authenticated;
create policy phase18_bank_matching_rules_select
  on public.bank_matching_rules for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'accounting')) and deleted_at is null));
create policy phase18_bank_matching_rules_insert
  on public.bank_matching_rules for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));
create policy phase18_bank_matching_rules_update
  on public.bank_matching_rules for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'accounting')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'accounting')));

grant select on public.bank_reconciliation_logs to authenticated;
create policy phase18_bank_reconciliation_logs_select
  on public.bank_reconciliation_logs for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'accounting')) and true));

grant select, insert, update on public.product_categories to authenticated;
create policy phase18_product_categories_select
  on public.product_categories for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'inventory')) and deleted_at is null));
create policy phase18_product_categories_insert
  on public.product_categories for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));
create policy phase18_product_categories_update
  on public.product_categories for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'inventory')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));

grant select, insert, update on public.products to authenticated;
create policy phase18_products_select
  on public.products for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'inventory')) and deleted_at is null));
create policy phase18_products_insert
  on public.products for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));
create policy phase18_products_update
  on public.products for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'inventory')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));

grant select, insert, update on public.product_bundles to authenticated;
create policy phase18_product_bundles_select
  on public.product_bundles for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'inventory')) and deleted_at is null));
create policy phase18_product_bundles_insert
  on public.product_bundles for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));
create policy phase18_product_bundles_update
  on public.product_bundles for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'inventory')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));

grant select, insert, update on public.product_bundle_items to authenticated;
create policy phase18_product_bundle_items_select
  on public.product_bundle_items for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'inventory')) and deleted_at is null));
create policy phase18_product_bundle_items_insert
  on public.product_bundle_items for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));
create policy phase18_product_bundle_items_update
  on public.product_bundle_items for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'inventory')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));

grant select, insert, update on public.warehouses to authenticated;
create policy phase18_warehouses_select
  on public.warehouses for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'inventory')) and deleted_at is null));
create policy phase18_warehouses_insert
  on public.warehouses for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));
create policy phase18_warehouses_update
  on public.warehouses for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'inventory')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));

grant select on public.warehouse_stock_levels to authenticated;
create policy phase18_warehouse_stock_levels_select
  on public.warehouse_stock_levels for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'inventory')) and deleted_at is null));

grant select on public.stock_movements to authenticated;
create policy phase18_stock_movements_select
  on public.stock_movements for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'inventory')) and deleted_at is null));

grant select, insert, update on public.stock_transfers to authenticated;
create policy phase18_stock_transfers_select
  on public.stock_transfers for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'inventory')) and deleted_at is null));
create policy phase18_stock_transfers_insert
  on public.stock_transfers for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));
create policy phase18_stock_transfers_update
  on public.stock_transfers for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'inventory')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));

grant select, insert, update on public.stock_transfer_line_items to authenticated;
create policy phase18_stock_transfer_line_items_select
  on public.stock_transfer_line_items for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'inventory')) and deleted_at is null));
create policy phase18_stock_transfer_line_items_insert
  on public.stock_transfer_line_items for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));
create policy phase18_stock_transfer_line_items_update
  on public.stock_transfer_line_items for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'inventory')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));

grant select, insert, update on public.suppliers to authenticated;
create policy phase18_suppliers_select
  on public.suppliers for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'inventory')) and deleted_at is null));
create policy phase18_suppliers_insert
  on public.suppliers for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));
create policy phase18_suppliers_update
  on public.suppliers for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'inventory')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));

grant select, insert, update on public.purchase_orders to authenticated;
create policy phase18_purchase_orders_select
  on public.purchase_orders for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'inventory')) and deleted_at is null));
create policy phase18_purchase_orders_insert
  on public.purchase_orders for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));
create policy phase18_purchase_orders_update
  on public.purchase_orders for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'inventory')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));

grant select, insert, update on public.purchase_order_line_items to authenticated;
create policy phase18_purchase_order_line_items_select
  on public.purchase_order_line_items for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'inventory')) and deleted_at is null));
create policy phase18_purchase_order_line_items_insert
  on public.purchase_order_line_items for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));
create policy phase18_purchase_order_line_items_update
  on public.purchase_order_line_items for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'inventory')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'inventory')));

grant select, insert, update on public.communication_channels to authenticated;
create policy phase18_communication_channels_select
  on public.communication_channels for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'communication')) and deleted_at is null));
create policy phase18_communication_channels_insert
  on public.communication_channels for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'communication')));
create policy phase18_communication_channels_update
  on public.communication_channels for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'communication')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'communication')));

grant select on public.notifications to authenticated;
create policy phase18_notifications_select
  on public.notifications for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'communication')) and deleted_at is null));

grant select, insert, update on public.client_communication_preferences to authenticated;
create policy phase18_client_communication_preferences_select
  on public.client_communication_preferences for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'communication')) and deleted_at is null));
create policy phase18_client_communication_preferences_insert
  on public.client_communication_preferences for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'communication')));
create policy phase18_client_communication_preferences_update
  on public.client_communication_preferences for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'communication')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'communication')));

grant select on public.message_deliveries to authenticated;
create policy phase18_message_deliveries_select
  on public.message_deliveries for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'communication')) and deleted_at is null));

grant select on public.message_delivery_events to authenticated;
create policy phase18_message_delivery_events_select
  on public.message_delivery_events for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'communication')) and true));

grant select, insert, update on public.communication_automation_rules to authenticated;
create policy phase18_communication_automation_rules_select
  on public.communication_automation_rules for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'communication')) and deleted_at is null));
create policy phase18_communication_automation_rules_insert
  on public.communication_automation_rules for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'communication')));
create policy phase18_communication_automation_rules_update
  on public.communication_automation_rules for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'communication')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'communication')));

grant select, insert, update on public.communication_campaigns to authenticated;
create policy phase18_communication_campaigns_select
  on public.communication_campaigns for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'communication')) and deleted_at is null));
create policy phase18_communication_campaigns_insert
  on public.communication_campaigns for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'communication')));
create policy phase18_communication_campaigns_update
  on public.communication_campaigns for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'communication')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'communication')));

grant select, insert, update on public.communication_campaign_recipients to authenticated;
create policy phase18_communication_campaign_recipients_select
  on public.communication_campaign_recipients for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'communication')) and deleted_at is null));
create policy phase18_communication_campaign_recipients_insert
  on public.communication_campaign_recipients for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'communication')));
create policy phase18_communication_campaign_recipients_update
  on public.communication_campaign_recipients for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'communication')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'communication')));

grant select, insert, update on public.ecommerce_connections to authenticated;
create policy phase18_ecommerce_connections_select
  on public.ecommerce_connections for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'ecommerce')) and deleted_at is null));
create policy phase18_ecommerce_connections_insert
  on public.ecommerce_connections for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'ecommerce')));
create policy phase18_ecommerce_connections_update
  on public.ecommerce_connections for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'ecommerce')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'ecommerce')));

grant select, insert, update on public.ecommerce_product_mappings to authenticated;
create policy phase18_ecommerce_product_mappings_select
  on public.ecommerce_product_mappings for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'ecommerce')) and deleted_at is null));
create policy phase18_ecommerce_product_mappings_insert
  on public.ecommerce_product_mappings for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'ecommerce')));
create policy phase18_ecommerce_product_mappings_update
  on public.ecommerce_product_mappings for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'ecommerce')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'ecommerce')));

grant select on public.ecommerce_orders to authenticated;
create policy phase18_ecommerce_orders_select
  on public.ecommerce_orders for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'ecommerce')) and deleted_at is null));

grant select on public.ecommerce_order_line_items to authenticated;
create policy phase18_ecommerce_order_line_items_select
  on public.ecommerce_order_line_items for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'ecommerce')) and deleted_at is null));

grant select on public.ecommerce_webhook_events to authenticated;
create policy phase18_ecommerce_webhook_events_select
  on public.ecommerce_webhook_events for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'ecommerce')) and true));

grant select on public.ecommerce_sync_logs to authenticated;
create policy phase18_ecommerce_sync_logs_select
  on public.ecommerce_sync_logs for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'ecommerce')) and true));

grant select, insert, update on public.direct_checkout_api_key_pairs to authenticated;
create policy phase18_direct_checkout_api_key_pairs_select
  on public.direct_checkout_api_key_pairs for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'ecommerce')) and deleted_at is null));
create policy phase18_direct_checkout_api_key_pairs_insert
  on public.direct_checkout_api_key_pairs for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'ecommerce')));
create policy phase18_direct_checkout_api_key_pairs_update
  on public.direct_checkout_api_key_pairs for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'ecommerce')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'ecommerce')));

grant select, insert, update on public.direct_checkout_webhook_endpoints to authenticated;
create policy phase18_direct_checkout_webhook_endpoints_select
  on public.direct_checkout_webhook_endpoints for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'ecommerce')) and deleted_at is null));
create policy phase18_direct_checkout_webhook_endpoints_insert
  on public.direct_checkout_webhook_endpoints for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'ecommerce')));
create policy phase18_direct_checkout_webhook_endpoints_update
  on public.direct_checkout_webhook_endpoints for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'ecommerce')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'ecommerce')));

grant select on public.direct_checkout_sessions to authenticated;
create policy phase18_direct_checkout_sessions_select
  on public.direct_checkout_sessions for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'ecommerce')) and true));

grant select, insert, update on public.kyc_submissions to authenticated;
create policy phase18_kyc_submissions_select
  on public.kyc_submissions for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'kyc')) and deleted_at is null));
create policy phase18_kyc_submissions_insert
  on public.kyc_submissions for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'kyc')));
create policy phase18_kyc_submissions_update
  on public.kyc_submissions for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'kyc')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'kyc')));

grant select on public.kyc_documents to authenticated;
create policy phase18_kyc_documents_select
  on public.kyc_documents for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'kyc')) and deleted_at is null));

grant select on public.wallet_accounts to authenticated;
create policy phase18_wallet_accounts_select
  on public.wallet_accounts for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'wallet')) and deleted_at is null));

grant select on public.payment_holds to authenticated;
create policy phase18_payment_holds_select
  on public.payment_holds for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'wallet')) and deleted_at is null));

grant select on public.wallet_transactions to authenticated;
create policy phase18_wallet_transactions_select
  on public.wallet_transactions for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'wallet')) and true));

grant select on public.platform_fee_charges to authenticated;
create policy phase18_platform_fee_charges_select
  on public.platform_fee_charges for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'wallet')) and true));

grant select, insert, update on public.payout_destinations to authenticated;
create policy phase18_payout_destinations_select
  on public.payout_destinations for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'wallet')) and deleted_at is null));
create policy phase18_payout_destinations_insert
  on public.payout_destinations for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'wallet')));
create policy phase18_payout_destinations_update
  on public.payout_destinations for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'wallet')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'wallet')));

grant select, insert, update on public.payout_requests to authenticated;
create policy phase18_payout_requests_select
  on public.payout_requests for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'wallet')) and deleted_at is null));
create policy phase18_payout_requests_insert
  on public.payout_requests for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'wallet')));
create policy phase18_payout_requests_update
  on public.payout_requests for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'wallet')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'wallet')));

grant select, insert, update on public.mor_agreements to authenticated;
create policy phase18_mor_agreements_select
  on public.mor_agreements for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'wallet')) and deleted_at is null));
create policy phase18_mor_agreements_insert
  on public.mor_agreements for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'wallet')));
create policy phase18_mor_agreements_update
  on public.mor_agreements for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'wallet')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'wallet')));

grant select on public.api_usage_logs to authenticated;
create policy phase18_api_usage_logs_select
  on public.api_usage_logs for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and true));

grant select, insert, update on public.outgoing_webhook_endpoints to authenticated;
create policy phase18_outgoing_webhook_endpoints_select
  on public.outgoing_webhook_endpoints for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and deleted_at is null));
create policy phase18_outgoing_webhook_endpoints_insert
  on public.outgoing_webhook_endpoints for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_outgoing_webhook_endpoints_update
  on public.outgoing_webhook_endpoints for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select on public.outgoing_webhook_deliveries to authenticated;
create policy phase18_outgoing_webhook_deliveries_select
  on public.outgoing_webhook_deliveries for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and true));

grant select, insert, update on public.projects to authenticated;
create policy phase18_projects_select
  on public.projects for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and deleted_at is null));
create policy phase18_projects_insert
  on public.projects for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_projects_update
  on public.projects for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select, insert, update on public.project_members to authenticated;
create policy phase18_project_members_select
  on public.project_members for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and deleted_at is null));
create policy phase18_project_members_insert
  on public.project_members for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_project_members_update
  on public.project_members for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select, insert, update on public.time_entries to authenticated;
create policy phase18_time_entries_select
  on public.time_entries for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and deleted_at is null));
create policy phase18_time_entries_insert
  on public.time_entries for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_time_entries_update
  on public.time_entries for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select, insert, update on public.contracts to authenticated;
create policy phase18_contracts_select
  on public.contracts for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and deleted_at is null));
create policy phase18_contracts_insert
  on public.contracts for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_contracts_update
  on public.contracts for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select on public.contract_signers to authenticated;
create policy phase18_contract_signers_select
  on public.contract_signers for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and true));

grant select on public.contract_signature_events to authenticated;
create policy phase18_contract_signature_events_select
  on public.contract_signature_events for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and true));

grant select, insert, update on public.bnpl_applications to authenticated;
create policy phase18_bnpl_applications_select
  on public.bnpl_applications for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and deleted_at is null));
create policy phase18_bnpl_applications_insert
  on public.bnpl_applications for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_bnpl_applications_update
  on public.bnpl_applications for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select on public.bnpl_installments to authenticated;
create policy phase18_bnpl_installments_select
  on public.bnpl_installments for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and true));

grant select, insert, update on public.loyalty_programs to authenticated;
create policy phase18_loyalty_programs_select
  on public.loyalty_programs for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and deleted_at is null));
create policy phase18_loyalty_programs_insert
  on public.loyalty_programs for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_loyalty_programs_update
  on public.loyalty_programs for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select on public.loyalty_accounts to authenticated;
create policy phase18_loyalty_accounts_select
  on public.loyalty_accounts for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and deleted_at is null));

grant select on public.loyalty_transactions to authenticated;
create policy phase18_loyalty_transactions_select
  on public.loyalty_transactions for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and true));

grant select on public.review_requests to authenticated;
create policy phase18_review_requests_select
  on public.review_requests for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and deleted_at is null));

grant select, insert, update on public.payee_tax_profiles to authenticated;
create policy phase18_payee_tax_profiles_select
  on public.payee_tax_profiles for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tax')) and deleted_at is null));
create policy phase18_payee_tax_profiles_insert
  on public.payee_tax_profiles for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tax')));
create policy phase18_payee_tax_profiles_update
  on public.payee_tax_profiles for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tax')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'tax')));

grant select, insert, update on public.company_tax_registrations to authenticated;
create policy phase18_company_tax_registrations_select
  on public.company_tax_registrations for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tax')) and deleted_at is null));
create policy phase18_company_tax_registrations_insert
  on public.company_tax_registrations for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tax')));
create policy phase18_company_tax_registrations_update
  on public.company_tax_registrations for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tax')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'tax')));

grant select on public.tax_transaction_records to authenticated;
create policy phase18_tax_transaction_records_select
  on public.tax_transaction_records for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tax')) and true));

grant select, insert, update on public.tax_return_periods to authenticated;
create policy phase18_tax_return_periods_select
  on public.tax_return_periods for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tax')) and true));
create policy phase18_tax_return_periods_insert
  on public.tax_return_periods for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tax')));
create policy phase18_tax_return_periods_update
  on public.tax_return_periods for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tax')) and true))
  with check ((select public.current_user_can_write_domain(company_id, 'tax')));

grant select on public.tax_document_rows to authenticated;
create policy phase18_tax_document_rows_select
  on public.tax_document_rows for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tax')) and true));

grant select on public.tax_withholding_entries to authenticated;
create policy phase18_tax_withholding_entries_select
  on public.tax_withholding_entries for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tax')) and true));

-- Nullable company_id tables never expose global rows through tenant policies.
grant select, insert, update on public.whatsapp_templates to authenticated;
create policy phase18_whatsapp_templates_select
  on public.whatsapp_templates for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and deleted_at is null));
create policy phase18_whatsapp_templates_insert
  on public.whatsapp_templates for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_whatsapp_templates_update
  on public.whatsapp_templates for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select, insert, update on public.email_templates to authenticated;
create policy phase18_email_templates_select
  on public.email_templates for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and deleted_at is null));
create policy phase18_email_templates_insert
  on public.email_templates for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_email_templates_update
  on public.email_templates for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select on public.communication_webhook_events to authenticated;
create policy phase18_communication_webhook_events_select
  on public.communication_webhook_events for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and true));

grant select, insert, update on public.platform_fee_rules to authenticated;
create policy phase18_platform_fee_rules_select
  on public.platform_fee_rules for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and deleted_at is null));
create policy phase18_platform_fee_rules_insert
  on public.platform_fee_rules for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_platform_fee_rules_update
  on public.platform_fee_rules for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select on public.audit_logs to authenticated;
create policy phase18_audit_logs_select
  on public.audit_logs for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and true));

grant select, insert, update on public.cms_pages to authenticated;
create policy phase18_cms_pages_select
  on public.cms_pages for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and deleted_at is null));
create policy phase18_cms_pages_insert
  on public.cms_pages for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_cms_pages_update
  on public.cms_pages for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select, insert, update on public.cms_page_revisions to authenticated;
create policy phase18_cms_page_revisions_select
  on public.cms_page_revisions for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and true));
create policy phase18_cms_page_revisions_insert
  on public.cms_page_revisions for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_cms_page_revisions_update
  on public.cms_page_revisions for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and true))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select, insert, update on public.blog_categories to authenticated;
create policy phase18_blog_categories_select
  on public.blog_categories for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and deleted_at is null));
create policy phase18_blog_categories_insert
  on public.blog_categories for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_blog_categories_update
  on public.blog_categories for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select, insert, update on public.blog_tags to authenticated;
create policy phase18_blog_tags_select
  on public.blog_tags for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and deleted_at is null));
create policy phase18_blog_tags_insert
  on public.blog_tags for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_blog_tags_update
  on public.blog_tags for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select, insert, update on public.blog_posts to authenticated;
create policy phase18_blog_posts_select
  on public.blog_posts for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and deleted_at is null));
create policy phase18_blog_posts_insert
  on public.blog_posts for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_blog_posts_update
  on public.blog_posts for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select, insert, update on public.blog_post_tags to authenticated;
create policy phase18_blog_post_tags_select
  on public.blog_post_tags for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and true));
create policy phase18_blog_post_tags_insert
  on public.blog_post_tags for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_blog_post_tags_update
  on public.blog_post_tags for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and true))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select, insert, update on public.faq_items to authenticated;
create policy phase18_faq_items_select
  on public.faq_items for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and deleted_at is null));
create policy phase18_faq_items_insert
  on public.faq_items for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_faq_items_update
  on public.faq_items for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select, insert, update on public.branding_settings to authenticated;
create policy phase18_branding_settings_select
  on public.branding_settings for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and true));
create policy phase18_branding_settings_insert
  on public.branding_settings for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_branding_settings_update
  on public.branding_settings for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and true))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select, insert, update on public.announcement_bars to authenticated;
create policy phase18_announcement_bars_select
  on public.announcement_bars for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and deleted_at is null));
create policy phase18_announcement_bars_insert
  on public.announcement_bars for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_announcement_bars_update
  on public.announcement_bars for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select, insert, update on public.support_tickets to authenticated;
create policy phase18_support_tickets_select
  on public.support_tickets for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'support')) and deleted_at is null));
create policy phase18_support_tickets_insert
  on public.support_tickets for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'support')));
create policy phase18_support_tickets_update
  on public.support_tickets for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'support')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'support')));

grant select, insert, update on public.gdpr_requests to authenticated;
create policy phase18_gdpr_requests_select
  on public.gdpr_requests for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and true));
create policy phase18_gdpr_requests_insert
  on public.gdpr_requests for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_gdpr_requests_update
  on public.gdpr_requests for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and true))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select on public.backups to authenticated;
create policy phase18_backups_select
  on public.backups for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and true));

grant select, insert, update on public.contract_templates to authenticated;
create policy phase18_contract_templates_select
  on public.contract_templates for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and deleted_at is null));
create policy phase18_contract_templates_insert
  on public.contract_templates for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_contract_templates_update
  on public.contract_templates for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and deleted_at is null))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

grant select on public.tax_compliance_events to authenticated;
create policy phase18_tax_compliance_events_select
  on public.tax_compliance_events for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and true));

grant select, insert, update on public.email_suppressions to authenticated;
create policy phase18_email_suppressions_select
  on public.email_suppressions for select to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_read_domain(company_id, 'tenant')) and true));
create policy phase18_email_suppressions_insert
  on public.email_suppressions for insert to authenticated
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));
create policy phase18_email_suppressions_update
  on public.email_suppressions for update to authenticated
  using ((select public.is_super_admin()) or (company_id is not null and (select public.current_user_can_write_domain(company_id, 'tenant')) and true))
  with check ((select public.current_user_can_write_domain(company_id, 'tenant')));

-- User-scoped preferences.
grant select, insert, update on public.notification_preferences to authenticated;
create policy phase18_notification_preferences_select on public.notification_preferences for select to authenticated using (user_id = (select auth.uid()) or (select public.is_super_admin()));
create policy phase18_notification_preferences_insert on public.notification_preferences for insert to authenticated with check (user_id = (select auth.uid()) or (select public.is_super_admin()));
create policy phase18_notification_preferences_update on public.notification_preferences for update to authenticated using (user_id = (select auth.uid()) or (select public.is_super_admin())) with check (user_id = (select auth.uid()) or (select public.is_super_admin()));

-- Status-page reads are public; only super_admin mutates platform status data.
grant select on public.status_services, public.status_incidents, public.status_incident_updates to anon, authenticated;
grant insert, update on public.status_services, public.status_incidents, public.status_incident_updates to authenticated;
create policy phase18_status_services_public_read on public.status_services for select to anon, authenticated using (is_public and deleted_at is null or (select public.is_super_admin()));
create policy phase18_status_incidents_public_read on public.status_incidents for select to anon, authenticated using (is_public and deleted_at is null or (select public.is_super_admin()));
create policy phase18_status_updates_public_read on public.status_incident_updates for select to anon, authenticated using (exists (select 1 from public.status_incidents i where i.id = status_incident_updates.incident_id and i.is_public and i.deleted_at is null) or (select public.is_super_admin()));
create policy phase18_status_services_admin_insert on public.status_services for insert to authenticated with check ((select public.is_super_admin()));
create policy phase18_status_services_admin_update on public.status_services for update to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy phase18_status_incidents_admin_insert on public.status_incidents for insert to authenticated with check ((select public.is_super_admin()));
create policy phase18_status_incidents_admin_update on public.status_incidents for update to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy phase18_status_incident_updates_admin_insert on public.status_incident_updates for insert to authenticated with check ((select public.is_super_admin()));
create policy phase18_status_incident_updates_admin_update on public.status_incident_updates for update to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

-- Exchange rates and tax jurisdiction rules are public reference reads; writes stay platform-only.
grant select on public.exchange_rates, public.tax_jurisdiction_rules to anon, authenticated;
grant insert, update on public.exchange_rates, public.tax_jurisdiction_rules to authenticated;
create policy phase18_exchange_rates_public_read on public.exchange_rates for select to anon, authenticated using (true);
create policy phase18_tax_jurisdiction_rules_public_read on public.tax_jurisdiction_rules for select to anon, authenticated using (is_active and effective_until is null or effective_until > now() or (select public.is_super_admin()));
create policy phase18_exchange_rates_admin_insert on public.exchange_rates for insert to authenticated with check ((select public.is_super_admin()));
create policy phase18_exchange_rates_admin_update on public.exchange_rates for update to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy phase18_tax_jurisdiction_rules_admin_insert on public.tax_jurisdiction_rules for insert to authenticated with check ((select public.is_super_admin()));
create policy phase18_tax_jurisdiction_rules_admin_update on public.tax_jurisdiction_rules for update to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

-- Platform-only configuration, coupon, filing, and abuse-control tables.
grant select, insert, update on public.platform_tax_compliance_settings to authenticated;
create policy phase18_platform_tax_compliance_settings_admin_select on public.platform_tax_compliance_settings for select to authenticated using ((select public.is_super_admin()));
create policy phase18_platform_tax_compliance_settings_admin_insert on public.platform_tax_compliance_settings for insert to authenticated with check ((select public.is_super_admin()));
create policy phase18_platform_tax_compliance_settings_admin_update on public.platform_tax_compliance_settings for update to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
grant select, insert, update on public.tax_document_runs to authenticated;
create policy phase18_tax_document_runs_admin_select on public.tax_document_runs for select to authenticated using ((select public.is_super_admin()));
create policy phase18_tax_document_runs_admin_insert on public.tax_document_runs for insert to authenticated with check ((select public.is_super_admin()));
create policy phase18_tax_document_runs_admin_update on public.tax_document_runs for update to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
grant select, insert, update on public.coupons to authenticated;
create policy phase18_coupons_admin_select on public.coupons for select to authenticated using ((select public.is_super_admin()));
create policy phase18_coupons_admin_insert on public.coupons for insert to authenticated with check ((select public.is_super_admin()));
create policy phase18_coupons_admin_update on public.coupons for update to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

-- Accountant delegation is visible to the accountant, company owner, and super_admin only.
grant select, insert, update on public.accountant_company_access to authenticated;
create policy phase18_accountant_access_select on public.accountant_company_access for select to authenticated using ((select public.is_super_admin()) or accountant_user_id = (select auth.uid()) or (select public.current_user_owns_company(company_id)));
create policy phase18_accountant_access_insert on public.accountant_company_access for insert to authenticated with check ((select public.is_super_admin()) or (select public.current_user_can_manage_company(company_id)));
create policy phase18_accountant_access_update on public.accountant_company_access for update to authenticated using ((select public.is_super_admin()) or (select public.current_user_can_manage_company(company_id))) with check ((select public.is_super_admin()) or (select public.current_user_can_manage_company(company_id)));

-- Reseller rows reveal only the reseller relationship, never tenant business data.
grant select on public.reseller_profiles, public.reseller_sub_tenants to authenticated;
grant insert, update on public.reseller_profiles, public.reseller_sub_tenants to authenticated;
create policy phase18_reseller_profiles_select on public.reseller_profiles for select to authenticated using ((select public.is_super_admin()) or reseller_user_id = (select auth.uid()));
create policy phase18_reseller_profiles_insert on public.reseller_profiles for insert to authenticated with check (reseller_user_id = (select auth.uid()) or (select public.is_super_admin()));
create policy phase18_reseller_profiles_update on public.reseller_profiles for update to authenticated using (reseller_user_id = (select auth.uid()) or (select public.is_super_admin())) with check (reseller_user_id = (select auth.uid()) or (select public.is_super_admin()));
create policy phase18_reseller_sub_tenants_select on public.reseller_sub_tenants for select to authenticated using ((select public.is_super_admin()) or reseller_user_id = (select auth.uid()) or (select public.current_user_owns_company(company_id)));

-- Affiliate policies use the affiliate profile as the only visibility anchor.
grant select on public.affiliate_profiles, public.affiliate_clicks, public.affiliate_referrals, public.affiliate_commissions, public.affiliate_payout_requests to authenticated;
create policy phase18_affiliate_profiles_select on public.affiliate_profiles for select to authenticated using ((select public.is_super_admin()) or affiliate_user_id = (select auth.uid()));
create policy phase18_affiliate_clicks_select on public.affiliate_clicks for select to authenticated using ((select public.is_super_admin()) or exists (select 1 from public.affiliate_profiles p where p.id = affiliate_clicks.affiliate_profile_id and p.affiliate_user_id = (select auth.uid())));
create policy phase18_affiliate_referrals_select on public.affiliate_referrals for select to authenticated using ((select public.is_super_admin()) or exists (select 1 from public.affiliate_profiles p where p.id = affiliate_referrals.affiliate_profile_id and p.affiliate_user_id = (select auth.uid())));
create policy phase18_affiliate_commissions_select on public.affiliate_commissions for select to authenticated using ((select public.is_super_admin()) or exists (select 1 from public.affiliate_profiles p where p.id = affiliate_commissions.affiliate_profile_id and p.affiliate_user_id = (select auth.uid())));
create policy phase18_affiliate_payout_requests_select on public.affiliate_payout_requests for select to authenticated using ((select public.is_super_admin()) or exists (select 1 from public.affiliate_profiles p where p.id = affiliate_payout_requests.affiliate_profile_id and p.affiliate_user_id = (select auth.uid())));

grant select on public.coupon_redemptions to authenticated;
create policy phase18_coupon_redemptions_select on public.coupon_redemptions for select to authenticated using ((select public.is_super_admin()) or (select public.current_user_owns_company(company_id)));

grant select, insert on public.support_ticket_messages to authenticated;
create policy phase18_support_ticket_messages_select on public.support_ticket_messages for select to authenticated using ((select public.is_super_admin()) or exists (select 1 from public.support_tickets t where t.id = support_ticket_messages.ticket_id and (t.company_id is null or (select public.current_user_has_company_access(t.company_id)))));
create policy phase18_support_ticket_messages_insert on public.support_ticket_messages for insert to authenticated with check (author_user_id = (select auth.uid()) and exists (select 1 from public.support_tickets t where t.id = support_ticket_messages.ticket_id and t.company_id is not null and (select public.current_user_can_write_domain(t.company_id, 'support'))));

-- Global public content is readable only when published/active; tenant rows remain owner-scoped.
grant select on public.cms_pages, public.blog_categories, public.blog_tags, public.blog_posts, public.blog_post_tags, public.faq_items, public.branding_settings, public.announcement_bars to anon;
create policy phase18_cms_pages_public_read on public.cms_pages for select to anon using (company_id is null and status = 'published' and deleted_at is null);
create policy phase18_blog_categories_public_read on public.blog_categories for select to anon using (company_id is null and deleted_at is null);
create policy phase18_blog_tags_public_read on public.blog_tags for select to anon using (company_id is null and deleted_at is null);
create policy phase18_blog_posts_public_read on public.blog_posts for select to anon using (company_id is null and status = 'published' and deleted_at is null);
create policy phase18_blog_post_tags_public_read on public.blog_post_tags for select to anon using (company_id is null and exists (select 1 from public.blog_posts p where p.id = blog_post_tags.post_id and p.company_id is null and p.status = 'published' and p.deleted_at is null));
create policy phase18_faq_items_public_read on public.faq_items for select to anon using (company_id is null and is_published and deleted_at is null);
create policy phase18_branding_settings_public_read on public.branding_settings for select to anon using (company_id is null and is_active);
create policy phase18_announcement_bars_public_read on public.announcement_bars for select to anon using (company_id is null and is_active and deleted_at is null and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
create policy phase18_whatsapp_templates_global_admin_select on public.whatsapp_templates for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_whatsapp_templates_global_admin_insert on public.whatsapp_templates for insert to authenticated with check (company_id is null and (select public.is_super_admin()));
create policy phase18_whatsapp_templates_global_admin_update on public.whatsapp_templates for update to authenticated using (company_id is null and (select public.is_super_admin())) with check (company_id is null and (select public.is_super_admin()));
create policy phase18_email_templates_global_admin_select on public.email_templates for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_email_templates_global_admin_insert on public.email_templates for insert to authenticated with check (company_id is null and (select public.is_super_admin()));
create policy phase18_email_templates_global_admin_update on public.email_templates for update to authenticated using (company_id is null and (select public.is_super_admin())) with check (company_id is null and (select public.is_super_admin()));
create policy phase18_communication_webhook_events_global_admin_select on public.communication_webhook_events for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_platform_fee_rules_global_admin_select on public.platform_fee_rules for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_platform_fee_rules_global_admin_insert on public.platform_fee_rules for insert to authenticated with check (company_id is null and (select public.is_super_admin()));
create policy phase18_platform_fee_rules_global_admin_update on public.platform_fee_rules for update to authenticated using (company_id is null and (select public.is_super_admin())) with check (company_id is null and (select public.is_super_admin()));
create policy phase18_audit_logs_global_admin_select on public.audit_logs for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_cms_pages_global_admin_select on public.cms_pages for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_cms_pages_global_admin_insert on public.cms_pages for insert to authenticated with check (company_id is null and (select public.is_super_admin()));
create policy phase18_cms_pages_global_admin_update on public.cms_pages for update to authenticated using (company_id is null and (select public.is_super_admin())) with check (company_id is null and (select public.is_super_admin()));
create policy phase18_cms_page_revisions_global_admin_select on public.cms_page_revisions for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_cms_page_revisions_global_admin_insert on public.cms_page_revisions for insert to authenticated with check (company_id is null and (select public.is_super_admin()));
create policy phase18_cms_page_revisions_global_admin_update on public.cms_page_revisions for update to authenticated using (company_id is null and (select public.is_super_admin())) with check (company_id is null and (select public.is_super_admin()));
create policy phase18_blog_categories_global_admin_select on public.blog_categories for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_blog_categories_global_admin_insert on public.blog_categories for insert to authenticated with check (company_id is null and (select public.is_super_admin()));
create policy phase18_blog_categories_global_admin_update on public.blog_categories for update to authenticated using (company_id is null and (select public.is_super_admin())) with check (company_id is null and (select public.is_super_admin()));
create policy phase18_blog_tags_global_admin_select on public.blog_tags for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_blog_tags_global_admin_insert on public.blog_tags for insert to authenticated with check (company_id is null and (select public.is_super_admin()));
create policy phase18_blog_tags_global_admin_update on public.blog_tags for update to authenticated using (company_id is null and (select public.is_super_admin())) with check (company_id is null and (select public.is_super_admin()));
create policy phase18_blog_posts_global_admin_select on public.blog_posts for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_blog_posts_global_admin_insert on public.blog_posts for insert to authenticated with check (company_id is null and (select public.is_super_admin()));
create policy phase18_blog_posts_global_admin_update on public.blog_posts for update to authenticated using (company_id is null and (select public.is_super_admin())) with check (company_id is null and (select public.is_super_admin()));
create policy phase18_blog_post_tags_global_admin_select on public.blog_post_tags for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_blog_post_tags_global_admin_insert on public.blog_post_tags for insert to authenticated with check (company_id is null and (select public.is_super_admin()));
create policy phase18_blog_post_tags_global_admin_update on public.blog_post_tags for update to authenticated using (company_id is null and (select public.is_super_admin())) with check (company_id is null and (select public.is_super_admin()));
create policy phase18_faq_items_global_admin_select on public.faq_items for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_faq_items_global_admin_insert on public.faq_items for insert to authenticated with check (company_id is null and (select public.is_super_admin()));
create policy phase18_faq_items_global_admin_update on public.faq_items for update to authenticated using (company_id is null and (select public.is_super_admin())) with check (company_id is null and (select public.is_super_admin()));
create policy phase18_branding_settings_global_admin_select on public.branding_settings for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_branding_settings_global_admin_insert on public.branding_settings for insert to authenticated with check (company_id is null and (select public.is_super_admin()));
create policy phase18_branding_settings_global_admin_update on public.branding_settings for update to authenticated using (company_id is null and (select public.is_super_admin())) with check (company_id is null and (select public.is_super_admin()));
create policy phase18_announcement_bars_global_admin_select on public.announcement_bars for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_announcement_bars_global_admin_insert on public.announcement_bars for insert to authenticated with check (company_id is null and (select public.is_super_admin()));
create policy phase18_announcement_bars_global_admin_update on public.announcement_bars for update to authenticated using (company_id is null and (select public.is_super_admin())) with check (company_id is null and (select public.is_super_admin()));
create policy phase18_support_tickets_global_admin_select on public.support_tickets for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_support_tickets_global_admin_insert on public.support_tickets for insert to authenticated with check (company_id is null and (select public.is_super_admin()));
create policy phase18_support_tickets_global_admin_update on public.support_tickets for update to authenticated using (company_id is null and (select public.is_super_admin())) with check (company_id is null and (select public.is_super_admin()));
create policy phase18_gdpr_requests_global_admin_select on public.gdpr_requests for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_gdpr_requests_global_admin_insert on public.gdpr_requests for insert to authenticated with check (company_id is null and (select public.is_super_admin()));
create policy phase18_gdpr_requests_global_admin_update on public.gdpr_requests for update to authenticated using (company_id is null and (select public.is_super_admin())) with check (company_id is null and (select public.is_super_admin()));
create policy phase18_backups_global_admin_select on public.backups for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_contract_templates_global_admin_select on public.contract_templates for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_contract_templates_global_admin_insert on public.contract_templates for insert to authenticated with check (company_id is null and (select public.is_super_admin()));
create policy phase18_contract_templates_global_admin_update on public.contract_templates for update to authenticated using (company_id is null and (select public.is_super_admin())) with check (company_id is null and (select public.is_super_admin()));
create policy phase18_tax_compliance_events_global_admin_select on public.tax_compliance_events for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_email_suppressions_global_admin_select on public.email_suppressions for select to authenticated using (company_id is null and (select public.is_super_admin()));
create policy phase18_email_suppressions_global_admin_insert on public.email_suppressions for insert to authenticated with check (company_id is null and (select public.is_super_admin()));
create policy phase18_email_suppressions_global_admin_update on public.email_suppressions for update to authenticated using (company_id is null and (select public.is_super_admin())) with check (company_id is null and (select public.is_super_admin()));
create policy phase18_cms_pages_authenticated_public_read on public.cms_pages for select to authenticated using (company_id is null and status = 'published' and deleted_at is null);
create policy phase18_blog_categories_authenticated_public_read on public.blog_categories for select to authenticated using (company_id is null and deleted_at is null);
create policy phase18_blog_tags_authenticated_public_read on public.blog_tags for select to authenticated using (company_id is null and deleted_at is null);
create policy phase18_blog_posts_authenticated_public_read on public.blog_posts for select to authenticated using (company_id is null and status = 'published' and deleted_at is null);
create policy phase18_blog_post_tags_authenticated_public_read on public.blog_post_tags for select to authenticated using (company_id is null and exists (select 1 from public.blog_posts p where p.id = blog_post_tags.post_id and p.company_id is null and p.status = 'published' and p.deleted_at is null));
create policy phase18_faq_items_authenticated_public_read on public.faq_items for select to authenticated using (company_id is null and is_published and deleted_at is null);
create policy phase18_branding_settings_authenticated_public_read on public.branding_settings for select to authenticated using (company_id is null and is_active);
create policy phase18_announcement_bars_authenticated_public_read on public.announcement_bars for select to authenticated using (company_id is null and is_active and deleted_at is null and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));

-- Deliberately server-only tables have no authenticated policy beyond safe reads above;
-- service_role is the provider/webhook/secret boundary and bypasses RLS.
comment on table public.security_rate_limit_buckets is 'RLS: service-role-only abuse counters; browser roles have no table privilege or policy.';
comment on table public.tax_document_runs is 'RLS: platform tax filing runs are super_admin-only and normally accessed through the server boundary.';
comment on table public.api_keys is 'RLS: tenant API-key hashes remain behind the server boundary; no browser mutation policy is exposed.';

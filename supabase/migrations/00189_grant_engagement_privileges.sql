-- supabase/migrations/00189_grant_engagement_privileges.sql
-- Table, column and routine privileges for the Step 16 features.

-- Messaging credentials live in the vault; the channel row only points at
-- them, so every descriptive column may be read.
grant select, insert, update on public.messaging_channels to authenticated;
grant select, insert, update on public.contact_channel_identities
  to authenticated;
grant select on public.channel_suppressions to authenticated;
grant select, insert, update on public.message_routes to authenticated;
grant select, insert, update, delete on public.message_route_steps
  to authenticated;
grant select on public.message_route_runs to authenticated;
grant select, update on public.inbound_messages to authenticated;

-- A bank token is never readable by anyone but the platform.
grant select (
  id, company_id, provider, institution_name, institution_reference,
  institution_logo_url, country_code, connection_reference, credential_id,
  token_expires_at, status, consent_granted_at, consent_expires_at,
  reauthorization_url, sync_frequency_hours, last_synced_at, next_sync_at,
  last_error, last_error_at, consecutive_failures, account_count, created_at,
  updated_at, deleted_at, created_by, updated_by
) on public.bank_feed_connections to authenticated;

grant update (
  institution_name, sync_frequency_hours, status, deleted_at, updated_at,
  updated_by
) on public.bank_feed_connections to authenticated;

grant select, update on public.bank_feed_accounts to authenticated;
grant select on public.bank_feed_syncs to authenticated;
grant select, insert, update, delete on public.bank_transaction_splits
  to authenticated;
grant select, insert, update on public.reconciliation_memory to authenticated;

grant select, insert, update on public.receipt_scans to authenticated;
grant select, update on public.receipt_scan_lines to authenticated;

grant select, insert, update on public.instalment_offers to authenticated;
grant select on public.instalment_plans to authenticated;
grant select on public.instalment_schedule_items to authenticated;

grant select, insert, update on public.loyalty_programs to authenticated;
grant select on public.loyalty_accounts to authenticated;
grant select on public.loyalty_transactions to authenticated;
grant select, insert, update on public.loyalty_rewards to authenticated;
grant select, update on public.loyalty_redemptions to authenticated;

-- -----------------------------------------------------------------------------
-- Messaging routines
-- -----------------------------------------------------------------------------

grant execute on function public.may_message_on_channel(
  uuid, public.message_channel, text
) to authenticated;
grant execute on function public.register_contact_channel(
  uuid, public.message_channel, text, uuid, uuid, text, boolean
) to authenticated;
grant execute on function public.opt_out_of_channel(
  uuid, public.message_channel, text, text, text
) to anon, authenticated;
grant execute on function public.resolve_messaging_channel(
  uuid, public.message_channel
) to authenticated;
grant execute on function public.queue_channel_message(
  uuid, public.message_channel, text, text, text, uuid, text, uuid, text, uuid,
  smallint
) to authenticated;
grant execute on function public.start_message_route(
  uuid, text, uuid, uuid, text, uuid, jsonb
) to authenticated;
grant execute on function public.channel_usage_summary(
  uuid, timestamptz, timestamptz
) to authenticated;

revoke execute on function public.send_route_step(uuid, smallint)
  from public, authenticated;
revoke execute on function public.advance_message_routes(integer)
  from public, authenticated;
revoke execute on function public.record_route_delivery(uuid, boolean)
  from public, authenticated;
revoke execute on function public.record_inbound_message(
  uuid, public.message_channel, text, text, text, text
) from public, authenticated;

grant execute on function public.send_route_step(uuid, smallint) to service_role;
grant execute on function public.advance_message_routes(integer) to service_role;
grant execute on function public.record_route_delivery(uuid, boolean)
  to service_role;
grant execute on function public.record_inbound_message(
  uuid, public.message_channel, text, text, text, text
) to service_role;

-- -----------------------------------------------------------------------------
-- Bank feed routines
-- -----------------------------------------------------------------------------

grant execute on function public.connect_bank_feed(
  uuid, text, text, text, timestamptz, uuid
) to authenticated;
grant execute on function public.link_feed_account(uuid, uuid, date)
  to authenticated;
grant execute on function public.start_feed_sync(uuid, uuid, text)
  to authenticated;
grant execute on function public.disconnect_bank_feed(uuid, text)
  to authenticated;
grant execute on function public.bank_feed_health(uuid) to authenticated;

revoke execute on function public.ingest_feed_transaction(
  uuid, uuid, text, numeric, date, text, text, text, numeric
) from public, authenticated;
revoke execute on function public.complete_feed_sync(uuid, text, text, text)
  from public, authenticated;
revoke execute on function public.expire_bank_feed_consents()
  from public, authenticated;

grant execute on function public.ingest_feed_transaction(
  uuid, uuid, text, numeric, date, text, text, text, numeric
) to service_role;
grant execute on function public.complete_feed_sync(uuid, text, text, text)
  to service_role;
grant execute on function public.expire_bank_feed_consents() to service_role;

-- -----------------------------------------------------------------------------
-- Reconciliation routines
-- -----------------------------------------------------------------------------

grant execute on function public.suggest_spending_matches(uuid, integer)
  to authenticated;
grant execute on function public.counterparty_key(text) to authenticated;
grant execute on function public.remember_reconciliation_choice(
  uuid, text, text, uuid, uuid, uuid
) to authenticated;
grant execute on function public.recall_reconciliation_choice(uuid)
  to authenticated;
grant execute on function public.split_bank_transaction(uuid, jsonb)
  to authenticated;
grant execute on function public.unreconciled_work(uuid, integer)
  to authenticated;

-- -----------------------------------------------------------------------------
-- Receipt routines
-- -----------------------------------------------------------------------------

grant execute on function public.submit_receipt_scan(
  uuid, text, text, text, bigint, text, text
) to authenticated;
grant execute on function public.create_expense_from_receipt(
  uuid, uuid, uuid, text
) to authenticated;
grant execute on function public.discard_receipt_scan(uuid, text)
  to authenticated;
grant execute on function public.receipt_scan_summary(uuid) to authenticated;

revoke execute on function public.claim_receipt_scans(integer)
  from public, authenticated;
revoke execute on function public.record_receipt_result(
  uuid, text, jsonb, jsonb, numeric, text
) from public, authenticated;
revoke execute on function public.fail_receipt_scan(uuid, text)
  from public, authenticated;

grant execute on function public.claim_receipt_scans(integer) to service_role;
grant execute on function public.record_receipt_result(
  uuid, text, jsonb, jsonb, numeric, text
) to service_role;
grant execute on function public.fail_receipt_scan(uuid, text) to service_role;

-- -----------------------------------------------------------------------------
-- Instalment routines
-- -----------------------------------------------------------------------------

grant execute on function public.create_instalment_plan(uuid, uuid, date)
  to authenticated;
grant execute on function public.decide_instalment_plan(uuid, boolean, text)
  to authenticated;
grant execute on function public.record_instalment_payment(uuid, numeric, uuid)
  to authenticated;
grant execute on function public.cancel_instalment_plan(uuid, text)
  to authenticated;
grant execute on function public.instalment_plan_status(uuid) to authenticated;

revoke execute on function public.mark_overdue_instalments()
  from public, authenticated;
revoke execute on function public.due_instalments(integer, integer)
  from public, authenticated;

grant execute on function public.mark_overdue_instalments() to service_role;
grant execute on function public.due_instalments(integer, integer)
  to service_role;

-- -----------------------------------------------------------------------------
-- Loyalty routines
-- -----------------------------------------------------------------------------

grant execute on function public.enrol_loyalty_member(uuid, uuid)
  to authenticated;
grant execute on function public.recalculate_loyalty_tier(uuid) to authenticated;
grant execute on function public.award_loyalty_points(
  uuid, integer, text, uuid, uuid, text, date
) to authenticated;
grant execute on function public.accrue_points_for_payment(uuid)
  to authenticated;
grant execute on function public.redeem_loyalty_reward(uuid, uuid)
  to authenticated;
grant execute on function public.apply_loyalty_redemption(uuid, uuid)
  to authenticated;
grant execute on function public.loyalty_account_summary(uuid) to authenticated;

revoke execute on function public.expire_loyalty_points()
  from public, authenticated;
grant execute on function public.expire_loyalty_points() to service_role;

-- supabase/migrations/00063_grant_payment_privileges.sql
-- Table and routine privileges for the payment module.
--
-- The money routines are security definer and enforce their own permission
-- checks, so the client layer calls them instead of writing rows directly.

grant select, insert, update on public.payment_gateways to authenticated;
grant select, insert, update on public.gateway_availability to authenticated;
grant select, insert, update on public.client_payment_methods to authenticated;
grant select, insert on public.payment_intents to authenticated;
grant select, insert, update on public.payments to authenticated;
grant select, insert on public.payment_allocations to authenticated;
grant select, insert, update on public.payment_receipts to authenticated;
grant select, insert, update on public.refunds to authenticated;
grant select, insert, update on public.disputes to authenticated;
grant select, insert on public.dispute_evidence_items to authenticated;
grant select on public.webhook_events to authenticated;
grant select, update on public.wallets to authenticated;
grant select on public.wallet_transactions to authenticated;
grant select, insert, update on public.payout_accounts to authenticated;
grant select, update on public.payouts to authenticated;

grant execute on function public.is_gateway_available(
  uuid, public.gateway_provider, public.gateway_mode
) to authenticated;
grant execute on function public.record_payment(
  uuid, uuid, numeric, public.payment_method_type, public.gateway_provider,
  timestamptz, text, numeric
) to authenticated;
grant execute on function public.allocate_payment_to_invoice(uuid, uuid, numeric)
  to authenticated;
grant execute on function public.reverse_payment_allocation(uuid, text) to authenticated;
grant execute on function public.payment_fee_breakdown(uuid) to authenticated;
grant execute on function public.record_refund(uuid, numeric, text, text) to authenticated;
grant execute on function public.settle_refund(uuid) to authenticated;
grant execute on function public.assemble_dispute_evidence(uuid) to authenticated;
grant execute on function public.request_payout(uuid, numeric, uuid) to authenticated;
grant execute on function public.verify_payment_allocation_total(uuid) to authenticated;

-- Reserved for the trusted server layer and the scheduled jobs.
revoke all on function public.register_webhook_event(
  public.gateway_provider, text, text, jsonb, text, boolean, uuid
) from anon, authenticated;
revoke all on function public.complete_webhook_event(uuid, boolean, text, integer)
  from anon, authenticated;
revoke all on function public.post_wallet_transaction(
  uuid, public.wallet_transaction_type, numeric, text, boolean, jsonb
) from anon, authenticated;
revoke all on function public.release_matured_wallet_funds() from anon, authenticated;
revoke all on function public.complete_payout(uuid, boolean, text, text)
  from anon, authenticated;
revoke all on function public.settle_merchant_of_record_payment(uuid, numeric)
  from anon, authenticated;
revoke all on function public.find_unbalanced_payments(uuid) from anon, authenticated;

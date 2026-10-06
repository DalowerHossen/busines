-- supabase/migrations/00089_grant_communication_privileges.sql
-- Table and routine privileges for the communication module.
--
-- Nothing writes to the outbox directly. Sending goes through the security
-- definer routines, which is what keeps the owner only rule, the suppression
-- list and the idempotency key impossible to bypass from a session.

grant select on public.email_templates to authenticated;
grant insert, update on public.email_templates to authenticated;
grant select on public.email_template_versions to authenticated;

grant select, insert, update on public.sending_domains to authenticated;
grant select, insert, update on public.sender_identities to authenticated;

grant select on public.messages to authenticated;
grant select on public.message_events to authenticated;
grant select on public.email_suppressions to authenticated;

grant select, update on public.notifications to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;

grant select, insert, update on public.reminder_rules to authenticated;
grant select, insert, update on public.reminder_settings to authenticated;
grant select on public.invoice_reminders to authenticated;
grant select, insert, update on public.payment_promises to authenticated;

grant select, insert on public.send_requests to authenticated;
grant update on public.send_requests to authenticated;
grant select, insert, update on public.send_batches to authenticated;
grant select on public.send_batch_items to authenticated;

-- -----------------------------------------------------------------------------
-- Routines the application may call
-- -----------------------------------------------------------------------------

grant execute on function public.render_template_text(text, jsonb) to authenticated;
grant execute on function public.resolve_email_template(
  text, uuid, public.message_channel
) to authenticated;
grant execute on function public.resolve_sender_identity(uuid) to authenticated;
grant execute on function public.is_email_suppressed(text, uuid) to authenticated;
grant execute on function public.release_email_suppression(uuid, text) to authenticated;
grant execute on function public.can_send_client_email(uuid) to authenticated;

grant execute on function public.queue_message(
  uuid, text, text, jsonb, text, text, text, uuid, uuid, timestamptz,
  public.message_channel
) to authenticated;
grant execute on function public.request_document_send(
  uuid, public.shared_document_type, uuid, text, text, text, text
) to authenticated;
grant execute on function public.review_send_request(uuid, boolean, text)
  to authenticated;

grant execute on function public.wants_notification(
  uuid, public.notification_type, public.message_channel, uuid
) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

grant execute on function public.next_sending_slot(uuid, timestamptz) to authenticated;
grant execute on function public.schedule_invoice_reminders(uuid) to authenticated;
grant execute on function public.cancel_invoice_reminders(uuid, text) to authenticated;
grant execute on function public.record_payment_promise(uuid, date, numeric, text, text)
  to authenticated;

-- -----------------------------------------------------------------------------
-- Reserved for the trusted server layer and the scheduled jobs
-- -----------------------------------------------------------------------------

revoke all on function public.suppress_email(text, text, uuid, text, text)
  from anon, authenticated;
revoke all on function public.claim_due_messages(integer) from anon, authenticated;
revoke all on function public.record_message_event(
  uuid, public.message_status, text, jsonb, text
) from anon, authenticated;
revoke all on function public.notify_user(
  uuid, public.notification_type, text, text, uuid, text, text, text
) from anon, authenticated;
revoke all on function public.notify_company(
  uuid, public.notification_type, text, text, text, text, text
) from anon, authenticated;
revoke all on function public.run_due_reminders(integer) from anon, authenticated;
revoke all on function public.resolve_due_payment_promises() from anon, authenticated;

revoke all on public.unsubscribe_tokens from anon, authenticated;

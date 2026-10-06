-- supabase/migrations/00050_grant_document_privileges.sql
-- Table and routine privileges for the document module.

grant select, insert, update on public.invoices to authenticated;
grant select, insert, update, delete on public.invoice_items to authenticated;
grant select on public.invoice_taxes to authenticated;
grant select, insert on public.document_events to authenticated;
grant select, insert, update on public.estimates to authenticated;
grant select, insert, update, delete on public.estimate_items to authenticated;
grant select, insert, update on public.credit_notes to authenticated;
grant select, insert, update, delete on public.credit_note_items to authenticated;
grant select, insert on public.credit_note_applications to authenticated;
grant select, insert, update on public.recurring_invoice_schedules to authenticated;
grant select, insert, update on public.document_links to authenticated;

grant execute on function public.issue_invoice(uuid, date) to authenticated;
grant execute on function public.revise_invoice(uuid) to authenticated;
grant execute on function public.recalculate_invoice_totals(uuid) to authenticated;
grant execute on function public.refresh_invoice_settlement(uuid) to authenticated;
grant execute on function public.recalculate_estimate_totals(uuid) to authenticated;
grant execute on function public.convert_estimate_to_invoice(uuid) to authenticated;
grant execute on function public.recalculate_credit_note_totals(uuid) to authenticated;
grant execute on function public.apply_credit_note_to_invoice(uuid, uuid, numeric)
  to authenticated;
grant execute on function public.next_recurrence_date(uuid, date) to authenticated;
grant execute on function public.generate_recurring_invoice(uuid) to authenticated;
grant execute on function public.revoke_document_link(uuid, text) to authenticated;

-- Scheduled maintenance belongs to the service role alone.
revoke all on function public.mark_overdue_invoices() from anon, authenticated;
revoke all on function public.expire_stale_estimates() from anon, authenticated;
revoke all on function public.expire_stale_document_links() from anon, authenticated;

-- Resolving a client link runs on the server with the service role, because
-- the caller is an anonymous visitor holding a token rather than an account.
revoke all on function public.resolve_document_link(text, inet, text)
  from anon, authenticated;

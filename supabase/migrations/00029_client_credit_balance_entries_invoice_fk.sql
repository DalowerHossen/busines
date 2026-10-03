-- supabase/migrations/00029_client_credit_balance_entries_invoice_fk.sql
-- Adds the foreign key that 00019_client_credit_balance_entries.sql
-- deliberately deferred: related_invoice_id could not reference invoices
-- until this phase created that table. See the comment left on that
-- column in 00019 for the original forward-reference note.

alter table public.client_credit_balance_entries
  add constraint client_credit_balance_entries_related_invoice_id_fkey
  foreign key (related_invoice_id) references public.invoices (id);

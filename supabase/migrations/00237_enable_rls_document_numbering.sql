-- supabase/migrations/00237_enable_rls_document_numbering.sql
-- Closes the last gap in row level security coverage.
--
-- document_number_counters is created in 00010, before the RLS helper
-- functions and the per domain RLS migrations exist, so it was the one
-- public table left without row level security. Privileges were already
-- revoked from anon and authenticated in 00024; this migration adds the
-- second lock so that a future grant cannot silently open the table, and so
-- that "row level security on every table" is literally true.

alter table public.document_number_counters enable row level security;
alter table public.document_number_counters force row level security;

revoke all privileges on table public.document_number_counters
  from public, anon, authenticated;

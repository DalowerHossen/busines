-- supabase/migrations/00059_journal_entries.sql
-- A double-entry journal entry header (P7.6). reference_type/reference_id
-- optionally link back to the business event that produced the entry (an
-- invoice, a payment, an expense, a manual adjustment); reference_id has
-- NO foreign key since it is polymorphic across several possible source
-- tables, validated at the application layer, the same pattern used by
-- the V1-V3 evidence tables' document_id in Phase 9.
--
-- is_locked supports the period-lock / financial-close process (Y7.9,
-- EE2.5 "period-lock respected" for accountants): once true, application
-- code must refuse to add/edit journal_entry_lines for this entry. There
-- is no database-level enforcement trigger yet -- that level of
-- enforcement is deferred to Phase 19 alongside every other trigger -- so
-- until then this is an application-layer guard only.

create table public.journal_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  entry_date date not null default current_date,
  description text not null,
  reference_type text null,
  reference_id uuid null,
  created_by_user_id uuid not null references public.users (id),
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index journal_entries_company_id_idx
  on public.journal_entries (company_id)
  where deleted_at is null;
create index journal_entries_entry_date_idx
  on public.journal_entries (company_id, entry_date)
  where deleted_at is null;
create index journal_entries_reference_idx
  on public.journal_entries (reference_type, reference_id)
  where reference_id is not null;

comment on table public.journal_entries is
  'A double-entry journal entry header (P7.6). Its lines live in journal_entry_lines; a valid entry''s lines must sum to equal total debits and credits, enforced at the application layer.';

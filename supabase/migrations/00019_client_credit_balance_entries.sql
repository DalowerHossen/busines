-- supabase/migrations/00019_client_credit_balance_entries.sql
-- A ledger of a client's prepaid credit balance. A client's current
-- balance is always the running sum of every entry's signed amount
-- (positive entries increase the balance, negative entries decrease it) --
-- never a standalone mutable counter, so the full history is auditable.
--
-- related_invoice_id intentionally has NO foreign key yet: the invoices
-- table does not exist until Phase 7. The column is created here as a
-- plain uuid and Phase 7's migration adds the foreign key constraint once
-- invoices exists, the same forward-reference pattern used for
-- company_profile_snapshots in Phase 5.

create type client_credit_balance_reason as enum (
  'overpayment',
  'credit_note_issued',
  'applied_to_invoice',
  'manual_adjustment',
  'refund_issued'
);

create table public.client_credit_balance_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  client_id uuid not null references public.clients (id),
  reason client_credit_balance_reason not null,
  -- Signed amount: positive increases the client's balance, negative
  -- decreases it. Never edit an existing row to correct a mistake --
  -- always post an offsetting entry so the ledger stays append-only in
  -- spirit, even though deleted_at exists for genuine data-entry errors.
  amount numeric(14, 2) not null,
  currency_code text not null default 'USD',
  related_invoice_id uuid null,
  note text null,
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index client_credit_balance_entries_company_id_idx
  on public.client_credit_balance_entries (company_id)
  where deleted_at is null;
create index client_credit_balance_entries_client_id_idx
  on public.client_credit_balance_entries (client_id)
  where deleted_at is null;
create index client_credit_balance_entries_related_invoice_id_idx
  on public.client_credit_balance_entries (related_invoice_id)
  where related_invoice_id is not null;

comment on table public.client_credit_balance_entries is
  'Append-in-spirit ledger of a client''s prepaid credit balance. Current balance = sum(amount) for that client''s non-deleted rows.';
comment on column public.client_credit_balance_entries.related_invoice_id is
  'References invoices(id), added as a real foreign key once Phase 7 creates the invoices table. Validated at the application layer until then.';

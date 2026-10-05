-- supabase/migrations/00051_accounting_enums.sql
-- Enum types shared by the accounting tables created in this migration
-- group. Note: recurring_expenses (00054) deliberately REUSES the
-- recurring_invoice_frequency enum from Phase 8 instead of defining a
-- near-identical duplicate, since its values (weekly/biweekly/monthly/
-- quarterly/yearly) are identical -- the same reuse-over-duplication
-- approach Phase 5 used for account_role across two tables.

create type account_type as enum (
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense'
);

create type bill_status as enum (
  'draft',
  'received',
  'partially_paid',
  'paid',
  'overdue',
  'void'
);

create type expense_approval_status as enum (
  'not_required',
  'pending',
  'approved',
  'rejected'
);

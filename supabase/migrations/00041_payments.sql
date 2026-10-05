-- supabase/migrations/00041_payments.sql
-- A single payment transaction against an invoice (or a standalone
-- payment link not tied to any invoice -- invoice_id is nullable).
--
-- is_3ds_enabled freezes the EFFECTIVE 3DS setting (global default
-- overridden per company, both resolved from system_settings) onto the
-- payment at the moment it was attempted, since the setting itself can
-- change later and a historical payment record must always reflect what
-- was actually true when it happened -- the same frozen-at-the-time
-- principle used for company/client snapshots on invoices.
--
-- risk_flags/risk_score are plain data columns only: the actual
-- high-risk / unusual-amount / new-client-velocity FLAGGING LOGIC (V5.8,
-- V5.9, V5.10 in FEATURE-REGISTRY.md) is business logic added in a later
-- application-code phase, not a migration; this phase only makes sure the
-- column exists to write that logic's output into.

create table public.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  invoice_id uuid null references public.invoices (id),
  client_id uuid not null references public.clients (id),
  gateway gateway_id not null,
  settlement_path settlement_path not null default 'own_gateway',
  status payment_status not null default 'pending',
  currency_code text not null default 'USD',
  amount numeric(14, 2) not null,
  -- The platform's own per-transaction fee, charged in addition to the
  -- gateway's own fee. Always denominated in the same currency as amount.
  platform_fee numeric(14, 2) not null default 0,
  gateway_transaction_id text null,
  saved_payment_method_id uuid null references public.saved_payment_methods (id),
  is_3ds_enabled boolean not null default false,
  risk_flags text[] not null default '{}',
  risk_score numeric(5, 2) null,
  receipt_sent_at timestamptz null,
  authorized_at timestamptz null,
  captured_at timestamptz null,
  failure_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index payments_company_id_idx on public.payments (company_id) where deleted_at is null;
create index payments_invoice_id_idx on public.payments (invoice_id) where invoice_id is not null;
create index payments_client_id_idx on public.payments (client_id);
create index payments_status_idx on public.payments (company_id, status) where deleted_at is null;
-- Idempotent gateway-event processing: the same gateway transaction must
-- never be recorded as two different payments.
create unique index payments_gateway_transaction_id_key
  on public.payments (gateway, gateway_transaction_id)
  where gateway_transaction_id is not null;

comment on table public.payments is
  'A single payment attempt/transaction, optionally against an invoice. is_3ds_enabled and other settings are frozen at attempt time, not looked up live.';

-- supabase/migrations/00155_loyalty_accounts.sql
-- One loyalty balance per client and tenant program. The transaction ledger
-- remains the authoritative points history.

create table public.loyalty_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  program_id uuid not null references public.loyalty_programs (id),
  client_id uuid not null references public.clients (id),
  points_balance numeric(18, 4) not null default 0,
  lifetime_earned numeric(18, 4) not null default 0,
  lifetime_redeemed numeric(18, 4) not null default 0,
  last_activity_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint loyalty_accounts_balance_non_negative check (points_balance >= 0),
  constraint loyalty_accounts_lifetime_non_negative check (
    lifetime_earned >= 0 and lifetime_redeemed >= 0
  )
);

create unique index loyalty_accounts_program_client_key
  on public.loyalty_accounts (program_id, client_id)
  where deleted_at is null;
create index loyalty_accounts_company_balance_idx
  on public.loyalty_accounts (company_id, points_balance desc)
  where deleted_at is null;

comment on table public.loyalty_accounts is
  'A client loyalty points balance for one tenant program.';

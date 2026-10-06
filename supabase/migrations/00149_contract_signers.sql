-- supabase/migrations/00149_contract_signers.sql
-- Ordered contract signers using a hashed, expiring token link; no new
-- client login is introduced.

create table public.contract_signers (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  user_id uuid null references public.users (id),
  client_id uuid null references public.clients (id),
  signer_name text not null,
  signer_email citext not null,
  signing_order integer not null default 1,
  status signer_status not null default 'pending',
  token_hash text not null,
  token_expires_at timestamptz null,
  viewed_at timestamptz null,
  signed_at timestamptz null,
  declined_at timestamptz null,
  decline_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contract_signers_name_not_blank check (length(btrim(signer_name)) > 0),
  constraint contract_signers_email_not_blank check (length(btrim(signer_email::text)) > 0),
  constraint contract_signers_order_positive check (signing_order > 0),
  constraint contract_signers_token_not_blank check (length(btrim(token_hash)) > 0),
  constraint contract_signers_target_valid check (user_id is not null or client_id is not null),
  constraint contract_signers_signed_fields_valid check (
    (status = 'signed' and signed_at is not null) or status <> 'signed'
  )
);

create unique index contract_signers_token_hash_key
  on public.contract_signers (token_hash);
create unique index contract_signers_contract_order_key
  on public.contract_signers (contract_id, signing_order);
create index contract_signers_contract_status_idx
  on public.contract_signers (contract_id, status, signing_order);

comment on table public.contract_signers is
  'A contract signer and secure token-link workflow record for a client or platform user.';

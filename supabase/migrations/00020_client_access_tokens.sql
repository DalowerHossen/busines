-- supabase/migrations/00020_client_access_tokens.sql
-- The full and final replacement for a traditional client login portal
-- (that design was cancelled -- see docs/planning/ARCHITECTURE-DECISIONS.md
-- section 3). A signed, expiring, no-login link lets a client open one
-- invoice, one estimate, or their full client hub without ever creating an
-- account.
--
-- Only a SHA-256 hash of the HMAC-signed 128-bit token is stored here, the
-- same pattern used for password-reset tokens: a leaked database row can
-- never be replayed as a live access link, because the raw token is never
-- persisted anywhere, only embedded once in the emailed URL and re-hashed
-- on every lookup.
--
-- document_id has NO foreign key: document_type decides whether it points
-- at invoices(id) or estimates(id) (neither table exists until Phase 7/8),
-- and a single column cannot carry two different foreign keys at once.
-- This is validated at the application layer, not the database layer.

create type client_access_document_type as enum (
  'invoice',
  'estimate',
  'client_hub'
);

create table public.client_access_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  client_id uuid not null references public.clients (id),
  token_hash text not null,
  document_type client_access_document_type not null,
  document_id uuid null,
  requires_email_otp boolean not null default false,
  expires_at timestamptz null,
  revoked_at timestamptz null,
  last_viewed_at timestamptz null,
  view_count integer not null default 0,
  -- Supports the T1.9 rate-limit / brute-force guard on the OTP challenge.
  failed_otp_attempt_count integer not null default 0,
  locked_until timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint client_access_tokens_document_id_required check (
    (document_type = 'client_hub' and document_id is null)
    or (document_type <> 'client_hub' and document_id is not null)
  )
);

create unique index client_access_tokens_token_hash_key on public.client_access_tokens (token_hash);
create index client_access_tokens_company_id_idx on public.client_access_tokens (company_id);
create index client_access_tokens_client_id_idx on public.client_access_tokens (client_id);
create index client_access_tokens_document_idx
  on public.client_access_tokens (document_type, document_id)
  where document_id is not null;

comment on table public.client_access_tokens is
  'Signed, expiring, no-login access tokens for clients. Only a hash of the token is stored; the raw token lives only in the emailed link.';

-- supabase/migrations/00021_client_access_otp_codes.sql
-- One-time email verification codes challenged when a client access
-- token has requires_email_otp = true (T1.5). A fresh row is created
-- every time a code is (re)sent; only the hash is stored, matching the
-- token-hash pattern in the previous migration.

create table public.client_access_otp_codes (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  token_id uuid not null references public.client_access_tokens (id),
  code_hash text not null,
  expires_at timestamptz not null,
  verified_at timestamptz null,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index client_access_otp_codes_token_id_idx on public.client_access_otp_codes (token_id);
create index client_access_otp_codes_company_id_idx on public.client_access_otp_codes (company_id);

comment on table public.client_access_otp_codes is
  'One-time email OTP codes challenged for a client_access_token with requires_email_otp = true. Only the code hash is stored.';

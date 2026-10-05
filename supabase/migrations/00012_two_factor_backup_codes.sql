-- supabase/migrations/00012_two_factor_backup_codes.sql
-- One-time backup recovery codes for two-factor authentication. Supabase
-- Auth's built-in MFA (auth.mfa_factors) handles TOTP/SMS enrollment and
-- challenge/verify directly; it has no concept of backup codes, so this is
-- the one custom table this phase adds for 2FA.

create table public.two_factor_backup_codes (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users (id),
  code_hash text not null,
  used_at timestamptz null,
  created_at timestamptz not null default now()
);

create index two_factor_backup_codes_user_id_idx on public.two_factor_backup_codes (user_id);
create index two_factor_backup_codes_unused_idx
  on public.two_factor_backup_codes (user_id)
  where used_at is null;

comment on table public.two_factor_backup_codes is
  'Hashed one-time 2FA recovery codes. Never stores a plaintext code; codes are shown to the user once at generation time and hashed before insert.';

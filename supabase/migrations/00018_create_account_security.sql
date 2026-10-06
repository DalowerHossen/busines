-- supabase/migrations/00018_create_account_security.sql
-- Two factor authentication, device sessions, login attempts and recorded
-- consent. Every account role may enable two factor authentication, and an
-- owner may require it for the whole team.

create table public.user_two_factor (
  user_id uuid primary key,
  method public.two_factor_method not null default 'totp',

  -- Encrypted with AES-256 using the server side encryption key.
  secret_encrypted text not null,
  secret_key_version smallint not null default 1,

  -- Hashes of single use recovery codes.
  recovery_code_hashes jsonb not null default '[]'::jsonb,
  recovery_codes_generated_at timestamptz,
  recovery_codes_remaining smallint not null default 0,

  confirmed_at timestamptz,
  last_used_at timestamptz,
  failed_attempt_count integer not null default 0,
  locked_until timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_two_factor_recovery_codes_check
    check (jsonb_typeof(recovery_code_hashes) = 'array'),
  constraint user_two_factor_remaining_check
    check (recovery_codes_remaining between 0 and 20),
  constraint user_two_factor_failed_check
    check (failed_attempt_count >= 0)
);

comment on table public.user_two_factor is
  'Encrypted two factor secrets and hashed recovery codes.';

-- -----------------------------------------------------------------------------

create table public.user_sessions (
  id uuid primary key default public.generate_uuid_v7(),
  user_id uuid not null,

  session_token_hash text not null,
  device_label text,
  device_fingerprint text,
  user_agent text,
  ip_address inet,
  location_label text,

  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text,

  constraint user_sessions_token_hash_check
    check (session_token_hash ~ '^[0-9a-f]{64}$'),
  constraint user_sessions_expiry_check
    check (expires_at > created_at)
);

comment on table public.user_sessions is
  'Active device sessions, shown to the account holder and revocable by them.';

create unique index user_sessions_token_unique
  on public.user_sessions (session_token_hash);

create index user_sessions_user_idx
  on public.user_sessions (user_id, last_seen_at desc);

create index user_sessions_expiry_idx
  on public.user_sessions (expires_at)
  where revoked_at is null;

-- -----------------------------------------------------------------------------

create table public.login_attempts (
  id uuid primary key default public.generate_uuid_v7(),
  email citext,
  user_id uuid,

  succeeded boolean not null,
  failure_reason text,
  auth_provider public.auth_provider not null default 'email',

  ip_address inet,
  user_agent text,
  country_code char(2),
  device_fingerprint text,

  created_at timestamptz not null default now(),

  constraint login_attempts_failure_reason_check
    check (succeeded or failure_reason is not null),
  constraint login_attempts_country_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$')
);

comment on table public.login_attempts is
  'Every authentication attempt, used for lockout and suspicious login alerts.';

create index login_attempts_email_idx
  on public.login_attempts (email, created_at desc);

create index login_attempts_ip_idx
  on public.login_attempts (ip_address, created_at desc);

create index login_attempts_user_idx
  on public.login_attempts (user_id, created_at desc)
  where user_id is not null;

-- -----------------------------------------------------------------------------

create table public.user_consents (
  id uuid primary key default public.generate_uuid_v7(),
  user_id uuid not null,

  consent_type public.consent_type not null,
  document_version text not null,
  document_hash text,
  granted boolean not null default true,

  ip_address inet,
  user_agent text,
  accepted_at timestamptz not null default now(),
  withdrawn_at timestamptz,

  created_at timestamptz not null default now(),

  constraint user_consents_version_check
    check (length(btrim(document_version)) between 1 and 40),
  constraint user_consents_hash_check
    check (document_hash is null or document_hash ~ '^[0-9a-f]{64}$')
);

comment on table public.user_consents is
  'Recorded acceptance of terms, policies and agreements with proof of context.';

create index user_consents_user_idx
  on public.user_consents (user_id, consent_type, accepted_at desc);

create unique index user_consents_active_unique
  on public.user_consents (user_id, consent_type, document_version)
  where withdrawn_at is null;

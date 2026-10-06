-- supabase/migrations/00017_create_access_grants.sql
-- Accountant access grants and team invitations.
--
-- An accountant holds one login and works across every company that invited
-- them. Access is explicit, revocable and may expire, and it is always read
-- plus bookkeeping only.

create table public.accountant_company_access (
  id uuid primary key default public.generate_uuid_v7(),
  accountant_user_id uuid not null,
  company_id uuid not null,

  status public.access_grant_status not null default 'active',

  -- Modules the accountant may open, for example ["accounting", "reports"].
  scopes jsonb not null default '["accounting", "reports", "expenses"]'::jsonb,

  granted_by uuid,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  last_accessed_at timestamptz,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint accountant_access_scopes_check
    check (jsonb_typeof(scopes) = 'array'),
  constraint accountant_access_expiry_check
    check (expires_at is null or expires_at > granted_at),
  constraint accountant_access_revoked_check
    check (status <> 'revoked' or revoked_at is not null)
);

comment on table public.accountant_company_access is
  'Explicit, revocable grants that let an accountant work inside a company.';

create unique index accountant_access_unique
  on public.accountant_company_access (accountant_user_id, company_id)
  where deleted_at is null;

create index accountant_access_company_idx
  on public.accountant_company_access (company_id, status)
  where deleted_at is null;

create index accountant_access_user_idx
  on public.accountant_company_access (accountant_user_id, status)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Team invitations
-- -----------------------------------------------------------------------------

create table public.team_invitations (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  email citext not null,
  full_name text,
  role public.user_role not null default 'staff',
  permissions jsonb not null default '{}'::jsonb,
  scopes jsonb not null default '[]'::jsonb,

  -- Only the hash of the invitation token is stored, never the token itself.
  token_hash text not null,
  status public.invitation_status not null default 'pending',

  invited_by uuid not null,
  message text,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_user_id uuid,
  revoked_at timestamptz,
  reminder_sent_at timestamptz,
  reminder_count smallint not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint team_invitations_email_check
    check (public.is_valid_email(email::text)),
  constraint team_invitations_role_check
    check (role in ('staff', 'accountant')),
  constraint team_invitations_permissions_check
    check (jsonb_typeof(permissions) = 'object'),
  constraint team_invitations_scopes_check
    check (jsonb_typeof(scopes) = 'array'),
  constraint team_invitations_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint team_invitations_expiry_check
    check (expires_at > created_at),
  constraint team_invitations_accepted_check
    check (status <> 'accepted' or (accepted_at is not null and accepted_user_id is not null)),
  constraint team_invitations_reminder_check
    check (reminder_count between 0 and 10)
);

comment on table public.team_invitations is
  'Pending invitations for staff members and accountants.';
comment on column public.team_invitations.token_hash is
  'SHA-256 of the invitation token. The plain token exists only in the email.';

create unique index team_invitations_token_unique
  on public.team_invitations (token_hash);

create unique index team_invitations_pending_unique
  on public.team_invitations (company_id, email)
  where status = 'pending' and deleted_at is null;

create index team_invitations_company_idx
  on public.team_invitations (company_id, status)
  where deleted_at is null;

create index team_invitations_expiry_idx
  on public.team_invitations (expires_at)
  where status = 'pending' and deleted_at is null;

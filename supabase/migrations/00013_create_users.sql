-- supabase/migrations/00013_create_users.sql
-- Platform accounts. The identifier matches auth.users.id exactly, so the
-- application never has to join across the authentication boundary.
--
-- Clients of a business are not accounts. They are stored as business records
-- and reach their documents through signed links.

create table public.users (
  id uuid primary key,

  -- Populated for owner and staff accounts only. Platform level roles and the
  -- accountant role operate outside a single tenant.
  company_id uuid,

  role public.user_role not null,
  status public.user_status not null default 'pending_verification',

  email citext not null,
  full_name text not null,
  phone text,
  job_title text,
  avatar_url text,
  avatar_storage_key text,

  -- Granular staff permissions, shaped as {"invoices": ["view", "create"]}.
  permissions jsonb not null default '{}'::jsonb,

  locale text not null default 'en-US',
  time_zone text not null default 'UTC',
  notification_preferences jsonb not null default '{}'::jsonb,

  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  manually_verified_at timestamptz,
  manually_verified_by uuid,

  two_factor_enabled boolean not null default false,
  two_factor_enforced_at timestamptz,

  last_login_at timestamptz,
  last_seen_at timestamptz,
  failed_login_count integer not null default 0,
  locked_until timestamptz,

  invited_by uuid,
  accepted_terms_version text,
  accepted_terms_at timestamptz,
  marketing_opt_in boolean not null default false,

  suspended_at timestamptz,
  suspension_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint users_email_valid_check
    check (public.is_valid_email(email::text)),
  constraint users_full_name_check
    check (length(btrim(full_name)) between 2 and 150),
  constraint users_permissions_object_check
    check (jsonb_typeof(permissions) = 'object'),
  constraint users_notification_preferences_object_check
    check (jsonb_typeof(notification_preferences) = 'object'),
  constraint users_failed_login_count_check
    check (failed_login_count >= 0),
  constraint users_suspension_reason_check
    check (suspended_at is null or suspension_reason is not null),

  -- Tenancy shape: owners and staff always belong to a company, every other
  -- role never does. This single constraint prevents an entire class of
  -- cross tenant data leaks.
  constraint users_role_company_check
    check (
      (role in ('owner', 'staff') and company_id is not null)
      or (role in ('super_admin', 'reseller', 'accountant', 'affiliate') and company_id is null)
    ),

  -- Only staff accounts may carry granular permissions.
  constraint users_permissions_role_check
    check (role = 'staff' or permissions = '{}'::jsonb)
);

comment on table public.users is
  'Platform accounts for super admins, resellers, owners, staff, accountants and affiliates.';
comment on column public.users.id is
  'Matches auth.users.id. The profile row is created when the account is created.';
comment on column public.users.permissions is
  'Granular staff permissions keyed by resource, for example {"invoices": ["view"]}.';

create unique index users_email_unique
  on public.users (email)
  where deleted_at is null;

create index users_company_idx
  on public.users (company_id, role)
  where deleted_at is null;

create index users_role_status_idx
  on public.users (role, status)
  where deleted_at is null;

create index users_created_at_idx
  on public.users (created_at desc, id desc)
  where deleted_at is null;

create index users_full_name_trgm_idx
  on public.users using gin (full_name extensions.gin_trgm_ops);

-- Exactly one active owner account per company.
create unique index users_single_owner_per_company
  on public.users (company_id)
  where role = 'owner' and deleted_at is null;

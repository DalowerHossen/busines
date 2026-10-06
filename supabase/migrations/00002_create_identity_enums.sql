-- supabase/migrations/00002_create_identity_enums.sql
-- Enumerated types that describe accounts, tenants and access control.

-- Account roles. Clients of a business never receive an account; they access
-- documents through signed links instead.
create type public.user_role as enum (
  'super_admin',
  'reseller',
  'owner',
  'staff',
  'accountant',
  'affiliate'
);

comment on type public.user_role is
  'Account level roles. Business clients are records, not accounts.';

create type public.user_status as enum (
  'pending_verification',
  'active',
  'suspended',
  'banned',
  'closed'
);

create type public.company_status as enum (
  'onboarding',
  'trialing',
  'active',
  'past_due',
  'suspended',
  'read_only',
  'closed'
);

create type public.invitation_status as enum (
  'pending',
  'accepted',
  'expired',
  'revoked'
);

create type public.reseller_status as enum (
  'pending_review',
  'approved',
  'suspended',
  'terminated'
);

create type public.affiliate_status as enum (
  'pending_review',
  'approved',
  'suspended',
  'terminated'
);

create type public.two_factor_method as enum (
  'totp',
  'recovery_code'
);

create type public.auth_provider as enum (
  'email',
  'google',
  'github'
);

-- Granular permission actions assigned to staff members by a company owner.
create type public.permission_action as enum (
  'view',
  'create',
  'edit',
  'delete',
  'approve',
  'export',
  'send'
);

create type public.access_grant_status as enum (
  'active',
  'revoked',
  'expired'
);

-- supabase/migrations/00002_enum_types.sql
-- Enum types shared by the tables created in this phase. Enums for
-- domains added in later phases (invoice_status, payment_status, and
-- similar) are created in that phase's own migration, not here.

-- All six account roles, per docs/planning/ARCHITECTURE-DECISIONS.md
-- section 2. `super_admin` and `reseller` are platform-level and are
-- recorded on users.platform_role; `owner`, `staff`, and `affiliate` are
-- company-scoped and are recorded on company_memberships.role;
-- `accountant` can be linked to multiple companies (accountant_company_access,
-- added in Phase 15) rather than through company_memberships. There is no
-- seventh enum value for "client": clients never hold an account, they
-- only use tokenized links (see Phase 6 client_access_tokens).
create type account_role as enum (
  'super_admin',
  'reseller',
  'owner',
  'staff',
  'accountant',
  'affiliate'
);

-- Manual-review-only KYC status for a company opting into the platform's
-- Merchant-of-Record payment path. There is no "auto_approved" value: KYC
-- review is always a human decision, never automated.
create type kyc_status as enum (
  'not_started',
  'pending_review',
  'approved',
  'rejected'
);

-- Lifecycle status of a company's subscription to a platform plan.
create type subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'cancelled',
  'downgraded_to_free'
);

-- Billing cadence for a paid plan.
create type billing_cycle as enum (
  'monthly',
  'yearly'
);

-- Second-factor method for account security. Used only to record a user's
-- preference; the actual factor enrollment is managed by Supabase Auth's
-- built-in MFA tables (auth.mfa_factors), except for backup codes which
-- this phase adds its own table for (see 00012_two_factor_backup_codes.sql).
create type two_factor_method as enum (
  'totp',
  'sms'
);

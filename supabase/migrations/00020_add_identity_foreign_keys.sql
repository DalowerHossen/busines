-- supabase/migrations/00020_add_identity_foreign_keys.sql
-- Relationships between the identity tables.
--
-- The constraints are added after every table exists because the graph is
-- circular: a company points at a reseller, a reseller points at a user, and a
-- user points back at a company.
--
-- Deletion policy:
--   restrict  protects financial and audit history
--   cascade   only where the child row has no meaning without its parent
--   set null  for soft references such as "who approved this"

-- The profile row mirrors the authentication record one to one.
alter table public.users
  add constraint users_id_fkey
  foreign key (id) references auth.users (id) on delete cascade;

alter table public.users
  add constraint users_company_id_fkey
  foreign key (company_id) references public.companies (id) on delete restrict;

alter table public.users
  add constraint users_invited_by_fkey
  foreign key (invited_by) references public.users (id) on delete set null;

alter table public.users
  add constraint users_manually_verified_by_fkey
  foreign key (manually_verified_by) references public.users (id) on delete set null;

alter table public.users
  add constraint users_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.users
  add constraint users_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.companies
  add constraint companies_reseller_id_fkey
  foreign key (reseller_id) references public.resellers (id) on delete set null;

alter table public.companies
  add constraint companies_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.companies
  add constraint companies_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.resellers
  add constraint resellers_user_id_fkey
  foreign key (user_id) references public.users (id) on delete restrict;

alter table public.resellers
  add constraint resellers_approved_by_fkey
  foreign key (approved_by) references public.users (id) on delete set null;

alter table public.resellers
  add constraint resellers_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.resellers
  add constraint resellers_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.company_profiles
  add constraint company_profiles_company_id_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.company_profiles
  add constraint company_profiles_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.company_profiles
  add constraint company_profiles_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

-- Snapshots are retained even if the tenant closes, because issued documents
-- must remain reproducible for the statutory archive period.
alter table public.company_profile_snapshots
  add constraint company_profile_snapshots_company_id_fkey
  foreign key (company_id) references public.companies (id) on delete restrict;

alter table public.accountant_company_access
  add constraint accountant_access_user_fkey
  foreign key (accountant_user_id) references public.users (id) on delete cascade;

alter table public.accountant_company_access
  add constraint accountant_access_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.accountant_company_access
  add constraint accountant_access_granted_by_fkey
  foreign key (granted_by) references public.users (id) on delete set null;

alter table public.accountant_company_access
  add constraint accountant_access_revoked_by_fkey
  foreign key (revoked_by) references public.users (id) on delete set null;

alter table public.accountant_company_access
  add constraint accountant_access_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.accountant_company_access
  add constraint accountant_access_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.team_invitations
  add constraint team_invitations_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.team_invitations
  add constraint team_invitations_invited_by_fkey
  foreign key (invited_by) references public.users (id) on delete restrict;

alter table public.team_invitations
  add constraint team_invitations_accepted_user_fkey
  foreign key (accepted_user_id) references public.users (id) on delete set null;

alter table public.team_invitations
  add constraint team_invitations_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.team_invitations
  add constraint team_invitations_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.user_two_factor
  add constraint user_two_factor_user_fkey
  foreign key (user_id) references public.users (id) on delete cascade;

alter table public.user_sessions
  add constraint user_sessions_user_fkey
  foreign key (user_id) references public.users (id) on delete cascade;

alter table public.user_sessions
  add constraint user_sessions_revoked_by_fkey
  foreign key (revoked_by) references public.users (id) on delete set null;

alter table public.login_attempts
  add constraint login_attempts_user_fkey
  foreign key (user_id) references public.users (id) on delete set null;

alter table public.user_consents
  add constraint user_consents_user_fkey
  foreign key (user_id) references public.users (id) on delete cascade;

-- The audit trail keeps its rows even when the actor or tenant is removed.
alter table public.audit_logs
  add constraint audit_logs_company_fkey
  foreign key (company_id) references public.companies (id) on delete set null;

alter table public.audit_logs
  add constraint audit_logs_actor_fkey
  foreign key (actor_id) references public.users (id) on delete set null;

alter table public.audit_logs
  add constraint audit_logs_impersonator_fkey
  foreign key (impersonator_id) references public.users (id) on delete set null;

alter table public.document_number_counters
  add constraint document_number_counters_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

-- Indexes that support the foreign keys used in hot paths.
create index users_invited_by_idx on public.users (invited_by) where invited_by is not null;
create index team_invitations_invited_by_idx on public.team_invitations (invited_by);
create index audit_logs_impersonator_idx
  on public.audit_logs (impersonator_id)
  where impersonator_id is not null;

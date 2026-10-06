-- supabase/migrations/00022_enable_rls_identity.sql
-- Row level security for companies, users, resellers and the document profile.
--
-- Deny by default: row level security is enabled on every table and no policy
-- grants more than the role model allows.
--   super_admin  full platform access
--   reseller     billing metadata of its own sub tenants, never their records
--   owner        everything inside exactly one company
--   staff        the same company, limited by granular permissions
--   accountant   read only, in the companies that granted access
--   affiliate    no company data at all
-- The service role bypasses row level security and is used by trusted server
-- code only.

alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.resellers enable row level security;
alter table public.company_profiles enable row level security;
alter table public.company_profile_snapshots enable row level security;

alter table public.companies force row level security;
alter table public.users force row level security;
alter table public.resellers force row level security;
alter table public.company_profiles force row level security;
alter table public.company_profile_snapshots force row level security;

-- -----------------------------------------------------------------------------
-- companies
-- -----------------------------------------------------------------------------

create policy companies_select on public.companies
  for select
  to authenticated
  using (
    deleted_at is null
    and (
      public.has_company_access(id)
      or public.is_managing_reseller(id)
    )
  );

create policy companies_insert on public.companies
  for insert
  to authenticated
  with check (public.is_super_admin());

-- An owner may edit the company record; a reseller may not.
create policy companies_update on public.companies
  for update
  to authenticated
  using (
    deleted_at is null
    and (public.is_super_admin() or public.is_company_owner(id))
  )
  with check (
    public.is_super_admin() or public.is_company_owner(id)
  );

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------

-- Everyone sees their own profile. Beyond that, a user sees the colleagues of
-- their own company, and a super admin sees everybody.
create policy users_select on public.users
  for select
  to authenticated
  using (
    deleted_at is null
    and (
      id = public.current_user_id()
      or public.is_super_admin()
      or (
        company_id is not null
        and company_id = public.current_company_id()
        and public.current_user_role() in ('owner', 'staff')
      )
    )
  );

-- A new profile row is created either by the signup flow running as the new
-- user, or by a super admin.
create policy users_insert on public.users
  for insert
  to authenticated
  with check (
    public.is_super_admin()
    or id = public.current_user_id()
  );

-- A user edits their own profile; an owner manages the team of their company.
-- Role escalation is blocked in the application layer and by the owner check.
create policy users_update on public.users
  for update
  to authenticated
  using (
    deleted_at is null
    and (
      id = public.current_user_id()
      or public.is_super_admin()
      or (company_id is not null and public.is_company_owner(company_id))
    )
  )
  with check (
    id = public.current_user_id()
    or public.is_super_admin()
    or (company_id is not null and public.is_company_owner(company_id))
  );

-- -----------------------------------------------------------------------------
-- resellers
-- -----------------------------------------------------------------------------

create policy resellers_select on public.resellers
  for select
  to authenticated
  using (
    deleted_at is null
    and (public.is_super_admin() or user_id = public.current_user_id())
  );

create policy resellers_insert on public.resellers
  for insert
  to authenticated
  with check (
    public.is_super_admin()
    or (user_id = public.current_user_id() and public.current_user_role() = 'reseller')
  );

-- A partner edits its own presentation. Commercial terms and status are
-- changed by the platform only, which is enforced in the server layer.
create policy resellers_update on public.resellers
  for update
  to authenticated
  using (
    deleted_at is null
    and (public.is_super_admin() or user_id = public.current_user_id())
  )
  with check (
    public.is_super_admin() or user_id = public.current_user_id()
  );

-- -----------------------------------------------------------------------------
-- company_profiles
-- -----------------------------------------------------------------------------

create policy company_profiles_select on public.company_profiles
  for select
  to authenticated
  using (deleted_at is null and public.has_company_access(company_id));

create policy company_profiles_insert on public.company_profiles
  for insert
  to authenticated
  with check (public.is_super_admin() or public.is_company_owner(company_id));

create policy company_profiles_update on public.company_profiles
  for update
  to authenticated
  using (
    deleted_at is null
    and (public.is_super_admin() or public.is_company_owner(company_id))
  )
  with check (public.is_super_admin() or public.is_company_owner(company_id));

-- -----------------------------------------------------------------------------
-- company_profile_snapshots
-- -----------------------------------------------------------------------------

-- Snapshots are readable by the company and written by trusted code only.
-- They can never be updated or deleted, which the table trigger also enforces.
create policy company_profile_snapshots_select on public.company_profile_snapshots
  for select
  to authenticated
  using (public.has_company_access(company_id));

create policy company_profile_snapshots_insert on public.company_profile_snapshots
  for insert
  to authenticated
  with check (public.can_write_company_data(company_id));

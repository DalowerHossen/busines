-- supabase/migrations/00023_enable_rls_access_and_security.sql
-- Row level security for access grants, invitations, account security data and
-- the audit trail.
--
-- Account security rows belong to one person. Nobody else may read a two factor
-- secret, a session token hash or a consent record, not even the owner of the
-- company, and a super admin only sees what is needed to support an account.

alter table public.accountant_company_access enable row level security;
alter table public.team_invitations enable row level security;
alter table public.user_two_factor enable row level security;
alter table public.user_sessions enable row level security;
alter table public.login_attempts enable row level security;
alter table public.user_consents enable row level security;
alter table public.audit_logs enable row level security;

alter table public.accountant_company_access force row level security;
alter table public.team_invitations force row level security;
alter table public.user_two_factor force row level security;
alter table public.user_sessions force row level security;
alter table public.login_attempts force row level security;
alter table public.user_consents force row level security;
alter table public.audit_logs force row level security;

-- -----------------------------------------------------------------------------
-- accountant_company_access
-- -----------------------------------------------------------------------------

-- The accountant sees their own grants; the company sees who it invited.
create policy accountant_access_select on public.accountant_company_access
  for select
  to authenticated
  using (
    deleted_at is null
    and (
      public.is_super_admin()
      or accountant_user_id = public.current_user_id()
      or (
        company_id = public.current_company_id()
        and public.current_user_role() in ('owner', 'staff')
      )
    )
  );

-- Only the owner of the company may grant access.
create policy accountant_access_insert on public.accountant_company_access
  for insert
  to authenticated
  with check (public.is_super_admin() or public.is_company_owner(company_id));

-- The owner revokes a grant; the accountant may only decline it, which is also
-- an update, so both sides are allowed to write.
create policy accountant_access_update on public.accountant_company_access
  for update
  to authenticated
  using (
    deleted_at is null
    and (
      public.is_super_admin()
      or public.is_company_owner(company_id)
      or accountant_user_id = public.current_user_id()
    )
  )
  with check (
    public.is_super_admin()
    or public.is_company_owner(company_id)
    or accountant_user_id = public.current_user_id()
  );

-- -----------------------------------------------------------------------------
-- team_invitations
-- -----------------------------------------------------------------------------

create policy team_invitations_select on public.team_invitations
  for select
  to authenticated
  using (
    deleted_at is null
    and (
      public.is_super_admin()
      or (
        company_id = public.current_company_id()
        and public.current_user_role() in ('owner', 'staff')
      )
    )
  );

create policy team_invitations_insert on public.team_invitations
  for insert
  to authenticated
  with check (public.is_super_admin() or public.is_company_owner(company_id));

create policy team_invitations_update on public.team_invitations
  for update
  to authenticated
  using (
    deleted_at is null
    and (public.is_super_admin() or public.is_company_owner(company_id))
  )
  with check (public.is_super_admin() or public.is_company_owner(company_id));

-- -----------------------------------------------------------------------------
-- user_two_factor
-- -----------------------------------------------------------------------------

-- Strictly private. The encrypted secret is never exposed to another account,
-- and a super admin may disable two factor only through a server side routine.
create policy user_two_factor_select on public.user_two_factor
  for select
  to authenticated
  using (user_id = public.current_user_id());

create policy user_two_factor_insert on public.user_two_factor
  for insert
  to authenticated
  with check (user_id = public.current_user_id());

create policy user_two_factor_update on public.user_two_factor
  for update
  to authenticated
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy user_two_factor_delete on public.user_two_factor
  for delete
  to authenticated
  using (user_id = public.current_user_id());

-- -----------------------------------------------------------------------------
-- user_sessions
-- -----------------------------------------------------------------------------

create policy user_sessions_select on public.user_sessions
  for select
  to authenticated
  using (user_id = public.current_user_id() or public.is_super_admin());

-- A person may sign a device out; a super admin may end a session during an
-- incident. Sessions are created by the server layer.
create policy user_sessions_update on public.user_sessions
  for update
  to authenticated
  using (user_id = public.current_user_id() or public.is_super_admin())
  with check (user_id = public.current_user_id() or public.is_super_admin());

-- -----------------------------------------------------------------------------
-- login_attempts
-- -----------------------------------------------------------------------------

-- A person reviews their own sign in history. Failed attempts that carry no
-- user reference stay visible to the platform team only.
create policy login_attempts_select on public.login_attempts
  for select
  to authenticated
  using (
    public.is_super_admin()
    or (user_id is not null and user_id = public.current_user_id())
  );

-- -----------------------------------------------------------------------------
-- user_consents
-- -----------------------------------------------------------------------------

create policy user_consents_select on public.user_consents
  for select
  to authenticated
  using (user_id = public.current_user_id() or public.is_super_admin());

create policy user_consents_insert on public.user_consents
  for insert
  to authenticated
  with check (user_id = public.current_user_id());

-- -----------------------------------------------------------------------------
-- audit_logs
-- -----------------------------------------------------------------------------

-- The trail is readable, never writable from a client session. An affiliate
-- sees only the entries it generated itself, which keeps the programme blind to
-- the rest of the platform.
create policy audit_logs_select on public.audit_logs
  for select
  to authenticated
  using (
    public.is_super_admin()
    or (
      public.current_user_role() = 'affiliate'
      and actor_id = public.current_user_id()
    )
    or (
      public.current_user_role() in ('owner', 'staff', 'accountant')
      and company_id is not null
      and public.has_company_access(company_id)
    )
    or actor_id = public.current_user_id()
  );

comment on policy audit_logs_select on public.audit_logs is
  'Read only access to the trail, scoped to the company or to the actor.';

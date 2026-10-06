-- supabase/migrations/00169_phase17_rls_core_crm_invoicing_payments.sql
-- Phase 17: default-deny RLS for core identity, CRM, invoicing, estimates,
-- payments, and payment evidence tables. Phase 18 adds the remaining
-- accounting, inventory, wallet, KYC, reseller, accountant, affiliate, and
-- platform-admin policies. Phase 20 adds the application client/repository
-- boundary that uses these policies.
--
-- These policies deliberately do not expose token hashes, OTP hashes,
-- provider tokens, webhook payloads, or evidence mutations to browser roles.
-- Trusted server code using the Supabase service role performs those
-- operations after repeating authentication, authorization, tenant, and
-- validation checks. Service-role access is not a substitute for those
-- checks; it is the only boundary for provider callbacks and token links.

create function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.users as u
    where u.id = (select auth.uid())
      and u.platform_role = 'super_admin'::account_role
      and u.deleted_at is null
  );
$$;

comment on function public.is_super_admin() is
  'Returns true only for the active authenticated user whose platform role is super_admin.';

create function public.current_user_owns_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.companies as c
    where c.id = p_company_id
      and c.owner_user_id = (select auth.uid())
      and c.deleted_at is null
  );
$$;

comment on function public.current_user_owns_company(uuid) is
  'Returns true when the authenticated user owns an active company, including a suspended company.';

create function public.current_user_can_manage_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.companies as c
      where c.id = p_company_id
        and c.owner_user_id = (select auth.uid())
        and c.deleted_at is null
        and not c.is_suspended
    );
$$;

comment on function public.current_user_can_manage_company(uuid) is
  'Returns true for super_admin or a non-suspended company owner; suspended owners retain read access but lose mutation access.';

create function public.current_user_has_company_access(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.companies as c
      where c.id = p_company_id
        and c.owner_user_id = (select auth.uid())
        and c.deleted_at is null
    )
    or exists (
      select 1
      from public.company_memberships as m
      join public.companies as c on c.id = m.company_id
      where m.company_id = p_company_id
        and m.user_id = (select auth.uid())
        and m.role in ('owner'::account_role, 'staff'::account_role)
        and m.is_active
        and m.deleted_at is null
        and c.deleted_at is null
    );
$$;

comment on function public.current_user_has_company_access(uuid) is
  'Returns true when the active authenticated user can enter an active company through ownership or an active membership.';

create function public.current_user_has_company_role(
  p_company_id uuid,
  p_roles account_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_super_admin()
    or (
      'owner'::account_role = any (p_roles)
      and public.current_user_owns_company(p_company_id)
    )
    or exists (
      select 1
      from public.company_memberships as m
      join public.companies as c on c.id = m.company_id
      where m.company_id = p_company_id
        and m.user_id = (select auth.uid())
        and m.role = any (p_roles)
        and m.is_active
        and m.deleted_at is null
        and c.deleted_at is null
    );
$$;

comment on function public.current_user_has_company_role(uuid, account_role[]) is
  'Returns true for super_admin, the company owner when owner is requested, or an active matching company membership.';

create function public.current_user_has_company_permission(
  p_company_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.companies as c
      where c.id = p_company_id
        and c.owner_user_id = (select auth.uid())
        and c.deleted_at is null
        and (
          p_permission like 'read:%'
          or not c.is_suspended
        )
    )
    or exists (
      select 1
      from public.company_memberships as m
      join public.companies as c on c.id = m.company_id
      where m.company_id = p_company_id
        and m.user_id = (select auth.uid())
        and m.role = 'staff'::account_role
        and (
          p_permission = any (m.permissions)
          or (
            p_permission like 'read:%'
            and substring(p_permission from 6) = any (m.permissions)
          )
        )
        and m.is_active
        and m.deleted_at is null
        and c.deleted_at is null
        and (
          p_permission like 'read:%'
          or not c.is_suspended
        )
    );
$$;

comment on function public.current_user_has_company_permission(uuid, text) is
  'Returns true for super_admin, the company owner, or an active staff member with the exact stored permission.';

create function public.current_user_can_edit_invoice(
  p_company_id uuid,
  p_status invoice_status
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_super_admin()
    or public.current_user_owns_company(p_company_id)
    or (
      p_status = 'draft'::invoice_status
      and public.current_user_has_company_permission(p_company_id, 'manage_invoices')
    );
$$;

comment on function public.current_user_can_edit_invoice(uuid, invoice_status) is
  'Allows owners and super_admins to edit an invoice, while staff can edit draft invoices only.';

create function public.current_user_can_edit_estimate(
  p_company_id uuid,
  p_status estimate_status
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_super_admin()
    or public.current_user_owns_company(p_company_id)
    or (
      p_status = 'draft'::estimate_status
      and public.current_user_has_company_permission(p_company_id, 'manage_estimates')
    );
$$;

comment on function public.current_user_can_edit_estimate(uuid, estimate_status) is
  'Allows owners and super_admins to edit an estimate, while staff can edit draft estimates only.';

create function public.current_user_can_edit_invoice_children(
  p_company_id uuid,
  p_invoice_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.invoices as i
    where i.id = p_invoice_id
      and i.company_id = p_company_id
      and public.current_user_can_edit_invoice(i.company_id, i.status)
  );
$$;

create function public.current_user_can_edit_estimate_children(
  p_company_id uuid,
  p_estimate_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.estimates as e
    where e.id = p_estimate_id
      and e.company_id = p_company_id
      and public.current_user_can_edit_estimate(e.company_id, e.status)
  );
$$;

comment on function public.current_user_can_edit_invoice_children(uuid, uuid) is
  'Checks the parent invoice tenant and draft/owner edit boundary for child rows.';
comment on function public.current_user_can_edit_estimate_children(uuid, uuid) is
  'Checks the parent estimate tenant and draft/owner edit boundary for child rows.';

revoke all on function public.is_super_admin() from public;
revoke all on function public.current_user_owns_company(uuid) from public;
revoke all on function public.current_user_can_manage_company(uuid) from public;
revoke all on function public.current_user_has_company_access(uuid) from public;
revoke all on function public.current_user_has_company_role(uuid, account_role[]) from public;
revoke all on function public.current_user_has_company_permission(uuid, text) from public;
revoke all on function public.current_user_can_edit_invoice(uuid, invoice_status) from public;
revoke all on function public.current_user_can_edit_estimate(uuid, estimate_status) from public;
revoke all on function public.current_user_can_edit_invoice_children(uuid, uuid) from public;
revoke all on function public.current_user_can_edit_estimate_children(uuid, uuid) from public;

grant execute on function public.is_super_admin() to authenticated, service_role;
grant execute on function public.current_user_owns_company(uuid) to authenticated, service_role;
grant execute on function public.current_user_can_manage_company(uuid) to authenticated, service_role;
grant execute on function public.current_user_has_company_access(uuid) to authenticated, service_role;
grant execute on function public.current_user_has_company_role(uuid, account_role[]) to authenticated, service_role;
grant execute on function public.current_user_has_company_permission(uuid, text) to authenticated, service_role;
grant execute on function public.current_user_can_edit_invoice(uuid, invoice_status) to authenticated, service_role;
grant execute on function public.current_user_can_edit_estimate(uuid, estimate_status) to authenticated, service_role;
grant execute on function public.current_user_can_edit_invoice_children(uuid, uuid) to authenticated, service_role;
grant execute on function public.current_user_can_edit_estimate_children(uuid, uuid) to authenticated, service_role;

-- Enable and force RLS before adding policies. The explicit table list is
-- kept here so a future reviewer can compare the Phase 17 coverage directly
-- with the core/CRM/invoicing/estimates/payments migration inventory.
do $$
declare
  table_name text;
begin
  foreach table_name in array ARRAY[
    'users',
    'companies',
    'company_memberships',
    'company_profiles',
    'company_profile_snapshots',
    'plans',
    'subscriptions',
    'system_settings',
    'user_sessions',
    'two_factor_backup_codes',
    'client_groups',
    'clients',
    'client_tags',
    'client_tag_assignments',
    'client_reminders',
    'client_notes',
    'client_attachments',
    'client_credit_balance_entries',
    'client_access_tokens',
    'client_access_otp_codes',
    'client_access_logs',
    'invoices',
    'invoice_line_items',
    'invoice_attachments',
    'invoice_comments',
    'invoice_installments',
    'invoice_templates',
    'estimates',
    'estimate_line_items',
    'recurring_invoice_templates',
    'recurring_invoice_template_line_items',
    'credit_notes',
    'credit_note_line_items',
    'debit_notes',
    'debit_note_line_items',
    'saved_payment_methods',
    'payments',
    'refunds',
    'chargebacks',
    'gateway_webhook_events',
    'payment_consent_records',
    'delivery_acceptance_records',
    'dispute_audit_events',
    'dispute_evidence_packs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', table_name);
  end loop;
end;
$$;

-- Core identity and company boundary.
grant select on public.users to authenticated;
grant update (full_name, avatar_provider_file_id, preferred_two_factor_method)
  on public.users to authenticated;
create policy users_select_self_or_super_admin
  on public.users for select to authenticated
  using (id = (select auth.uid()) or (select public.is_super_admin()));
create policy users_update_self_profile
  on public.users for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select on public.companies to authenticated;
grant insert (owner_user_id, name, slug) on public.companies to authenticated;
grant update (name, slug) on public.companies to authenticated;
create policy companies_select_member_or_super_admin
  on public.companies for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_access(id))
    )
  );
create policy companies_insert_self_owned
  on public.companies for insert to authenticated
  with check (owner_user_id = (select auth.uid()));
create policy companies_update_owner_or_super_admin
  on public.companies for update to authenticated
  using (
    (select public.is_super_admin())
    or (
      owner_user_id = (select auth.uid())
      and (select public.current_user_can_manage_company(id))
    )
  )
  with check (
    (select public.is_super_admin())
    or (
      owner_user_id = (select auth.uid())
      and (select public.current_user_can_manage_company(id))
    )
  );

grant select, insert, update on public.company_memberships to authenticated;
create policy memberships_select_self_owner_or_super_admin
  on public.company_memberships for select to authenticated
  using (
    (select public.is_super_admin())
    or user_id = (select auth.uid())
    or (
      deleted_at is null
      and (select public.current_user_owns_company(company_id))
    )
  );
create policy memberships_insert_company_owner
  on public.company_memberships for insert to authenticated
  with check (
    (select public.current_user_can_manage_company(company_id))
    or (select public.is_super_admin())
  );
create policy memberships_update_company_owner
  on public.company_memberships for update to authenticated
  using (
    (select public.current_user_can_manage_company(company_id))
    or (select public.is_super_admin())
  )
  with check (
    (select public.current_user_can_manage_company(company_id))
    or (select public.is_super_admin())
  );

grant select, insert, update on public.company_profiles to authenticated;
create policy company_profiles_select_members
  on public.company_profiles for select to authenticated
  using ((select public.current_user_has_company_access(company_id)));
create policy company_profiles_insert_owner
  on public.company_profiles for insert to authenticated
  with check (
    (select public.current_user_can_manage_company(company_id))
    or (select public.is_super_admin())
  );
create policy company_profiles_update_owner
  on public.company_profiles for update to authenticated
  using (
    (select public.current_user_can_manage_company(company_id))
    or (select public.is_super_admin())
  )
  with check (
    (select public.current_user_can_manage_company(company_id))
    or (select public.is_super_admin())
  );

grant select on public.company_profile_snapshots to authenticated;
create policy profile_snapshots_select_members
  on public.company_profile_snapshots for select to authenticated
  using (
    (select public.is_super_admin())
    or (select public.current_user_has_company_access(company_id))
  );

grant select on public.plans to anon, authenticated;
grant insert, update on public.plans to authenticated;
create policy plans_select_public_catalog_anon
  on public.plans for select to anon
  using (is_publicly_visible and deleted_at is null);
create policy plans_select_catalog_authenticated
  on public.plans for select to authenticated
  using ((is_publicly_visible and deleted_at is null) or (select public.is_super_admin()));
create policy plans_insert_super_admin
  on public.plans for insert to authenticated
  with check ((select public.is_super_admin()));
create policy plans_update_super_admin
  on public.plans for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));

grant select on public.subscriptions to authenticated;
create policy subscriptions_select_owner_or_super_admin
  on public.subscriptions for select to authenticated
  using (
    (select public.is_super_admin())
    or (select public.current_user_owns_company(company_id))
  );

-- Settings and security artifacts are server-only until the Phase 20
-- encrypted server/repository boundary exists. RLS is enabled and no
-- authenticated or anonymous table privilege is granted here.

-- Session metadata may only be read or revoked by the session owner.
grant select, update on public.user_sessions to authenticated;
create policy user_sessions_select_self_or_super_admin
  on public.user_sessions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_super_admin()));
create policy user_sessions_update_self
  on public.user_sessions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      active_company_id is null
      or (select public.current_user_has_company_access(active_company_id))
    )
  );

-- Backup-code hashes are server-only and therefore intentionally have no
-- authenticated policy or table grant.

-- CRM tables. Staff access is permission-scoped; owners and super_admins
-- receive the complete tenant scope. Soft-delete rows are hidden from
-- tenant roles, while super_admin can inspect them for administration.
grant select, insert, update on public.client_groups to authenticated;
create policy client_groups_select
  on public.client_groups for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_clients'))
    )
  );
create policy client_groups_insert
  on public.client_groups for insert to authenticated
  with check ((select public.current_user_has_company_permission(company_id, 'manage_clients')));
create policy client_groups_update
  on public.client_groups for update to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'manage_clients'))
    )
  )
  with check ((select public.current_user_has_company_permission(company_id, 'manage_clients')));

grant select, insert, update on public.clients to authenticated;
create policy clients_select
  on public.clients for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_clients'))
    )
  );
create policy clients_insert
  on public.clients for insert to authenticated
  with check (
    (select public.current_user_has_company_permission(company_id, 'manage_clients'))
    and (
      group_id is null
      or exists (
        select 1 from public.client_groups as g
        where g.id = clients.group_id
          and g.company_id = clients.company_id
          and g.deleted_at is null
      )
    )
  );
create policy clients_update
  on public.clients for update to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'manage_clients'))
    )
  )
  with check (
    (select public.current_user_has_company_permission(company_id, 'manage_clients'))
    and (
      group_id is null
      or exists (
        select 1 from public.client_groups as g
        where g.id = clients.group_id
          and g.company_id = clients.company_id
          and g.deleted_at is null
      )
    )
  );

grant select, insert, update on public.client_tags to authenticated;
create policy client_tags_select
  on public.client_tags for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_clients'))
    )
  );
create policy client_tags_insert
  on public.client_tags for insert to authenticated
  with check ((select public.current_user_has_company_permission(company_id, 'manage_clients')));
create policy client_tags_update
  on public.client_tags for update to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'manage_clients'))
    )
  )
  with check ((select public.current_user_has_company_permission(company_id, 'manage_clients')));

grant select, insert, delete on public.client_tag_assignments to authenticated;
create policy client_tag_assignments_select
  on public.client_tag_assignments for select to authenticated
  using (
    (select public.is_super_admin())
    or (select public.current_user_has_company_permission(company_id, 'read:manage_clients'))
  );
create policy client_tag_assignments_insert
  on public.client_tag_assignments for insert to authenticated
  with check (
    (select public.current_user_has_company_permission(company_id, 'manage_clients'))
    and exists (
      select 1 from public.clients as c
      where c.id = client_tag_assignments.client_id
        and c.company_id = client_tag_assignments.company_id
        and c.deleted_at is null
    )
    and exists (
      select 1 from public.client_tags as t
      where t.id = client_tag_assignments.tag_id
        and t.company_id = client_tag_assignments.company_id
        and t.deleted_at is null
    )
  );
create policy client_tag_assignments_delete
  on public.client_tag_assignments for delete to authenticated
  using (
    (select public.is_super_admin())
    or (select public.current_user_has_company_permission(company_id, 'manage_clients'))
  );

grant select, insert, update on public.client_reminders to authenticated;
create policy client_reminders_select
  on public.client_reminders for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_clients'))
    )
  );
create policy client_reminders_insert
  on public.client_reminders for insert to authenticated
  with check (
    (select public.current_user_has_company_permission(company_id, 'manage_clients'))
    and exists (
      select 1 from public.clients as c
      where c.id = client_reminders.client_id
        and c.company_id = client_reminders.company_id
        and c.deleted_at is null
    )
  );
create policy client_reminders_update
  on public.client_reminders for update to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'manage_clients'))
    )
  )
  with check ((select public.current_user_has_company_permission(company_id, 'manage_clients')));

grant select, insert, update on public.client_notes to authenticated;
create policy client_notes_select
  on public.client_notes for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_clients'))
    )
  );
create policy client_notes_insert
  on public.client_notes for insert to authenticated
  with check (
    author_user_id = (select auth.uid())
    and (select public.current_user_has_company_permission(company_id, 'manage_clients'))
    and exists (
      select 1 from public.clients as c
      where c.id = client_notes.client_id
        and c.company_id = client_notes.company_id
        and c.deleted_at is null
    )
  );
create policy client_notes_update
  on public.client_notes for update to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'manage_clients'))
    )
  )
  with check ((select public.current_user_has_company_permission(company_id, 'manage_clients')));

grant select, insert, update on public.client_attachments to authenticated;
create policy client_attachments_select
  on public.client_attachments for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_clients'))
    )
  );
create policy client_attachments_insert
  on public.client_attachments for insert to authenticated
  with check (
    uploaded_by_user_id = (select auth.uid())
    and (select public.current_user_has_company_permission(company_id, 'manage_clients'))
    and exists (
      select 1 from public.clients as c
      where c.id = client_attachments.client_id
        and c.company_id = client_attachments.company_id
        and c.deleted_at is null
    )
  );
create policy client_attachments_update
  on public.client_attachments for update to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'manage_clients'))
    )
  )
  with check ((select public.current_user_has_company_permission(company_id, 'manage_clients')));

grant select, insert, update on public.client_credit_balance_entries to authenticated;
create policy client_credit_entries_select
  on public.client_credit_balance_entries for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_clients'))
    )
  );
create policy client_credit_entries_insert
  on public.client_credit_balance_entries for insert to authenticated
  with check (
    created_by_user_id = (select auth.uid())
    and (select public.current_user_has_company_permission(company_id, 'manage_clients'))
    and exists (
      select 1 from public.clients as c
      where c.id = client_credit_balance_entries.client_id
        and c.company_id = client_credit_balance_entries.company_id
        and c.deleted_at is null
    )
    and (
      related_invoice_id is null
      or exists (
        select 1 from public.invoices as i
        where i.id = client_credit_balance_entries.related_invoice_id
          and i.company_id = client_credit_balance_entries.company_id
          and i.deleted_at is null
      )
    )
  );
create policy client_credit_entries_update
  on public.client_credit_balance_entries for update to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'manage_clients'))
    )
  )
  with check ((select public.current_user_has_company_permission(company_id, 'manage_clients')));

-- Token records are owner/server-only because token hashes are bearer-secret
-- material. Public token requests, OTP rows, and view logs use the trusted
-- server boundary and never receive an anon table policy.
grant select, insert, update on public.client_access_tokens to authenticated;
create policy client_access_tokens_select_owner
  on public.client_access_tokens for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_owns_company(company_id))
    )
  );
create policy client_access_tokens_insert_owner
  on public.client_access_tokens for insert to authenticated
  with check (
    (select public.current_user_can_manage_company(company_id))
    and exists (
      select 1 from public.clients as c
      where c.id = client_access_tokens.client_id
        and c.company_id = client_access_tokens.company_id
        and c.deleted_at is null
    )
  );
create policy client_access_tokens_update_owner
  on public.client_access_tokens for update to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_can_manage_company(company_id))
    )
  )
  with check ((select public.current_user_can_manage_company(company_id)));

-- No authenticated grants or policies are added for client_access_otp_codes
-- and client_access_logs. Their hashes and visitor metadata stay server-only.

-- Invoice and estimate parent rows.
grant select, insert, update on public.invoices to authenticated;
create policy invoices_select
  on public.invoices for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_invoices'))
    )
  );
create policy invoices_insert
  on public.invoices for insert to authenticated
  with check (
    created_by_user_id = (select auth.uid())
    and (select public.current_user_can_edit_invoice(company_id, status))
    and exists (
      select 1 from public.clients as c
      where c.id = invoices.client_id
        and c.company_id = invoices.company_id
        and c.deleted_at is null
    )
    and exists (
      select 1 from public.company_profile_snapshots as s
      where s.id = invoices.company_profile_snapshot_id
        and s.company_id = invoices.company_id
    )
    and (
      template_id is null
      or exists (
        select 1 from public.invoice_templates as t
        where t.id = invoices.template_id
          and t.deleted_at is null
          and (t.is_built_in or t.company_id = invoices.company_id)
      )
    )
  );
create policy invoices_update
  on public.invoices for update to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_can_edit_invoice(company_id, status))
    )
  )
  with check (
    (select public.current_user_can_edit_invoice(company_id, status))
    and exists (
      select 1 from public.clients as c
      where c.id = invoices.client_id
        and c.company_id = invoices.company_id
        and c.deleted_at is null
    )
  );

grant select, insert, update on public.invoice_line_items to authenticated;
create policy invoice_line_items_select
  on public.invoice_line_items for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_invoices'))
      and exists (
        select 1 from public.invoices as i
        where i.id = invoice_line_items.invoice_id
          and i.company_id = invoice_line_items.company_id
          and i.deleted_at is null
      )
    )
  );
create policy invoice_line_items_insert
  on public.invoice_line_items for insert to authenticated
  with check (
    (select public.current_user_can_edit_invoice_children(company_id, invoice_id))
  );
create policy invoice_line_items_update
  on public.invoice_line_items for update to authenticated
  using (
    (select public.current_user_can_edit_invoice_children(company_id, invoice_id))
  )
  with check (
    (select public.current_user_can_edit_invoice_children(company_id, invoice_id))
  );

grant select, insert, update on public.invoice_attachments to authenticated;
create policy invoice_attachments_select
  on public.invoice_attachments for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_invoices'))
      and exists (
        select 1 from public.invoices as i
        where i.id = invoice_attachments.invoice_id
          and i.company_id = invoice_attachments.company_id
          and i.deleted_at is null
      )
    )
  );
create policy invoice_attachments_insert
  on public.invoice_attachments for insert to authenticated
  with check (
    uploaded_by_user_id = (select auth.uid())
    and (select public.current_user_can_edit_invoice_children(company_id, invoice_id))
  );
create policy invoice_attachments_update
  on public.invoice_attachments for update to authenticated
  using (
    (select public.current_user_can_edit_invoice_children(company_id, invoice_id))
  )
  with check (
    (select public.current_user_can_edit_invoice_children(company_id, invoice_id))
  );

grant select, insert on public.invoice_comments to authenticated;
create policy invoice_comments_select
  on public.invoice_comments for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_invoices'))
      and exists (
        select 1 from public.invoices as i
        where i.id = invoice_comments.invoice_id
          and i.company_id = invoice_comments.company_id
          and i.deleted_at is null
      )
    )
  );
create policy invoice_comments_insert
  on public.invoice_comments for insert to authenticated
  with check (
    author_user_id = (select auth.uid())
    and (select public.current_user_has_company_permission(company_id, 'manage_invoices'))
    and exists (
      select 1 from public.invoices as i
      where i.id = invoice_comments.invoice_id
        and i.company_id = invoice_comments.company_id
        and i.deleted_at is null
    )
  );

grant select, insert, update on public.invoice_installments to authenticated;
create policy invoice_installments_select
  on public.invoice_installments for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_invoices'))
      and exists (
        select 1 from public.invoices as i
        where i.id = invoice_installments.invoice_id
          and i.company_id = invoice_installments.company_id
          and i.deleted_at is null
      )
    )
  );
create policy invoice_installments_insert
  on public.invoice_installments for insert to authenticated
  with check ((select public.current_user_can_edit_invoice_children(company_id, invoice_id)));
create policy invoice_installments_update
  on public.invoice_installments for update to authenticated
  using ((select public.current_user_can_edit_invoice_children(company_id, invoice_id)))
  with check ((select public.current_user_can_edit_invoice_children(company_id, invoice_id)));

-- Built-in templates are public-read; tenant templates require the invoice
-- permission. Only super_admin can mutate built-in rows.
grant select on public.invoice_templates to anon, authenticated;
grant insert, update on public.invoice_templates to authenticated;
create policy invoice_templates_select_anon
  on public.invoice_templates for select to anon
  using (is_built_in and deleted_at is null);
create policy invoice_templates_select_authenticated
  on public.invoice_templates for select to authenticated
  using (
    (is_built_in and deleted_at is null)
    or (select public.is_super_admin())
    or (
      not is_built_in
      and deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_invoices'))
    )
  );
create policy invoice_templates_insert
  on public.invoice_templates for insert to authenticated
  with check (
    (select public.is_super_admin())
    or (
      not is_built_in
      and (select public.current_user_has_company_permission(company_id, 'manage_invoices'))
    )
  );
create policy invoice_templates_update
  on public.invoice_templates for update to authenticated
  using (
    (select public.is_super_admin())
    or (
      not is_built_in
      and (select public.current_user_has_company_permission(company_id, 'manage_invoices'))
    )
  )
  with check (
    (select public.is_super_admin())
    or (
      not is_built_in
      and (select public.current_user_has_company_permission(company_id, 'manage_invoices'))
    )
  );

grant select, insert, update on public.estimates to authenticated;
create policy estimates_select
  on public.estimates for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_estimates'))
    )
  );
create policy estimates_insert
  on public.estimates for insert to authenticated
  with check (
    created_by_user_id = (select auth.uid())
    and (select public.current_user_can_edit_estimate(company_id, status))
    and exists (
      select 1 from public.clients as c
      where c.id = estimates.client_id
        and c.company_id = estimates.company_id
        and c.deleted_at is null
    )
    and exists (
      select 1 from public.company_profile_snapshots as s
      where s.id = estimates.company_profile_snapshot_id
        and s.company_id = estimates.company_id
    )
  );
create policy estimates_update
  on public.estimates for update to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_can_edit_estimate(company_id, status))
    )
  )
  with check (
    (select public.current_user_can_edit_estimate(company_id, status))
    and exists (
      select 1 from public.clients as c
      where c.id = estimates.client_id
        and c.company_id = estimates.company_id
        and c.deleted_at is null
    )
  );

grant select, insert, update on public.estimate_line_items to authenticated;
create policy estimate_line_items_select
  on public.estimate_line_items for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_estimates'))
      and exists (
        select 1 from public.estimates as e
        where e.id = estimate_line_items.estimate_id
          and e.company_id = estimate_line_items.company_id
          and e.deleted_at is null
      )
    )
  );
create policy estimate_line_items_insert
  on public.estimate_line_items for insert to authenticated
  with check ((select public.current_user_can_edit_estimate_children(company_id, estimate_id)));
create policy estimate_line_items_update
  on public.estimate_line_items for update to authenticated
  using ((select public.current_user_can_edit_estimate_children(company_id, estimate_id)))
  with check ((select public.current_user_can_edit_estimate_children(company_id, estimate_id)));

-- Recurring invoices, credit notes, and debit notes are owner/server-write
-- financial records. Tenant members with the matching invoice permission may
-- read them; only owners and super_admins may create or update them.
grant select, insert, update on public.recurring_invoice_templates to authenticated;
create policy recurring_invoice_templates_select
  on public.recurring_invoice_templates for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_invoices'))
    )
  );
create policy recurring_invoice_templates_insert
  on public.recurring_invoice_templates for insert to authenticated
  with check (
    created_by_user_id = (select auth.uid())
    and (select public.current_user_can_manage_company(company_id))
    and exists (
      select 1 from public.clients as c
      where c.id = recurring_invoice_templates.client_id
        and c.company_id = recurring_invoice_templates.company_id
        and c.deleted_at is null
    )
  );
create policy recurring_invoice_templates_update
  on public.recurring_invoice_templates for update to authenticated
  using (
    (select public.is_super_admin())
    or (select public.current_user_can_manage_company(company_id))
  )
  with check (
    (select public.is_super_admin())
    or (select public.current_user_can_manage_company(company_id))
  );

grant select, insert, update on public.recurring_invoice_template_line_items to authenticated;
create policy recurring_invoice_template_line_items_select
  on public.recurring_invoice_template_line_items for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_invoices'))
      and exists (
        select 1 from public.recurring_invoice_templates as r
        where r.id = recurring_invoice_template_line_items.recurring_invoice_template_id
          and r.company_id = recurring_invoice_template_line_items.company_id
          and r.deleted_at is null
      )
    )
  );
create policy recurring_invoice_template_line_items_insert
  on public.recurring_invoice_template_line_items for insert to authenticated
  with check (
    (select public.current_user_can_manage_company(company_id))
    and exists (
      select 1 from public.recurring_invoice_templates as r
      where r.id = recurring_invoice_template_line_items.recurring_invoice_template_id
        and r.company_id = recurring_invoice_template_line_items.company_id
        and r.deleted_at is null
    )
  );
create policy recurring_invoice_template_line_items_update
  on public.recurring_invoice_template_line_items for update to authenticated
  using ((select public.current_user_can_manage_company(company_id)))
  with check ((select public.current_user_can_manage_company(company_id)));

grant select, insert, update on public.credit_notes to authenticated;
create policy credit_notes_select
  on public.credit_notes for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_invoices'))
    )
  );
create policy credit_notes_insert
  on public.credit_notes for insert to authenticated
  with check (
    created_by_user_id = (select auth.uid())
    and (select public.current_user_can_manage_company(company_id))
    and exists (
      select 1 from public.invoices as i
      where i.id = credit_notes.invoice_id
        and i.company_id = credit_notes.company_id
        and i.deleted_at is null
    )
  );
create policy credit_notes_update
  on public.credit_notes for update to authenticated
  using ((select public.current_user_can_manage_company(company_id)))
  with check ((select public.current_user_can_manage_company(company_id)));

grant select, insert on public.credit_note_line_items to authenticated;
create policy credit_note_line_items_select
  on public.credit_note_line_items for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      (select public.current_user_has_company_permission(company_id, 'read:manage_invoices'))
      and exists (
        select 1 from public.credit_notes as n
        where n.id = credit_note_line_items.credit_note_id
          and n.company_id = credit_note_line_items.company_id
          and n.deleted_at is null
      )
    )
  );
create policy credit_note_line_items_insert
  on public.credit_note_line_items for insert to authenticated
  with check (
    (select public.current_user_can_manage_company(company_id))
    and exists (
      select 1 from public.credit_notes as n
      where n.id = credit_note_line_items.credit_note_id
        and n.company_id = credit_note_line_items.company_id
        and n.deleted_at is null
    )
  );

grant select, insert, update on public.debit_notes to authenticated;
create policy debit_notes_select
  on public.debit_notes for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_invoices'))
    )
  );
create policy debit_notes_insert
  on public.debit_notes for insert to authenticated
  with check (
    created_by_user_id = (select auth.uid())
    and (select public.current_user_can_manage_company(company_id))
    and exists (
      select 1 from public.invoices as i
      where i.id = debit_notes.invoice_id
        and i.company_id = debit_notes.company_id
        and i.deleted_at is null
    )
  );
create policy debit_notes_update
  on public.debit_notes for update to authenticated
  using ((select public.current_user_can_manage_company(company_id)))
  with check ((select public.current_user_can_manage_company(company_id)));

grant select, insert on public.debit_note_line_items to authenticated;
create policy debit_note_line_items_select
  on public.debit_note_line_items for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      (select public.current_user_has_company_permission(company_id, 'read:manage_invoices'))
      and exists (
        select 1 from public.debit_notes as n
        where n.id = debit_note_line_items.debit_note_id
          and n.company_id = debit_note_line_items.company_id
          and n.deleted_at is null
      )
    )
  );
create policy debit_note_line_items_insert
  on public.debit_note_line_items for insert to authenticated
  with check (
    (select public.current_user_can_manage_company(company_id))
    and exists (
      select 1 from public.debit_notes as n
      where n.id = debit_note_line_items.debit_note_id
        and n.company_id = debit_note_line_items.company_id
        and n.deleted_at is null
    )
  );

-- Payment records. Payment instruments, gateway callbacks, and evidence
-- writes are service-role-only. Tenant roles receive only the minimum read
-- surface and owner-initiated payment/refund creation.
grant select, insert on public.payments to authenticated;
create policy payments_select
  on public.payments for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_invoices'))
    )
  );
create policy payments_insert_owner
  on public.payments for insert to authenticated
  with check (
    (select public.current_user_can_manage_company(company_id))
    and exists (
      select 1 from public.clients as c
      where c.id = payments.client_id
        and c.company_id = payments.company_id
        and c.deleted_at is null
    )
    and (
      invoice_id is null
      or exists (
        select 1 from public.invoices as i
        where i.id = payments.invoice_id
          and i.company_id = payments.company_id
          and i.deleted_at is null
      )
    )
    and saved_payment_method_id is null
  );

-- Saved payment-method rows contain provider tokens and are server-only.
-- No anon/authenticated table privilege or policy is granted.

grant select, insert on public.refunds to authenticated;
create policy refunds_select
  on public.refunds for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_invoices'))
    )
  );
create policy refunds_insert_owner
  on public.refunds for insert to authenticated
  with check (
    initiated_by_user_id = (select auth.uid())
    and (select public.current_user_can_manage_company(company_id))
    and exists (
      select 1 from public.payments as p
      where p.id = refunds.payment_id
        and p.company_id = refunds.company_id
        and p.deleted_at is null
    )
  );

grant select on public.chargebacks to authenticated;
create policy chargebacks_select
  on public.chargebacks for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      deleted_at is null
      and (select public.current_user_has_company_permission(company_id, 'read:manage_invoices'))
    )
  );

-- Webhook events do not have a company_id and therefore cannot be safely
-- exposed through a tenant policy. Only super_admin can inspect them; only
-- provider callbacks through service_role can write them.
grant select on public.gateway_webhook_events to authenticated;
create policy gateway_webhook_events_select_super_admin
  on public.gateway_webhook_events for select to authenticated
  using ((select public.is_super_admin()));

-- Payment evidence is tenant-scoped for owner/staff reads but immutable
-- evidence creation and updates remain service-role-only.
grant select on public.payment_consent_records to authenticated;
create policy payment_consent_records_select
  on public.payment_consent_records for select to authenticated
  using (
    (select public.is_super_admin())
    or (select public.current_user_owns_company(company_id))
  );

grant select on public.delivery_acceptance_records to authenticated;
create policy delivery_acceptance_records_select
  on public.delivery_acceptance_records for select to authenticated
  using (
    (select public.is_super_admin())
    or (select public.current_user_owns_company(company_id))
  );

grant select on public.dispute_audit_events to authenticated;
create policy dispute_audit_events_select
  on public.dispute_audit_events for select to authenticated
  using (
    (select public.is_super_admin())
    or (select public.current_user_owns_company(company_id))
  );

grant select on public.dispute_evidence_packs to authenticated;
create policy dispute_evidence_packs_select
  on public.dispute_evidence_packs for select to authenticated
  using (
    (select public.is_super_admin())
    or (select public.current_user_owns_company(company_id))
  );

comment on table public.users is 'RLS: self profile access; platform administration uses the service-role boundary.';
comment on table public.companies is 'RLS: active members see only their company; owner and super_admin write through scoped policies.';
comment on table public.invoices is 'RLS: company-scoped invoice access; staff can edit drafts but cannot transition/send non-draft invoices.';
comment on table public.estimates is 'RLS: company-scoped estimate access; staff can edit drafts but cannot change sent or approved estimates.';
comment on table public.payments is 'RLS: company-scoped payment reads; provider status changes and payment instruments are server-only.';

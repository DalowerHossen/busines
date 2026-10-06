-- supabase/migrations/00113_enable_rls_projects.sql
-- Row level security for projects, tracked time and stock.
--
-- Time is the sensitive part: a staff member may see and change their own
-- entries, while the owner sees the whole company. An accountant reads the
-- books, not the timesheets of individual people.

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_tasks enable row level security;
alter table public.time_entries enable row level security;
alter table public.timesheets enable row level security;
alter table public.project_milestones enable row level security;
alter table public.retainer_agreements enable row level security;
alter table public.retainer_periods enable row level security;
alter table public.warehouses enable row level security;
alter table public.stock_levels enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_counts enable row level security;
alter table public.stock_count_items enable row level security;

alter table public.projects force row level security;
alter table public.project_members force row level security;
alter table public.project_tasks force row level security;
alter table public.time_entries force row level security;
alter table public.timesheets force row level security;
alter table public.project_milestones force row level security;
alter table public.retainer_agreements force row level security;
alter table public.retainer_periods force row level security;
alter table public.warehouses force row level security;
alter table public.stock_levels force row level security;
alter table public.stock_movements force row level security;
alter table public.stock_counts force row level security;
alter table public.stock_count_items force row level security;

-- Straightforward tenant records.
select public.install_tenant_policies('projects');
select public.install_tenant_policies('project_members');
select public.install_tenant_policies('project_tasks');
select public.install_tenant_policies('project_milestones');
select public.install_tenant_policies('retainer_agreements');
select public.install_tenant_policies('warehouses');
select public.install_tenant_policies('stock_counts');

-- -----------------------------------------------------------------------------
-- Tracked time
-- -----------------------------------------------------------------------------

-- Everyone in the company can see the work of the company, because that is
-- what makes a project report possible.
create policy time_entries_select on public.time_entries
  for select to authenticated
  using (deleted_at is null and public.has_company_access(company_id));

-- A person logs their own time. The owner may log on behalf of the team.
create policy time_entries_insert on public.time_entries
  for insert to authenticated
  with check (
    public.can_write_company_data(company_id)
    and (user_id = public.current_user_id()
         or public.is_company_owner(company_id)
         or public.is_super_admin())
  );

create policy time_entries_update on public.time_entries
  for update to authenticated
  using (
    deleted_at is null
    and public.can_write_company_data(company_id)
    and (user_id = public.current_user_id()
         or public.is_company_owner(company_id)
         or public.is_super_admin())
  )
  with check (public.can_write_company_data(company_id));

comment on policy time_entries_insert on public.time_entries is
  'A person logs their own hours; the owner may log for the team.';

create policy timesheets_select on public.timesheets
  for select to authenticated
  using (deleted_at is null and public.has_company_access(company_id));

create policy timesheets_insert on public.timesheets
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy timesheets_update on public.timesheets
  for update to authenticated
  using (
    deleted_at is null
    and public.can_write_company_data(company_id)
    and (user_id = public.current_user_id()
         or public.is_company_owner(company_id)
         or public.is_super_admin())
  )
  with check (public.can_write_company_data(company_id));

-- -----------------------------------------------------------------------------
-- Retainer cycles
-- -----------------------------------------------------------------------------

create policy retainer_periods_select on public.retainer_periods
  for select to authenticated
  using (public.has_company_access(company_id));

create policy retainer_periods_insert on public.retainer_periods
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy retainer_periods_update on public.retainer_periods
  for update to authenticated
  using (public.can_write_company_data(company_id))
  with check (public.can_write_company_data(company_id));

-- -----------------------------------------------------------------------------
-- Stock
-- -----------------------------------------------------------------------------

create policy stock_levels_select on public.stock_levels
  for select to authenticated
  using (public.has_company_access(company_id));

create policy stock_levels_insert on public.stock_levels
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy stock_levels_update on public.stock_levels
  for update to authenticated
  using (public.can_write_company_data(company_id))
  with check (public.can_write_company_data(company_id));

-- The history is readable by the tenant and written only through the
-- movement routine, which is why there is no update or delete policy.
create policy stock_movements_select on public.stock_movements
  for select to authenticated
  using (public.has_company_access(company_id));

create policy stock_movements_insert on public.stock_movements
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

comment on policy stock_movements_select on public.stock_movements is
  'Stock history is readable by the tenant and never edited.';

create policy stock_count_items_select on public.stock_count_items
  for select to authenticated
  using (public.has_company_access(company_id));

create policy stock_count_items_insert on public.stock_count_items
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy stock_count_items_update on public.stock_count_items
  for update to authenticated
  using (public.can_write_company_data(company_id))
  with check (public.can_write_company_data(company_id));

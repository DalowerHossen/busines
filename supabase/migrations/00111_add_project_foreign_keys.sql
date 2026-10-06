-- supabase/migrations/00111_add_project_foreign_keys.sql
-- The relationships of the project, time and stock tables.
--
-- Tenant columns cascade with the company; everything that is evidence of
-- work done is held with no action, so history cannot vanish under a report.

-- -----------------------------------------------------------------------------
-- Projects
-- -----------------------------------------------------------------------------

alter table public.projects
  add constraint projects_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint projects_client_fk
    foreign key (client_id) references public.clients (id),
  add constraint projects_product_fk
    foreign key (default_product_id) references public.products (id)
      on delete set null,
  add constraint projects_manager_fk
    foreign key (manager_user_id) references public.users (id) on delete set null,
  add constraint projects_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint projects_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.project_members
  add constraint project_members_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint project_members_project_fk
    foreign key (project_id) references public.projects (id) on delete cascade,
  add constraint project_members_user_fk
    foreign key (user_id) references public.users (id) on delete cascade,
  add constraint project_members_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint project_members_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.project_tasks
  add constraint project_tasks_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint project_tasks_project_fk
    foreign key (project_id) references public.projects (id) on delete cascade,
  add constraint project_tasks_parent_fk
    foreign key (parent_task_id) references public.project_tasks (id)
      on delete set null,
  add constraint project_tasks_assignee_fk
    foreign key (assignee_user_id) references public.users (id) on delete set null,
  add constraint project_tasks_completed_by_fk
    foreign key (completed_by) references public.users (id) on delete set null,
  add constraint project_tasks_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint project_tasks_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Time
-- -----------------------------------------------------------------------------

alter table public.time_entries
  add constraint time_entries_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint time_entries_project_fk
    foreign key (project_id) references public.projects (id),
  add constraint time_entries_task_fk
    foreign key (task_id) references public.project_tasks (id) on delete set null,
  add constraint time_entries_user_fk
    foreign key (user_id) references public.users (id),
  add constraint time_entries_timesheet_fk
    foreign key (timesheet_id) references public.timesheets (id) on delete set null,
  add constraint time_entries_invoice_fk
    foreign key (invoice_id) references public.invoices (id) on delete set null,
  add constraint time_entries_invoice_item_fk
    foreign key (invoice_item_id) references public.invoice_items (id)
      on delete set null,
  add constraint time_entries_retainer_period_fk
    foreign key (retainer_period_id) references public.retainer_periods (id)
      on delete set null,
  add constraint time_entries_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint time_entries_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.timesheets
  add constraint timesheets_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint timesheets_user_fk
    foreign key (user_id) references public.users (id) on delete cascade,
  add constraint timesheets_submitted_by_fk
    foreign key (submitted_by) references public.users (id) on delete set null,
  add constraint timesheets_approved_by_fk
    foreign key (approved_by) references public.users (id) on delete set null,
  add constraint timesheets_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint timesheets_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Milestones and retainers
-- -----------------------------------------------------------------------------

alter table public.project_milestones
  add constraint project_milestones_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint project_milestones_project_fk
    foreign key (project_id) references public.projects (id) on delete cascade,
  add constraint project_milestones_invoice_fk
    foreign key (invoice_id) references public.invoices (id) on delete set null,
  add constraint project_milestones_completed_by_fk
    foreign key (completed_by) references public.users (id) on delete set null,
  add constraint project_milestones_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint project_milestones_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.retainer_agreements
  add constraint retainer_agreements_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint retainer_agreements_client_fk
    foreign key (client_id) references public.clients (id),
  add constraint retainer_agreements_project_fk
    foreign key (project_id) references public.projects (id) on delete set null,
  add constraint retainer_agreements_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint retainer_agreements_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.retainer_periods
  add constraint retainer_periods_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint retainer_periods_agreement_fk
    foreign key (agreement_id) references public.retainer_agreements (id)
      on delete cascade,
  add constraint retainer_periods_invoice_fk
    foreign key (invoice_id) references public.invoices (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Stock
-- -----------------------------------------------------------------------------

alter table public.warehouses
  add constraint warehouses_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint warehouses_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint warehouses_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.stock_levels
  add constraint stock_levels_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint stock_levels_product_fk
    foreign key (product_id) references public.products (id) on delete cascade,
  add constraint stock_levels_warehouse_fk
    foreign key (warehouse_id) references public.warehouses (id) on delete cascade;

alter table public.stock_movements
  add constraint stock_movements_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint stock_movements_product_fk
    foreign key (product_id) references public.products (id),
  add constraint stock_movements_warehouse_fk
    foreign key (warehouse_id) references public.warehouses (id),
  add constraint stock_movements_journal_entry_fk
    foreign key (journal_entry_id) references public.journal_entries (id)
      on delete set null,
  add constraint stock_movements_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null;

alter table public.stock_counts
  add constraint stock_counts_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint stock_counts_warehouse_fk
    foreign key (warehouse_id) references public.warehouses (id),
  add constraint stock_counts_completed_by_fk
    foreign key (completed_by) references public.users (id) on delete set null,
  add constraint stock_counts_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint stock_counts_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.stock_count_items
  add constraint stock_count_items_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint stock_count_items_count_fk
    foreign key (stock_count_id) references public.stock_counts (id)
      on delete cascade,
  add constraint stock_count_items_product_fk
    foreign key (product_id) references public.products (id);

alter table public.purchase_receipts
  add constraint purchase_receipts_warehouse_fk
    foreign key (warehouse_id) references public.warehouses (id)
      on delete set null;

-- -----------------------------------------------------------------------------
-- The links that older tables were waiting for
-- -----------------------------------------------------------------------------

alter table public.invoices
  add constraint invoices_project_fk
    foreign key (project_id) references public.projects (id) on delete set null;

alter table public.invoice_items
  add constraint invoice_items_time_entry_fk
    foreign key (time_entry_id) references public.time_entries (id)
      on delete set null,
  add constraint invoice_items_expense_fk
    foreign key (expense_id) references public.expenses (id) on delete set null;

alter table public.expenses
  add constraint expenses_project_fk
    foreign key (project_id) references public.projects (id) on delete set null;

alter table public.journal_lines
  add constraint journal_lines_project_fk
    foreign key (project_id) references public.projects (id) on delete set null;

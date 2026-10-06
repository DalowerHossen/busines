-- supabase/migrations/00108_create_project_billing.sql
-- Turning tracked work into an invoice, and reporting on what it earned.
--
-- The rule throughout is that nothing is billed twice: every source record
-- carries the invoice it reached, and the billing routine only picks up work
-- that is still free.

-- Everything on a project that is waiting to be charged.
create or replace function public.uninvoiced_project_work(p_project_id uuid)
returns table (
  source_type text,
  source_id uuid,
  work_date date,
  description text,
  quantity numeric,
  unit_price numeric,
  amount numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select 'time_entry',
         e.id,
         e.entry_date,
         e.description,
         round(e.duration_minutes / 60.0, 2),
         e.hourly_rate,
         round(round(e.duration_minutes / 60.0, 2) * e.hourly_rate, 4)
    from public.time_entries as e
   where e.project_id = p_project_id
     and e.deleted_at is null
     and e.is_billable
     and e.invoice_id is null
     and e.retainer_period_id is null
     and e.duration_minutes > 0
     and e.status <> 'rejected'

  union all

  select 'expense',
         x.id,
         x.expense_date,
         x.description,
         1::numeric,
         round(x.total_amount * (1 + x.markup_percentage / 100), 4),
         round(x.total_amount * (1 + x.markup_percentage / 100), 4)
    from public.expenses as x
   where x.project_id = p_project_id
     and x.deleted_at is null
     and x.is_billable
     and x.invoice_id is null
     and x.status in ('approved', 'reimbursed')

  union all

  select 'milestone',
         m.id,
         coalesce(m.completed_at::date, m.due_date, current_date),
         m.name,
         1::numeric,
         m.amount,
         m.amount
    from public.project_milestones as m
   where m.project_id = p_project_id
     and m.deleted_at is null
     and m.status = 'completed'
     and m.invoice_id is null

   order by 3, 4;
$$;

comment on function public.uninvoiced_project_work(uuid) is
  'Lists the time, recharged expenses and delivered stages waiting to be billed.';

-- Builds a draft invoice from everything on the project that is unbilled.
-- The invoice is left as a draft on purpose: a person checks it, then issues
-- it through the normal lifecycle.
create or replace function public.invoice_project_work(
  p_project_id uuid,
  p_issue_date date default current_date,
  p_up_to date default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_company public.companies%rowtype;
  v_currency char(3);
  v_invoice_id uuid;
  v_work record;
  v_line smallint := 0;
  v_terms smallint;
begin
  select * into v_project
    from public.projects
   where id = p_project_id and deleted_at is null;

  if not found then
    raise exception 'Project % was not found', p_project_id using errcode = 'P0002';
  end if;

  if not (public.is_service_role()
          or public.can_write_company_data(v_project.company_id)) then
    raise exception 'You do not have permission to bill this project'
      using errcode = '42501';
  end if;

  if v_project.client_id is null then
    raise exception 'Internal work cannot be invoiced' using errcode = '22023';
  end if;

  select * into v_company from public.companies where id = v_project.company_id;

  select coalesce(v_project.currency, billing_currency, v_company.base_currency),
         coalesce(default_payment_terms_days, 30)
    into v_currency, v_terms
    from public.clients
   where id = v_project.client_id;

  if not exists (
    select 1 from public.uninvoiced_project_work(p_project_id) as work
     where p_up_to is null or work.work_date <= p_up_to
  ) then
    raise exception 'There is nothing to bill on this project yet'
      using errcode = '22023';
  end if;

  insert into public.invoices (
    company_id, client_id, project_id, currency, base_currency, issue_date,
    due_date, payment_terms_days, project_reference, notes, created_by
  )
  values (
    v_project.company_id,
    v_project.client_id,
    p_project_id,
    coalesce(v_currency, 'USD'),
    coalesce(v_company.base_currency, 'USD'),
    p_issue_date,
    p_issue_date + v_terms,
    v_terms,
    v_project.project_code,
    'Work on ' || v_project.name,
    public.current_user_id()
  )
  returning id into v_invoice_id;

  for v_work in
    select *
      from public.uninvoiced_project_work(p_project_id) as work
     where p_up_to is null or work.work_date <= p_up_to
  loop
    v_line := v_line + 1;

    insert into public.invoice_items (
      company_id, invoice_id, line_number, line_type, description, quantity,
      unit_label, unit_price, product_id, time_entry_id, expense_id
    )
    values (
      v_project.company_id,
      v_invoice_id,
      v_line,
      case v_work.source_type
        when 'time_entry' then 'time_entry'::public.document_line_type
        when 'expense' then 'expense'::public.document_line_type
        else 'service'::public.document_line_type
      end,
      v_work.description,
      v_work.quantity,
      case when v_work.source_type = 'time_entry' then 'hours' else null end,
      v_work.unit_price,
      case
        when v_work.source_type = 'time_entry' then v_project.default_product_id
        else null
      end,
      case when v_work.source_type = 'time_entry' then v_work.source_id end,
      case when v_work.source_type = 'expense' then v_work.source_id end
    );

    if v_work.source_type = 'time_entry' then
      update public.time_entries
         set invoice_id = v_invoice_id,
             invoiced_at = now(),
             updated_at = now()
       where id = v_work.source_id;
    elsif v_work.source_type = 'expense' then
      update public.expenses
         set invoice_id = v_invoice_id,
             invoiced_at = now(),
             updated_at = now()
       where id = v_work.source_id;
    else
      update public.project_milestones
         set invoice_id = v_invoice_id,
             invoiced_at = now(),
             status = 'invoiced',
             updated_at = now()
       where id = v_work.source_id;
    end if;
  end loop;

  perform public.recalculate_invoice_totals(v_invoice_id);

  return v_invoice_id;
end;
$$;

comment on function public.invoice_project_work(uuid, date, date) is
  'Builds one draft invoice from the unbilled work of a project.';

-- Releases the work on a draft invoice so it can be billed again. Used when a
-- draft is thrown away rather than issued.
create or replace function public.release_project_work(p_invoice_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_released integer := 0;
  v_count integer;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id;

  if not found then
    raise exception 'Invoice % was not found', p_invoice_id using errcode = 'P0002';
  end if;

  if v_invoice.status <> 'draft' then
    raise exception 'Work can only be released from a draft invoice'
      using errcode = '22023';
  end if;

  update public.time_entries
     set invoice_id = null, invoiced_at = null, updated_at = now()
   where invoice_id = p_invoice_id;
  get diagnostics v_count = row_count;
  v_released := v_released + v_count;

  update public.expenses
     set invoice_id = null, invoiced_at = null, updated_at = now()
   where invoice_id = p_invoice_id;
  get diagnostics v_count = row_count;
  v_released := v_released + v_count;

  update public.project_milestones
     set invoice_id = null, invoiced_at = null, status = 'completed',
         updated_at = now()
   where invoice_id = p_invoice_id;
  get diagnostics v_count = row_count;
  v_released := v_released + v_count;

  return v_released;
end;
$$;

comment on function public.release_project_work(uuid) is
  'Puts the work of a discarded draft invoice back in the billing queue.';

-- What a project earned against what it cost.
create or replace function public.project_profitability(p_project_id uuid)
returns table (
  logged_hours numeric,
  billable_hours numeric,
  billed_amount numeric,
  uninvoiced_amount numeric,
  labour_cost numeric,
  expense_cost numeric,
  gross_profit numeric,
  margin_percentage numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_logged numeric := 0;
  v_billable numeric := 0;
  v_labour numeric := 0;
  v_billed numeric := 0;
  v_unbilled numeric := 0;
  v_expense numeric := 0;
  v_revenue numeric := 0;
begin
  select round(coalesce(sum(duration_minutes), 0) / 60.0, 2),
         round(coalesce(sum(duration_minutes) filter (where is_billable), 0) / 60.0, 2),
         round(coalesce(sum(cost_amount), 0), 4)
    into v_logged, v_billable, v_labour
    from public.time_entries
   where project_id = p_project_id and deleted_at is null;

  select round(coalesce(sum(total_amount), 0), 4)
    into v_billed
    from public.invoices
   where project_id = p_project_id
     and deleted_at is null
     and status not in ('draft', 'cancelled');

  select round(coalesce(sum(amount), 0), 4)
    into v_unbilled
    from public.uninvoiced_project_work(p_project_id);

  select round(coalesce(sum(total_amount), 0), 4)
    into v_expense
    from public.expenses
   where project_id = p_project_id
     and deleted_at is null
     and status in ('approved', 'reimbursed');

  v_revenue := v_billed + v_unbilled;

  return query
  select v_logged,
         v_billable,
         v_billed,
         v_unbilled,
         v_labour,
         v_expense,
         round(v_revenue - v_labour - v_expense, 4),
         case
           when v_revenue = 0 then 0::numeric
           else round((v_revenue - v_labour - v_expense) / v_revenue * 100, 2)
         end;
end;
$$;

comment on function public.project_profitability(uuid) is
  'Reports what a project earned, what it cost and the margin between them.';

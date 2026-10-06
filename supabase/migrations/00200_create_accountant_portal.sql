-- supabase/migrations/00200_create_accountant_portal.sql
-- The bookkeeper's way in, and a hole closed on the way.
--
-- An accountant holds one login and works across every business that invited
-- them. What was missing was a way to see that list with enough on it to
-- decide where to start. What was wrong was that four reporting routines were
-- defined with the rights of their owner and no check of their own: anybody
-- signed in could read the trial balance of any business simply by passing
-- its identifier. All four now ask the same tenancy question every table
-- asks.

-- -----------------------------------------------------------------------------
-- Closing the reporting hole
-- -----------------------------------------------------------------------------

create or replace function public.trial_balance(
  p_company_id uuid,
  p_from date default null,
  p_to date default null
)
returns table (
  account_code text,
  account_name text,
  account_type public.account_type,
  debit_total numeric,
  credit_total numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_service_role() or public.has_company_access(p_company_id), false) then
    raise exception 'That ledger belongs to another business' using errcode = '42501';
  end if;

  return query
  select a.code,
         a.name,
         a.account_type,
         round(coalesce(sum(l.debit_amount), 0), 4),
         round(coalesce(sum(l.credit_amount), 0), 4)
    from public.ledger_accounts as a
    left join public.journal_lines as l on l.account_id = a.id
    left join public.journal_entries as e
      on e.id = l.entry_id
     and e.status = 'posted'
     and e.deleted_at is null
     and (p_from is null or e.entry_date >= p_from)
     and (p_to is null or e.entry_date <= p_to)
   where a.company_id = p_company_id
     and a.deleted_at is null
   group by a.code, a.name, a.account_type, a.display_order
  having coalesce(sum(l.debit_amount), 0) <> 0
      or coalesce(sum(l.credit_amount), 0) <> 0
   order by a.display_order, a.code;
end;
$$;

comment on function public.trial_balance(uuid, date, date) is
  'Lists every account with movement in a period, for callers of that business.';

create or replace function public.profit_and_loss(
  p_company_id uuid,
  p_from date,
  p_to date
)
returns table (
  section text,
  account_code text,
  account_name text,
  amount numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_service_role() or public.has_company_access(p_company_id), false) then
    raise exception 'Those figures belong to another business' using errcode = '42501';
  end if;

  return query
  select case a.account_type
           when 'income' then 'Income'
           when 'expense' then
             case when a.account_subtype = 'cost_of_sales'
                  then 'Cost of sales'
                  else 'Expenses'
             end
         end,
         a.code,
         a.name,
         case when a.account_type = 'income'
              then round(coalesce(sum(l.credit_amount - l.debit_amount), 0), 4)
              else round(coalesce(sum(l.debit_amount - l.credit_amount), 0), 4)
         end
    from public.ledger_accounts as a
    join public.journal_lines as l on l.account_id = a.id
    join public.journal_entries as e
      on e.id = l.entry_id
     and e.status = 'posted'
     and e.deleted_at is null
     and e.entry_date between p_from and p_to
   where a.company_id = p_company_id
     and a.account_type in ('income', 'expense')
     and a.deleted_at is null
   group by a.account_type, a.account_subtype, a.code, a.name, a.display_order
   order by a.account_type desc, a.display_order;
end;
$$;

comment on function public.profit_and_loss(uuid, date, date) is
  'Income, cost of sales and expenses for a period, for callers of that business.';

create or replace function public.balance_sheet(
  p_company_id uuid,
  p_as_of date default current_date
)
returns table (
  section text,
  account_code text,
  account_name text,
  amount numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_service_role() or public.has_company_access(p_company_id), false) then
    raise exception 'Those figures belong to another business' using errcode = '42501';
  end if;

  return query
  select initcap(a.account_type::text),
         a.code,
         a.name,
         case when a.account_type = 'asset'
              then round(coalesce(sum(l.debit_amount - l.credit_amount), 0), 4)
              else round(coalesce(sum(l.credit_amount - l.debit_amount), 0), 4)
         end
    from public.ledger_accounts as a
    join public.journal_lines as l on l.account_id = a.id
    join public.journal_entries as e
      on e.id = l.entry_id
     and e.status = 'posted'
     and e.deleted_at is null
     and e.entry_date <= p_as_of
   where a.company_id = p_company_id
     and a.account_type in ('asset', 'liability', 'equity')
     and a.deleted_at is null
   group by a.account_type, a.code, a.name, a.display_order
   order by a.account_type, a.display_order;
end;
$$;

comment on function public.balance_sheet(uuid, date) is
  'Assets, liabilities and equity on one date, for callers of that business.';

create or replace function public.account_balance(
  p_account_id uuid,
  p_from date default null,
  p_to date default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_type public.account_type;
  v_company_id uuid;
  v_debit numeric;
  v_credit numeric;
begin
  select account_type, company_id into v_type, v_company_id
    from public.ledger_accounts
   where id = p_account_id;

  if not found then
    return 0;
  end if;

  if not coalesce(public.is_service_role() or public.has_company_access(v_company_id), false) then
    raise exception 'That account belongs to another business' using errcode = '42501';
  end if;

  select coalesce(sum(l.debit_amount), 0), coalesce(sum(l.credit_amount), 0)
    into v_debit, v_credit
    from public.journal_lines as l
    join public.journal_entries as e on e.id = l.entry_id
   where l.account_id = p_account_id
     and e.status = 'posted'
     and e.deleted_at is null
     and (p_from is null or e.entry_date >= p_from)
     and (p_to is null or e.entry_date <= p_to);

  if v_type in ('asset', 'expense') then
    return round(v_debit - v_credit, 4);
  end if;

  return round(v_credit - v_debit, 4);
end;
$$;

comment on function public.account_balance(uuid, date, date) is
  'Balance of one account in its natural direction, for callers of that business.';

-- -----------------------------------------------------------------------------
-- The bookkeeper's own list
-- -----------------------------------------------------------------------------

create or replace function public.accountant_workspaces()
returns table (
  company_id uuid,
  display_name text,
  base_currency char(3),
  granted_at timestamptz,
  expires_at timestamptz,
  last_accessed_at timestamptz,
  scopes jsonb,
  outstanding_amount numeric,
  overdue_amount numeric,
  collected_this_month numeric,
  expenses_this_month numeric,
  draft_entries integer,
  unreconciled_transactions integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_month_start date := date_trunc('month', current_date)::date;
begin
  if v_user_id is null then
    raise exception 'Sign in to see the businesses you work on' using errcode = '42501';
  end if;

  return query
  select c.id,
         c.display_name,
         c.base_currency,
         g.granted_at,
         g.expires_at,
         g.last_accessed_at,
         g.scopes,
         coalesce((
           select sum(i.total_amount - i.paid_amount)
             from public.invoices as i
            where i.company_id = c.id
              and i.deleted_at is null
              and i.status in ('sent', 'viewed', 'partially_paid', 'overdue')
         ), 0),
         coalesce((
           select sum(i.total_amount - i.paid_amount)
             from public.invoices as i
            where i.company_id = c.id
              and i.deleted_at is null
              and i.status in ('sent', 'viewed', 'partially_paid', 'overdue')
              and i.due_date < current_date
         ), 0),
         coalesce((
           select sum(p.amount)
             from public.payments as p
            where p.company_id = c.id
              and p.deleted_at is null
              and p.status = 'succeeded'
              and p.received_at >= v_month_start
         ), 0),
         coalesce((
           select sum(x.total_amount)
             from public.expenses as x
            where x.company_id = c.id
              and x.deleted_at is null
              and x.expense_date >= v_month_start
         ), 0),
         coalesce((
           select (count(*))::int
             from public.journal_entries as j
            where j.company_id = c.id
              and j.deleted_at is null
              and j.status = 'draft'
         ), 0),
         coalesce((
           select (count(*))::int
             from public.bank_transactions as t
            where t.company_id = c.id
              and t.status = 'unmatched'
              and not t.is_ignored
         ), 0)
    from public.accountant_company_access as g
    join public.companies as c on c.id = g.company_id
   where g.accountant_user_id = v_user_id
     and g.status = 'active'
     and g.deleted_at is null
     and (g.expires_at is null or g.expires_at > now())
     and c.deleted_at is null
   order by c.display_name;
end;
$$;

comment on function public.accountant_workspaces() is
  'The businesses the signed in accountant may work on, with headline figures.';

-- Records that an accountant opened a business, which the owner can see.
create or replace function public.touch_accountant_access(p_company_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.current_user_id();
begin
  if v_user_id is null then
    return false;
  end if;

  update public.accountant_company_access
     set last_accessed_at = now(),
         updated_at = now()
   where accountant_user_id = v_user_id
     and company_id = p_company_id
     and status = 'active'
     and deleted_at is null;

  return found;
end;
$$;

comment on function public.touch_accountant_access(uuid) is
  'Stamps the moment an accountant last opened one of their businesses.';

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

grant execute on function public.accountant_workspaces() to authenticated;
grant execute on function public.touch_accountant_access(uuid) to authenticated;

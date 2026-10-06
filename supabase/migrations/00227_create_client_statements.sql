-- supabase/migrations/00227_create_client_statements.sql
-- One page that tells a client everything they owe.
--
-- A business with six unpaid invoices from the same client should send one
-- statement, not six reminders. The client's accounts department wants a
-- single list they can match against their own records, and sending it is
-- usually the thing that gets several invoices paid at once.
--
-- The statement is derived, never stored. A stored statement is out of date
-- the moment the next payment arrives, and a client reading a stale total
-- is worse than a client reading none.

create or replace function public.client_statement(
  p_company_id uuid,
  p_client_id uuid,
  p_from date default null,
  p_to date default null
)
returns table (
  invoice_id uuid,
  invoice_number text,
  issue_date date,
  due_date date,
  currency char(3),
  total_amount numeric,
  paid_amount numeric,
  balance_due numeric,
  days_overdue integer,
  status public.invoice_status
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You cannot read the statements of another business'
      using errcode = '42501';
  end if;

  return query
    select i.id,
           i.invoice_number,
           i.issue_date,
           i.due_date,
           i.currency,
           i.total_amount,
           i.paid_amount,
           i.balance_due,
           greatest((current_date - i.due_date), 0)::int,
           i.status
      from public.invoices as i
     where i.company_id = p_company_id
       and i.client_id = p_client_id
       and i.deleted_at is null
       and i.invoice_number is not null
       and i.status not in ('cancelled', 'written_off')
       and (p_from is null or i.issue_date >= p_from)
       and (p_to is null or i.issue_date <= p_to)
     order by i.issue_date, i.invoice_number;
end;
$$;

comment on function public.client_statement(uuid, uuid, date, date) is
  'Lists what one client has been invoiced and what is still outstanding.';

-- The ageing a credit controller actually reads: not a total, but how old
-- the unpaid part is, because ninety days late is a different conversation
-- from nine.
create or replace function public.client_statement_summary(
  p_company_id uuid,
  p_client_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_client record;
begin
  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You cannot read the statements of another business'
      using errcode = '42501';
  end if;

  select display_name, email into v_client
    from public.clients
   where id = p_client_id
     and company_id = p_company_id
     and deleted_at is null;

  if v_client.display_name is null then
    raise exception 'That client was not found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
           'client_name', v_client.display_name,
           'client_email', v_client.email,
           'invoice_count', count(*) filter (where balance_due > 0),
           'total_outstanding', coalesce(sum(balance_due), 0),
           'not_yet_due', coalesce(sum(balance_due)
             filter (where due_date >= current_date), 0),
           'overdue_up_to_30', coalesce(sum(balance_due)
             filter (where due_date < current_date
                       and due_date >= current_date - 30), 0),
           'overdue_31_to_60', coalesce(sum(balance_due)
             filter (where due_date < current_date - 30
                       and due_date >= current_date - 60), 0),
           'overdue_61_to_90', coalesce(sum(balance_due)
             filter (where due_date < current_date - 60
                       and due_date >= current_date - 90), 0),
           'overdue_over_90', coalesce(sum(balance_due)
             filter (where due_date < current_date - 90), 0),
           'oldest_due_date', min(due_date) filter (where balance_due > 0),
           'currency', max(currency)
         )
    into v_result
    from public.invoices
   where company_id = p_company_id
     and client_id = p_client_id
     and deleted_at is null
     and invoice_number is not null
     and status not in ('cancelled', 'written_off')
     and balance_due > 0;

  return coalesce(
    v_result,
    jsonb_build_object(
      'client_name', v_client.display_name,
      'client_email', v_client.email,
      'invoice_count', 0,
      'total_outstanding', 0
    )
  );
end;
$$;

comment on function public.client_statement_summary(uuid, uuid) is
  'Ages what one client owes, because ninety days late is a different conversation.';

-- Everybody who owes something, oldest debt first. This is the list a
-- business works down on a Friday afternoon.
create or replace function public.outstanding_by_client(p_company_id uuid)
returns table (
  client_id uuid,
  client_name text,
  client_email citext,
  invoice_count integer,
  total_outstanding numeric,
  overdue_amount numeric,
  oldest_due_date date,
  currency char(3)
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You cannot read the debtors of another business'
      using errcode = '42501';
  end if;

  return query
    select c.id,
           c.display_name,
           c.email,
           count(*)::int,
           coalesce(sum(i.balance_due), 0),
           coalesce(sum(i.balance_due) filter (where i.due_date < current_date), 0),
           min(i.due_date),
           max(i.currency)
      from public.invoices as i
      join public.clients as c on c.id = i.client_id
     where i.company_id = p_company_id
       and i.deleted_at is null
       and i.invoice_number is not null
       and i.balance_due > 0
       and i.status not in ('cancelled', 'written_off')
     group by c.id, c.display_name, c.email
     order by min(i.due_date);
end;
$$;

comment on function public.outstanding_by_client(uuid) is
  'Lists every client who owes something, with the oldest debt first.';

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.client_statement(uuid, uuid, date, date)
  from public, authenticated;
revoke execute on function public.client_statement_summary(uuid, uuid)
  from public, authenticated;
revoke execute on function public.outstanding_by_client(uuid)
  from public, authenticated;

grant execute on function public.client_statement(uuid, uuid, date, date)
  to authenticated, service_role;
grant execute on function public.client_statement_summary(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.outstanding_by_client(uuid)
  to authenticated, service_role;

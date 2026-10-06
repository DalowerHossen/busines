-- supabase/migrations/00225_create_collections_admin.sql
-- Chasing an unpaid invoice without becoming the business that nobody
-- wants to hear from.
--
-- The sending machinery exists: reminders are scheduled, quiet hours are
-- honoured, a promise to pay pauses the chase. What was missing is the part
-- a person touches, and the rules that keep the chase proportionate.
--
-- Two of those rules are enforced here rather than left to good intentions.
-- A business cannot schedule more than a handful of reminders on one
-- invoice, because the eighth email does not get an invoice paid; it gets a
-- supplier replaced. And quiet hours cannot be set to nothing, because an
-- invoice reminder at three in the morning is not a reminder, it is a
-- nuisance.

create or replace function public.save_reminder_rule(
  p_company_id uuid,
  p_name text,
  p_offset_days integer,
  p_template_key text default 'invoice_reminder',
  p_minimum_balance numeric default 0,
  p_max_reminders integer default 4,
  p_skip_if_promise_to_pay boolean default true,
  p_is_active boolean default true,
  p_rule_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule_id uuid;
  v_existing integer;
begin
  if not (public.is_service_role() or public.is_company_owner(p_company_id)) then
    raise exception 'Only the account owner decides how clients are chased'
      using errcode = '42501';
  end if;

  if p_offset_days not between -60 and 180 then
    raise exception 'A reminder goes out within two months before, or six months after, the due date'
      using errcode = '22023';
  end if;

  if coalesce(p_max_reminders, 4) not between 1 and 8 then
    raise exception 'More than eight reminders on one invoice loses the client rather than the money'
      using errcode = '22023';
  end if;

  select count(*)::int into v_existing
    from public.reminder_rules
   where company_id = p_company_id
     and is_active
     and deleted_at is null
     and (p_rule_id is null or id <> p_rule_id);

  if coalesce(p_is_active, true) and v_existing >= 6 then
    raise exception 'Six active reminder rules is already more than any client wants'
      using errcode = '22023';
  end if;

  if p_rule_id is null then
    insert into public.reminder_rules (
      company_id, name, template_key, offset_days, minimum_balance, max_reminders,
      skip_if_promise_to_pay, is_active, applies_to_status, created_by, updated_by
    )
    values (
      p_company_id, btrim(p_name), coalesce(p_template_key, 'invoice_reminder'),
      p_offset_days::smallint, coalesce(p_minimum_balance, 0),
      coalesce(p_max_reminders, 4)::smallint,
      coalesce(p_skip_if_promise_to_pay, true), coalesce(p_is_active, true),
      array['sent', 'viewed', 'partially_paid', 'overdue']::public.invoice_status[],
      public.current_user_id(), public.current_user_id()
    )
    returning id into v_rule_id;

    return v_rule_id;
  end if;

  update public.reminder_rules
     set name = btrim(p_name),
         template_key = coalesce(p_template_key, template_key),
         offset_days = p_offset_days::smallint,
         minimum_balance = coalesce(p_minimum_balance, minimum_balance),
         max_reminders = coalesce(p_max_reminders, max_reminders)::smallint,
         skip_if_promise_to_pay =
           coalesce(p_skip_if_promise_to_pay, skip_if_promise_to_pay),
         is_active = coalesce(p_is_active, is_active),
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_rule_id
     and company_id = p_company_id
     and deleted_at is null;

  if not found then
    raise exception 'That reminder was not found' using errcode = 'P0002';
  end if;

  return p_rule_id;
end;
$$;

comment on function public.save_reminder_rule(
  uuid, text, integer, text, numeric, integer, boolean, boolean, uuid
) is 'Sets up one reminder, within limits that keep the chase proportionate.';

create or replace function public.delete_reminder_rule(p_rule_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id
    from public.reminder_rules
   where id = p_rule_id
     and deleted_at is null;

  if v_company_id is null then
    return false;
  end if;

  if not (public.is_service_role() or public.is_company_owner(v_company_id)) then
    raise exception 'Only the account owner decides how clients are chased'
      using errcode = '42501';
  end if;

  update public.reminder_rules
     set is_active = false,
         deleted_at = now(),
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_rule_id;

  return true;
end;
$$;

comment on function public.delete_reminder_rule(uuid) is
  'Stops a reminder from being scheduled on any further invoice.';

create or replace function public.save_reminder_settings(
  p_company_id uuid,
  p_is_enabled boolean,
  p_time_zone text,
  p_quiet_hours_start time,
  p_quiet_hours_end time,
  p_sending_weekdays smallint[] default array[1, 2, 3, 4, 5]::smallint[],
  p_shift_due_dates_to_business_days boolean default false,
  p_send_statements boolean default false,
  p_statement_day_of_month integer default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_company_owner(p_company_id)) then
    raise exception 'Only the account owner decides how clients are chased'
      using errcode = '42501';
  end if;

  if p_quiet_hours_start = p_quiet_hours_end then
    raise exception 'Quiet hours of zero length are not quiet hours'
      using errcode = '22023';
  end if;

  if coalesce(array_length(p_sending_weekdays, 1), 0) = 0 then
    raise exception 'Choose at least one day reminders may go out on'
      using errcode = '22023';
  end if;

  if p_statement_day_of_month is not null
     and p_statement_day_of_month not between 1 and 28 then
    raise exception 'Choose a day between the first and the twenty eighth, so every month has one'
      using errcode = '22023';
  end if;

  insert into public.reminder_settings (
    company_id, is_enabled, time_zone, quiet_hours_start, quiet_hours_end,
    sending_weekdays, shift_due_dates_to_business_days, send_statements,
    statement_day_of_month
  )
  values (
    p_company_id, coalesce(p_is_enabled, true), p_time_zone,
    p_quiet_hours_start, p_quiet_hours_end,
    coalesce(p_sending_weekdays, array[1, 2, 3, 4, 5]::smallint[]),
    coalesce(p_shift_due_dates_to_business_days, false),
    coalesce(p_send_statements, false),
    p_statement_day_of_month::smallint
  )
  on conflict (company_id) do update
     set is_enabled = excluded.is_enabled,
         time_zone = excluded.time_zone,
         quiet_hours_start = excluded.quiet_hours_start,
         quiet_hours_end = excluded.quiet_hours_end,
         sending_weekdays = excluded.sending_weekdays,
         shift_due_dates_to_business_days = excluded.shift_due_dates_to_business_days,
         send_statements = excluded.send_statements,
         statement_day_of_month = excluded.statement_day_of_month,
         updated_at = now();

  return true;
end;
$$;

comment on function public.save_reminder_settings(
  uuid, boolean, text, time, time, smallint[], boolean, boolean, integer
) is 'Sets when a business is willing to chase, in the time zone of its clients.';

-- -----------------------------------------------------------------------------
-- What the collections screen shows
-- -----------------------------------------------------------------------------

create or replace function public.collections_overview(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.reminder_settings%rowtype;
  v_overdue numeric;
  v_overdue_count integer;
  v_due_soon numeric;
  v_scheduled integer;
  v_promised numeric;
begin
  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You cannot read the collections of another business'
      using errcode = '42501';
  end if;

  select * into v_settings
    from public.reminder_settings
   where company_id = p_company_id;

  select coalesce(sum(balance_due), 0), count(*)::int
    into v_overdue, v_overdue_count
    from public.invoices
   where company_id = p_company_id
     and deleted_at is null
     and balance_due > 0
     and due_date < current_date;

  select coalesce(sum(balance_due), 0)
    into v_due_soon
    from public.invoices
   where company_id = p_company_id
     and deleted_at is null
     and balance_due > 0
     and due_date between current_date and current_date + 7;

  select count(*)::int into v_scheduled
    from public.invoice_reminders
   where company_id = p_company_id
     and status = 'scheduled';

  select coalesce(sum(coalesce(promised_amount, 0)), 0)
    into v_promised
    from public.payment_promises
   where company_id = p_company_id
     and status = 'open';

  return jsonb_build_object(
    'overdue_amount', v_overdue,
    'overdue_count', coalesce(v_overdue_count, 0),
    'due_within_a_week', v_due_soon,
    'scheduled_reminders', coalesce(v_scheduled, 0),
    'promised_amount', v_promised,
    'is_enabled', coalesce(v_settings.is_enabled, true),
    'time_zone', coalesce(v_settings.time_zone, 'UTC'),
    'quiet_hours_start', coalesce(v_settings.quiet_hours_start, '20:00'::time),
    'quiet_hours_end', coalesce(v_settings.quiet_hours_end, '08:00'::time),
    'sending_weekdays', to_jsonb(coalesce(v_settings.sending_weekdays,
                                          array[1, 2, 3, 4, 5]::smallint[])),
    'send_statements', coalesce(v_settings.send_statements, false),
    'statement_day_of_month', v_settings.statement_day_of_month,
    'has_settings', v_settings.company_id is not null
  );
end;
$$;

comment on function public.collections_overview(uuid) is
  'Sums what is late, what is promised and when this business is willing to chase.';

create or replace function public.reminder_rule_list(p_company_id uuid)
returns table (
  rule_id uuid,
  name text,
  offset_days smallint,
  template_key text,
  minimum_balance numeric,
  max_reminders smallint,
  skip_if_promise_to_pay boolean,
  is_active boolean,
  scheduled_count integer,
  sent_count integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You cannot read the collections of another business'
      using errcode = '42501';
  end if;

  return query
    select r.id, r.name, r.offset_days, r.template_key, r.minimum_balance,
           r.max_reminders, r.skip_if_promise_to_pay, r.is_active,
           (select count(*) from public.invoice_reminders as i
             where i.rule_id = r.id and i.status = 'scheduled')::int,
           (select count(*) from public.invoice_reminders as i
             where i.rule_id = r.id and i.status = 'sent')::int
      from public.reminder_rules as r
     where r.company_id = p_company_id
       and r.deleted_at is null
     order by r.offset_days;
end;
$$;

comment on function public.reminder_rule_list(uuid) is
  'Lists the reminders a business sends and how often each has actually gone out.';

create or replace function public.open_payment_promises(p_company_id uuid)
returns table (
  promise_id uuid,
  invoice_id uuid,
  invoice_number text,
  client_name text,
  promised_date date,
  promised_amount numeric,
  balance_due numeric,
  note text,
  is_late boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You cannot read the collections of another business'
      using errcode = '42501';
  end if;

  return query
    select p.id,
           p.invoice_id,
           i.invoice_number,
           c.display_name,
           p.promised_date,
           p.promised_amount,
           i.balance_due,
           p.note,
           p.promised_date < current_date
      from public.payment_promises as p
      join public.invoices as i on i.id = p.invoice_id
      left join public.clients as c on c.id = p.client_id
     where p.company_id = p_company_id
       and p.status = 'open'
     order by p.promised_date;
end;
$$;

comment on function public.open_payment_promises(uuid) is
  'Lists what clients have promised to pay, and which promises are already broken.';

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.save_reminder_rule(
  uuid, text, integer, text, numeric, integer, boolean, boolean, uuid
) from public, authenticated;
revoke execute on function public.delete_reminder_rule(uuid)
  from public, authenticated;
revoke execute on function public.save_reminder_settings(
  uuid, boolean, text, time, time, smallint[], boolean, boolean, integer
) from public, authenticated;
revoke execute on function public.collections_overview(uuid)
  from public, authenticated;
revoke execute on function public.reminder_rule_list(uuid)
  from public, authenticated;
revoke execute on function public.open_payment_promises(uuid)
  from public, authenticated;

grant execute on function public.save_reminder_rule(
  uuid, text, integer, text, numeric, integer, boolean, boolean, uuid
) to authenticated, service_role;
grant execute on function public.delete_reminder_rule(uuid)
  to authenticated, service_role;
grant execute on function public.save_reminder_settings(
  uuid, boolean, text, time, time, smallint[], boolean, boolean, integer
) to authenticated, service_role;
grant execute on function public.collections_overview(uuid)
  to authenticated, service_role;
grant execute on function public.reminder_rule_list(uuid)
  to authenticated, service_role;
grant execute on function public.open_payment_promises(uuid)
  to authenticated, service_role;

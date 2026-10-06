-- supabase/migrations/00085_create_reminder_functions.sql
-- Planning reminders, moving them out of quiet hours, and sending them.

-- Returns the next moment a tenant is allowed to contact a client.
create or replace function public.next_sending_slot(
  p_company_id uuid,
  p_earliest timestamptz default now()
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.reminder_settings%rowtype;
  v_zone text;
  v_local timestamp;
  v_candidate timestamp;
  v_guard smallint := 0;
begin
  select * into v_settings from public.reminder_settings where company_id = p_company_id;

  if not found then
    return p_earliest;
  end if;

  v_zone := coalesce(v_settings.time_zone, 'UTC');
  v_local := p_earliest at time zone v_zone;
  v_candidate := v_local;

  -- At most one week of shifting; a configuration that allows no day at all
  -- would otherwise loop forever.
  while v_guard < 8 loop
    -- Quiet hours may wrap around midnight, so both shapes are handled.
    if v_settings.quiet_hours_start < v_settings.quiet_hours_end then
      if v_candidate::time >= v_settings.quiet_hours_start
         and v_candidate::time < v_settings.quiet_hours_end then
        v_candidate := date_trunc('day', v_candidate) + v_settings.quiet_hours_end;
      end if;
    else
      if v_candidate::time >= v_settings.quiet_hours_start then
        v_candidate := date_trunc('day', v_candidate) + interval '1 day'
                       + v_settings.quiet_hours_end;
      elsif v_candidate::time < v_settings.quiet_hours_end then
        v_candidate := date_trunc('day', v_candidate) + v_settings.quiet_hours_end;
      end if;
    end if;

    if extract(isodow from v_candidate)::smallint = any (v_settings.sending_weekdays) then
      return v_candidate at time zone v_zone;
    end if;

    v_candidate := date_trunc('day', v_candidate) + interval '1 day'
                   + v_settings.quiet_hours_end;
    v_guard := v_guard + 1;
  end loop;

  return p_earliest;
end;
$$;

comment on function public.next_sending_slot(uuid, timestamptz) is
  'Moves a send time out of quiet hours and onto a working day of the tenant.';

-- Plans every reminder for one invoice, replacing any earlier plan.
create or replace function public.schedule_invoice_reminders(p_invoice_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_rule record;
  v_when timestamptz;
  v_count integer := 0;
begin
  select * into v_invoice
    from public.invoices
   where id = p_invoice_id and deleted_at is null;

  if not found then
    return 0;
  end if;

  if not exists (
    select 1 from public.reminder_settings
     where company_id = v_invoice.company_id and is_enabled
  ) then
    return 0;
  end if;

  update public.invoice_reminders
     set status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = 'The reminder plan was rebuilt',
         updated_at = now()
   where invoice_id = p_invoice_id
     and status = 'scheduled';

  if v_invoice.status in ('paid', 'cancelled', 'written_off', 'draft') then
    return 0;
  end if;

  for v_rule in
    select *
      from public.reminder_rules
     where company_id = v_invoice.company_id
       and is_active
       and deleted_at is null
     order by offset_days
  loop
    if v_invoice.balance_due < v_rule.minimum_balance then
      continue;
    end if;

    if not (v_invoice.status = any (v_rule.applies_to_status)) then
      continue;
    end if;

    v_when := public.next_sending_slot(
      v_invoice.company_id,
      ((v_invoice.due_date + v_rule.offset_days)::timestamp at time zone 'UTC')
    );

    if v_when < now() then
      continue;
    end if;

    insert into public.invoice_reminders (
      company_id, invoice_id, rule_id, scheduled_for
    )
    values (v_invoice.company_id, p_invoice_id, v_rule.id, v_when)
    on conflict (invoice_id, rule_id, attempt_number) do update
      set scheduled_for = excluded.scheduled_for,
          status = 'scheduled',
          cancelled_at = null,
          cancellation_reason = null,
          updated_at = now();

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.schedule_invoice_reminders(uuid) is
  'Rebuilds the reminder plan for one invoice from the rules of its tenant.';

-- Stops the ladder once an invoice no longer needs chasing.
create or replace function public.cancel_invoice_reminders(
  p_invoice_id uuid,
  p_reason text
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.invoice_reminders
     set status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = p_reason,
         updated_at = now()
   where invoice_id = p_invoice_id
     and status = 'scheduled';

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

comment on function public.cancel_invoice_reminders(uuid, text) is
  'Cancels the planned reminders of an invoice that no longer needs them.';

-- Records a promise to pay and pauses the ladder until that date.
create or replace function public.record_payment_promise(
  p_invoice_id uuid,
  p_promised_date date,
  p_promised_amount numeric default null,
  p_note text default null,
  p_source text default 'staff'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_id uuid;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id and deleted_at is null;

  if not found then
    raise exception 'Invoice % was not found', p_invoice_id using errcode = 'P0002';
  end if;

  if p_promised_date < current_date then
    raise exception 'A promise to pay cannot be set in the past'
      using errcode = '22023';
  end if;

  insert into public.payment_promises (
    company_id, invoice_id, client_id, promised_date, promised_amount, note,
    recorded_by, source
  )
  values (
    v_invoice.company_id, p_invoice_id, v_invoice.client_id, p_promised_date,
    p_promised_amount, p_note, public.current_user_id(), p_source
  )
  returning id into v_id;

  update public.invoice_reminders
     set status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = 'The client promised to pay on '
                               || to_char(p_promised_date, 'DD Mon YYYY'),
         updated_at = now()
   where invoice_id = p_invoice_id
     and status = 'scheduled'
     and scheduled_for::date <= p_promised_date;

  return v_id;
end;
$$;

comment on function public.record_payment_promise(
  uuid, date, numeric, text, text
) is 'Records a date the client committed to, and pauses chasing until then.';

-- Settles open promises once their date has passed.
create or replace function public.resolve_due_payment_promises()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select pr.id, pr.invoice_id, i.balance_due, i.status
      from public.payment_promises as pr
      join public.invoices as i on i.id = pr.invoice_id
     where pr.status = 'open'
       and pr.promised_date < current_date
  loop
    update public.payment_promises
       set status = case when v_row.balance_due <= 0 then 'kept' else 'broken' end,
           resolved_at = now(),
           updated_at = now()
     where id = v_row.id;

    if v_row.balance_due > 0 then
      perform public.schedule_invoice_reminders(v_row.invoice_id);
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.resolve_due_payment_promises() is
  'Closes promises whose date has passed and restarts chasing when broken.';

-- Sends the reminders that are due, honouring the daily limit of the tenant.
create or replace function public.run_due_reminders(p_limit integer default 200)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_message_id uuid;
  v_count integer := 0;
begin
  for v_row in
    select r.id, r.company_id, r.invoice_id, r.rule_id, r.attempt_number,
           i.invoice_number, i.due_date, i.balance_due, i.currency, i.client_id,
           rule.template_key,
           c.display_name as client_name, c.email as client_email,
           coalesce(p.trade_name, p.legal_name) as company_name
      from public.invoice_reminders as r
      join public.invoices as i on i.id = r.invoice_id
      join public.reminder_rules as rule on rule.id = r.rule_id
      join public.clients as c on c.id = i.client_id
      left join public.company_profiles as p on p.company_id = r.company_id
     where r.status = 'scheduled'
       and r.scheduled_for <= now()
     order by r.scheduled_for
     limit greatest(coalesce(p_limit, 200), 1)
  loop
    if v_row.balance_due <= 0 then
      update public.invoice_reminders
         set status = 'skipped',
             cancellation_reason = 'The invoice was settled before the reminder was due',
             updated_at = now()
       where id = v_row.id;
      continue;
    end if;

    if v_row.client_email is null
       or public.is_email_suppressed(v_row.client_email::text, v_row.company_id) then
      update public.invoice_reminders
         set status = 'skipped',
             cancellation_reason = 'The client has no address that accepts mail',
             updated_at = now()
       where id = v_row.id;
      continue;
    end if;

    v_message_id := public.queue_message(
      v_row.company_id,
      v_row.template_key,
      v_row.client_email::text,
      jsonb_build_object(
        'client_name', coalesce(v_row.client_name, 'there'),
        'company_name', coalesce(v_row.company_name, 'our team'),
        'invoice_number', v_row.invoice_number,
        'balance_due', v_row.currency || ' '
          || to_char(v_row.balance_due, 'FM999999999990.00'),
        'due_date', to_char(v_row.due_date, 'DD Mon YYYY'),
        'document_url', '/invoice/' || v_row.invoice_id::text
      ),
      'reminder:' || v_row.id::text,
      v_row.client_name,
      'invoice',
      v_row.invoice_id,
      v_row.client_id
    );

    update public.invoice_reminders
       set status = 'sent',
           message_id = v_message_id,
           sent_at = now(),
           updated_at = now()
     where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.run_due_reminders(integer) is
  'Queues every reminder that has come due, skipping settled and silent ones.';

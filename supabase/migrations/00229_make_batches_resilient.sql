-- supabase/migrations/00229_make_batches_resilient.sql
-- One business's bad data must not stop everybody else's work.
--
-- The scheduled jobs walk a queue and do something for each row. Written in
-- the obvious way, the whole loop is one transaction: if the four hundredth
-- row raises, every one before it is rolled back and nothing is sent at
-- all. Worse, the failing row is somebody else's misconfiguration, so one
-- tenant with a reminder pointing at wording nobody wrote would silently
-- stop reminders for every tenant on the platform, every hour, until
-- somebody noticed.
--
-- The fix is not clever: each row gets its own exception block. A row that
-- fails is marked as failed with the reason, and the loop carries on. The
-- reason is written where the business can read it, because a reminder
-- that never went out is their problem to fix and they cannot fix what
-- they cannot see.

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
  v_reason text;
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

    -- Everything below belongs to one tenant. If it fails, it fails alone.
    begin
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
    exception
      when others then
        get stacked diagnostics v_reason = message_text;

        update public.invoice_reminders
           set status = 'failed',
               cancellation_reason = left(coalesce(v_reason, 'This reminder could not be sent'), 300),
               updated_at = now()
         where id = v_row.id;
    end;
  end loop;

  return v_count;
end;
$$;

comment on function public.run_due_reminders(integer) is
  'Queues every reminder that has come due. A reminder that fails fails alone.';

-- The same reasoning for a sequence. A campaign with one broken step must
-- not hold up every other campaign on the platform.
create or replace function public.advance_campaign_sequences()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_queued integer := 0;
  v_added integer := 0;
  v_step record;
begin
  for v_step in
    select s.*, c.company_id
      from public.campaign_steps as s
      join public.marketing_campaigns as c on c.id = s.campaign_id
     where s.is_active
       and c.campaign_type = 'sequence'
       and c.status in ('scheduled', 'sending')
       and c.deleted_at is null
     order by s.campaign_id, s.step_number
  loop
    begin
      with queued as (
        insert into public.campaign_recipients (
          campaign_id, company_id, step_id, client_id, email_address,
          scheduled_for
        )
        select v_step.campaign_id,
               v_step.company_id,
               v_step.id,
               previous.client_id,
               previous.email_address,
               previous.sent_at + make_interval(hours => v_step.delay_hours)
          from public.campaign_recipients as previous
         where previous.campaign_id = v_step.campaign_id
           and previous.step_id is distinct from v_step.id
           and previous.status in ('sent', 'delivered', 'opened')
           and previous.sent_at is not null
           and previous.sent_at + make_interval(hours => v_step.delay_hours) <= now()
        on conflict do nothing
        returning 1
      )
      select count(*)::int into v_added from queued;

      v_queued := v_queued + coalesce(v_added, 0);
    exception
      when others then
        -- One campaign cannot be allowed to stop the rest. The campaign
        -- itself is paused so the business sees that it stopped.
        update public.marketing_campaigns
           set status = 'paused',
               updated_at = now()
         where id = v_step.campaign_id;
    end;
  end loop;

  return v_queued;
end;
$$;

comment on function public.advance_campaign_sequences() is
  'Queues the next message of each sequence. A broken sequence pauses itself alone.';

-- The same again for the rules that turn an event into a social post. The
-- signature is unchanged; only the isolation is new.
create or replace function public.trigger_social_rules(
  p_company_id uuid,
  p_trigger_event text,
  p_substitutions jsonb default '{}'::jsonb
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule public.social_auto_rules%rowtype;
  v_body text;
  v_post_id uuid;
  v_created integer := 0;
  v_entry record;
begin
  for v_rule in
    select *
      from public.social_auto_rules
     where is_active
       and deleted_at is null
       and trigger_event = p_trigger_event
       and company_id is not distinct from p_company_id
  loop
    if v_rule.last_triggered_at is not null
       and v_rule.last_triggered_at
           > now() - make_interval(hours => v_rule.minimum_hours_between_posts) then
      continue;
    end if;

    begin
      v_body := v_rule.body_template;

      for v_entry in
        select key, value from jsonb_each_text(coalesce(p_substitutions, '{}'::jsonb))
      loop
        v_body := replace(v_body, '{{' || v_entry.key || '}}', v_entry.value);
      end loop;

      insert into public.social_posts (
        company_id, title, body, status, created_by_rule_id
      )
      values (
        p_company_id,
        left(v_rule.name, 120),
        v_body,
        case when v_rule.requires_approval then 'awaiting_approval' else 'draft' end,
        v_rule.id
      )
      returning id into v_post_id;

      update public.social_auto_rules
         set last_triggered_at = now(),
             trigger_count = trigger_count + 1,
             updated_at = now()
       where id = v_rule.id;

      v_created := v_created + 1;
    exception
      when others then
        -- A rule that cannot produce a usable post switches itself off
        -- rather than failing every other rule behind it.
        update public.social_auto_rules
           set is_active = false,
               updated_at = now()
         where id = v_rule.id;
    end;
  end loop;

  return v_created;
end;
$$;

comment on function public.trigger_social_rules(uuid, text, jsonb) is
  'Raises draft posts from the rules that match. A rule that cannot run stops alone.';

-- supabase/migrations/00231_isolate_remaining_jobs.sql
-- Finishing the sweep: every scheduled loop now fails one row at a time.
--
-- Three jobs were still written so that one bad row rolled the whole batch
-- back. Each of them touches something a business notices within a day:
--
--   the dunning run, which decides what happens to a subscription that has
--   not been paid for;
--
--   the cancellation run, which moves a business onto the free plan at the
--   end of a period it has paid for, and would otherwise leave it with no
--   plan at all;
--
--   the promise run, which closes a promise to pay and starts chasing
--   again when it was broken.
--
-- The pattern is the same as the jobs already treated: isolate the row,
-- write down what went wrong, carry on.

create or replace function public.run_subscription_dunning(
  p_grace_days integer default 14
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_count integer := 0;
  v_reason text;
begin
  for v_row in
    select s.id, s.company_id, s.plan_id, s.past_due_since, s.dunning_attempt_count
      from public.subscriptions as s
     where s.deleted_at is null
       and s.status in ('active', 'past_due')
       and exists (
         select 1
           from public.subscription_invoices as i
          where i.subscription_id = s.id
            and i.deleted_at is null
            and i.status in ('sent', 'partially_paid', 'overdue')
            and i.due_date < current_date
       )
  loop
    begin
      if v_row.past_due_since is not null
         and v_row.past_due_since + p_grace_days < current_date then
        update public.subscriptions
           set status = 'paused',
               paused_at = now(),
               dunning_attempt_count = v_row.dunning_attempt_count + 1,
               last_dunning_email_at = now(),
               updated_at = now()
         where id = v_row.id;

        insert into public.subscription_changes (
          subscription_id, company_id, change_type, from_plan_id, reason
        )
        values (
          v_row.id, v_row.company_id, 'paused', v_row.plan_id,
          'Access was paused after the payment grace period ran out'
        );
      else
        update public.subscriptions
           set status = 'past_due',
               past_due_since = coalesce(past_due_since, current_date),
               grace_period_ends_on =
                 coalesce(grace_period_ends_on, current_date + p_grace_days),
               dunning_attempt_count = least(v_row.dunning_attempt_count + 1, 20),
               last_dunning_email_at = now(),
               updated_at = now()
         where id = v_row.id;
      end if;

      update public.subscription_invoices
         set status = 'overdue',
             updated_at = now()
       where subscription_id = v_row.id
         and deleted_at is null
         and status in ('sent', 'partially_paid')
         and due_date < current_date;

      v_count := v_count + 1;
    exception
      when others then
        get stacked diagnostics v_reason = message_text;

        perform public.record_job_failure(
          'run_subscription_dunning', 'subscription', v_row.id, v_reason, v_row.company_id
        );
    end;
  end loop;

  return v_count;
end;
$$;

comment on function public.run_subscription_dunning(integer) is
  'Marks overdue platform invoices and moves accounts along the ladder, one at a time.';

create or replace function public.process_scheduled_cancellations()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_count integer := 0;
  v_reason text;
begin
  for v_row in
    select id, company_id, plan_id
      from public.subscriptions
     where deleted_at is null
       and cancel_at_period_end
       and status not in ('cancelled', 'expired')
       and current_period_end < current_date
  loop
    begin
      update public.subscriptions
         set status = 'expired',
             ended_at = now(),
             updated_at = now()
       where id = v_row.id;

      insert into public.subscription_changes (
        subscription_id, company_id, change_type, from_plan_id, reason
      )
      values (
        v_row.id, v_row.company_id, 'expired', v_row.plan_id,
        'The cancelled subscription reached the end of its paid period'
      );

      -- The tenant keeps its data and falls back to the signup plan. If
      -- this step fails the whole row is rolled back, which is correct:
      -- better to retry the cancellation than to leave a business expired
      -- with no plan at all.
      perform public.start_default_subscription(v_row.company_id);

      v_count := v_count + 1;
    exception
      when others then
        get stacked diagnostics v_reason = message_text;

        perform public.record_job_failure(
          'process_scheduled_cancellations', 'subscription', v_row.id, v_reason,
          v_row.company_id
        );
    end;
  end loop;

  return v_count;
end;
$$;

comment on function public.process_scheduled_cancellations() is
  'Ends the subscriptions whose paid period is over and puts each business on the free plan.';

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
  v_reason text;
begin
  for v_row in
    select pr.id, pr.company_id, pr.invoice_id, i.balance_due, i.status
      from public.payment_promises as pr
      join public.invoices as i on i.id = pr.invoice_id
     where pr.status = 'open'
       and pr.promised_date < current_date
  loop
    begin
      update public.payment_promises
         set status = case when v_row.balance_due <= 0 then 'kept' else 'broken' end,
             resolved_at = now(),
             updated_at = now()
       where id = v_row.id;

      if v_row.balance_due > 0 then
        perform public.schedule_invoice_reminders(v_row.invoice_id);
      end if;

      v_count := v_count + 1;
    exception
      when others then
        get stacked diagnostics v_reason = message_text;

        perform public.record_job_failure(
          'resolve_due_payment_promises', 'payment_promise', v_row.id, v_reason,
          v_row.company_id
        );
    end;
  end loop;

  return v_count;
end;
$$;

comment on function public.resolve_due_payment_promises() is
  'Closes promises whose date has passed and restarts chasing when one was broken.';

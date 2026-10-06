-- supabase/migrations/00232_requeue_stalled_messages.sql
-- Messages that were picked up and then abandoned.
--
-- The sender claims a batch by marking it as sending, then hands each one
-- to the email provider. That is the right way to stop two workers sending
-- the same invoice twice. It has one consequence that has to be dealt with
-- explicitly: if the worker dies between claiming and sending, those rows
-- stay marked as sending forever. They are never retried, never reported,
-- and the business believes the invoice went out.
--
-- A worker dying is not an exotic event. A scheduled function has a time
-- limit, a deployment restarts a process mid batch, a network call hangs.
-- So anything that has been sending for longer than it could plausibly
-- take is put back in the queue, and anything that has been put back too
-- many times is reported rather than looping forever.

create or replace function public.requeue_stalled_messages(
  p_stalled_minutes integer default 15,
  p_max_attempts integer default 5
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
begin
  if not public.is_service_role() then
    raise exception 'Only the server may requeue messages' using errcode = '42501';
  end if;

  for v_row in
    select id, company_id, attempt_count, to_email
      from public.messages
     where status = 'sending'
       and updated_at < now() - make_interval(mins => greatest(coalesce(p_stalled_minutes, 15), 1))
  loop
    if v_row.attempt_count >= greatest(coalesce(p_max_attempts, 5), 1) then
      -- Giving up quietly would be the worst outcome, so the message is
      -- marked failed and the failure is written where somebody sees it.
      update public.messages
         set status = 'failed',
             failure_reason = 'Picked up for sending and never finished, after every attempt',
             updated_at = now()
       where id = v_row.id;

      perform public.record_job_failure(
        'dispatch_messages',
        'message',
        v_row.id,
        'The message was claimed for sending and never finished, after every attempt',
        v_row.company_id
      );
    else
      update public.messages
         set status = 'queued',
             next_attempt_at = now(),
             failure_reason = 'Picked up for sending and never finished; put back in the queue',
             updated_at = now()
       where id = v_row.id;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.requeue_stalled_messages(integer, integer) is
  'Puts back messages a dead worker left marked as sending, and reports the ones that keep failing.';

-- The same hazard exists for an upload that was begun and never finished,
-- and for a webhook delivery reserved by a worker that died. Both already
-- have a sweeper for the first case; this covers the second.
create or replace function public.release_stalled_deliveries(
  p_stalled_minutes integer default 10
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
  if not public.is_service_role() then
    raise exception 'Only the server may release deliveries' using errcode = '42501';
  end if;

  update public.webhook_deliveries
     set reserved_at = null,
         reserved_by = null,
         next_attempt_at = now(),
         updated_at = now()
   where status = 'pending'
     and reserved_at is not null
     and reserved_at < now() - make_interval(mins => greatest(coalesce(p_stalled_minutes, 10), 1));

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

comment on function public.release_stalled_deliveries(integer) is
  'Frees deliveries reserved by a worker that never came back, so they are tried again.';

revoke execute on function public.requeue_stalled_messages(integer, integer)
  from public, authenticated;
revoke execute on function public.release_stalled_deliveries(integer)
  from public, authenticated;

grant execute on function public.requeue_stalled_messages(integer, integer) to service_role;
grant execute on function public.release_stalled_deliveries(integer) to service_role;

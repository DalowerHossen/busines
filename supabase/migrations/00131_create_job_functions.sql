-- supabase/migrations/00131_create_job_functions.sql
-- Queueing work, claiming it, finishing it, and rescuing it when a worker
-- disappears halfway through.

-- Queues one job. Giving the same idempotency key twice returns the job that
-- already exists rather than doing the work twice.
create or replace function public.enqueue_job(
  p_job_type text,
  p_payload jsonb default '{}'::jsonb,
  p_company_id uuid default null,
  p_run_after timestamptz default now(),
  p_queue_name text default 'default',
  p_priority smallint default 100,
  p_idempotency_key text default null,
  p_max_attempts smallint default 5
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid;
begin
  if p_idempotency_key is not null then
    select id into v_job_id
      from public.background_jobs
     where job_type = p_job_type
       and idempotency_key = p_idempotency_key;

    if v_job_id is not null then
      return v_job_id;
    end if;
  end if;

  insert into public.background_jobs (
    company_id, job_type, queue_name, priority, payload, run_after,
    max_attempts, idempotency_key, created_by
  )
  values (
    p_company_id, p_job_type, coalesce(p_queue_name, 'default'),
    coalesce(p_priority, 100::smallint), coalesce(p_payload, '{}'::jsonb),
    coalesce(p_run_after, now()), coalesce(p_max_attempts, 5::smallint),
    p_idempotency_key, public.current_user_id()
  )
  returning id into v_job_id;

  return v_job_id;
end;
$$;

comment on function public.enqueue_job(
  text, jsonb, uuid, timestamptz, text, smallint, text, smallint
) is 'Queues one piece of deferred work, once per idempotency key.';

-- Reserves a batch of ready jobs for one worker.
create or replace function public.claim_jobs(
  p_worker_id text,
  p_queue_name text default 'default',
  p_limit integer default 10,
  p_lease_seconds integer default 300
)
returns setof public.background_jobs
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with ready as (
    select id
      from public.background_jobs
     where status = 'queued'
       and queue_name = coalesce(p_queue_name, 'default')
       and run_after <= now()
     order by priority, run_after
     limit greatest(coalesce(p_limit, 10), 1)
       for update skip locked
  )
  update public.background_jobs as j
     set status = 'reserved',
         reserved_at = now(),
         reserved_by = p_worker_id,
         reservation_expires_at = now()
                                  + make_interval(secs => greatest(coalesce(p_lease_seconds, 300), 30)),
         attempt_count = j.attempt_count + 1,
         updated_at = now()
    from ready
   where j.id = ready.id
  returning j.*;
end;
$$;

comment on function public.claim_jobs(text, text, integer, integer) is
  'Reserves a batch of ready jobs for one worker, with a lease.';

-- Marks a reserved job as actually started.
create or replace function public.start_job(p_job_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  update public.background_jobs
     set status = 'running',
         started_at = now(),
         updated_at = now()
   where id = p_job_id
     and status = 'reserved';

  return found;
end;
$$;

comment on function public.start_job(uuid) is
  'Moves a reserved job into the running state.';

-- Finishes a job successfully.
create or replace function public.complete_job(
  p_job_id uuid,
  p_result jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.background_jobs%rowtype;
begin
  select * into v_job from public.background_jobs where id = p_job_id for update;

  if not found then
    return false;
  end if;

  update public.background_jobs
     set status = 'succeeded',
         finished_at = now(),
         duration_ms = greatest(
           extract(epoch from (now() - coalesce(started_at, reserved_at, now())))::integer * 1000,
           0
         ),
         result = coalesce(p_result, '{}'::jsonb),
         reserved_at = null,
         reserved_by = null,
         reservation_expires_at = null,
         last_error = null,
         updated_at = now()
   where id = p_job_id;

  if v_job.schedule_id is not null then
    update public.job_schedules
       set last_status = 'succeeded', updated_at = now()
     where id = v_job.schedule_id;
  end if;

  return true;
end;
$$;

comment on function public.complete_job(uuid, jsonb) is
  'Records that a job finished and what it produced.';

-- Fails a job. It is retried with a backoff until the attempts run out, then
-- it is dead lettered for a person to look at.
create or replace function public.fail_job(
  p_job_id uuid,
  p_error text,
  p_retry boolean default true
)
returns public.job_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.background_jobs%rowtype;
  v_status public.job_status;
  v_backoff integer;
begin
  select * into v_job from public.background_jobs where id = p_job_id for update;

  if not found then
    raise exception 'Job % was not found', p_job_id using errcode = 'P0002';
  end if;

  if not p_retry or v_job.attempt_count >= v_job.max_attempts then
    v_status := 'dead_letter';

    update public.background_jobs
       set status = v_status,
           dead_lettered_at = now(),
           finished_at = now(),
           last_error = left(coalesce(p_error, 'The job failed'), 1000),
           reserved_at = null,
           reserved_by = null,
           reservation_expires_at = null,
           updated_at = now()
     where id = p_job_id;
  else
    v_status := 'queued';
    -- Thirty seconds, then doubling, capped at one hour.
    v_backoff := least(30 * power(2, v_job.attempt_count)::integer, 3600);

    update public.background_jobs
       set status = v_status,
           run_after = now() + make_interval(secs => v_backoff),
           last_error = left(coalesce(p_error, 'The job failed'), 1000),
           reserved_at = null,
           reserved_by = null,
           reservation_expires_at = null,
           updated_at = now()
     where id = p_job_id;
  end if;

  if v_job.schedule_id is not null then
    update public.job_schedules
       set last_status = 'failed',
           failure_count = failure_count + 1,
           updated_at = now()
     where id = v_job.schedule_id;
  end if;

  return v_status;
end;
$$;

comment on function public.fail_job(uuid, text, boolean) is
  'Records a failed attempt and either schedules a retry or dead letters it.';

-- Rescues jobs whose worker went away without saying anything.
create or replace function public.release_expired_job_leases()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.background_jobs
     set status = case
                    when attempt_count >= max_attempts then 'dead_letter'::public.job_status
                    else 'queued'::public.job_status
                  end,
         dead_lettered_at = case
                              when attempt_count >= max_attempts then now()
                              else null
                            end,
         run_after = now(),
         reserved_at = null,
         reserved_by = null,
         reservation_expires_at = null,
         last_error = 'The worker stopped without finishing the job',
         updated_at = now()
   where status in ('reserved', 'running')
     and reservation_expires_at is not null
     and reservation_expires_at <= now();

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

comment on function public.release_expired_job_leases() is
  'Puts jobs back in the queue when the worker holding them disappeared.';

-- Turns the timetable into queued work. Called every minute by the runner.
create or replace function public.dispatch_due_schedules()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_schedule record;
  v_job_id uuid;
  v_count integer := 0;
begin
  for v_schedule in
    select *
      from public.job_schedules
     where is_active
       and deleted_at is null
       and next_run_at <= now()
     order by next_run_at
       for update skip locked
  loop
    v_job_id := public.enqueue_job(
      v_schedule.job_type,
      v_schedule.payload,
      v_schedule.company_id,
      now(),
      v_schedule.queue_name,
      100::smallint,
      -- One run per schedule per window, whatever happens upstream.
      v_schedule.id::text || ':' || to_char(now(), 'YYYYMMDDHH24MI'),
      5::smallint
    );

    update public.background_jobs
       set schedule_id = v_schedule.id
     where id = v_job_id;

    update public.job_schedules
       set last_run_at = now(),
           next_run_at = now() + make_interval(mins => v_schedule.interval_minutes),
           run_count = run_count + 1,
           updated_at = now()
     where id = v_schedule.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.dispatch_due_schedules() is
  'Queues the work that the timetable says is due.';

-- Puts a dead lettered job back in the queue after the cause was fixed.
create or replace function public.retry_dead_job(p_job_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.background_jobs%rowtype;
begin
  select * into v_job from public.background_jobs where id = p_job_id for update;

  if not found or v_job.status <> 'dead_letter' then
    return false;
  end if;

  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team can retry a dead lettered job'
      using errcode = '42501';
  end if;

  update public.background_jobs
     set status = 'queued',
         attempt_count = 0,
         run_after = now(),
         dead_lettered_at = null,
         finished_at = null,
         last_error = null,
         updated_at = now()
   where id = p_job_id;

  return true;
end;
$$;

comment on function public.retry_dead_job(uuid) is
  'Returns a dead lettered job to the queue for another attempt.';

-- What the queue looks like right now, for the health screen.
create or replace function public.job_queue_health()
returns table (
  queue_name text,
  queued_count integer,
  running_count integer,
  dead_letter_count integer,
  oldest_queued_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select j.queue_name,
         (count(*) filter (where j.status = 'queued'))::integer,
         (count(*) filter (where j.status in ('reserved', 'running')))::integer,
         (count(*) filter (where j.status = 'dead_letter'))::integer,
         min(j.run_after) filter (where j.status = 'queued')
    from public.background_jobs as j
   where j.status in ('queued', 'reserved', 'running', 'dead_letter')
   group by j.queue_name
   order by j.queue_name;
$$;

comment on function public.job_queue_health() is
  'Reports the depth and the backlog of every queue.';

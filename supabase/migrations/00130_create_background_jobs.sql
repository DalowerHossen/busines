-- supabase/migrations/00130_create_background_jobs.sql
-- The work the platform does when nobody is watching.
--
-- Reminders, statements, imports, PDF rendering and payouts all run out of
-- this one queue, so there is a single place to see what is waiting, what
-- failed and what is scheduled.

create table public.background_jobs (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,

  job_type text not null,
  queue_name text not null default 'default',
  priority smallint not null default 100,
  payload jsonb not null default '{}'::jsonb,

  status public.job_status not null default 'queued',
  run_after timestamptz not null default now(),

  attempt_count smallint not null default 0,
  max_attempts smallint not null default 5,

  reserved_at timestamptz,
  reserved_by text,
  -- A worker that dies holds nothing for longer than this.
  reservation_expires_at timestamptz,

  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  result jsonb,
  last_error text,
  dead_lettered_at timestamptz,

  -- Set by the producer so the same work is never queued twice.
  idempotency_key text,
  schedule_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,

  constraint background_jobs_type_check
    check (job_type ~ '^[a-z][a-z0-9_]{2,60}$'),
  constraint background_jobs_queue_check
    check (queue_name ~ '^[a-z][a-z0-9_-]{1,30}$'),
  constraint background_jobs_priority_check
    check (priority between 1 and 1000),
  constraint background_jobs_payload_check
    check (jsonb_typeof(payload) = 'object'),
  constraint background_jobs_attempts_check
    check (attempt_count >= 0 and max_attempts between 1 and 25),
  constraint background_jobs_dead_check
    check (status <> 'dead_letter' or dead_lettered_at is not null)
);

comment on table public.background_jobs is
  'One unit of deferred work, with everything needed to retry it safely.';

create unique index background_jobs_idempotency_key
  on public.background_jobs (job_type, idempotency_key)
  where idempotency_key is not null;

-- The index the worker claims from.
create index background_jobs_ready_idx
  on public.background_jobs (queue_name, priority, run_after)
  where status = 'queued';

create index background_jobs_company_idx
  on public.background_jobs (company_id, created_at desc)
  where company_id is not null;

create index background_jobs_stuck_idx
  on public.background_jobs (reservation_expires_at)
  where status in ('reserved', 'running');

create index background_jobs_dead_idx
  on public.background_jobs (dead_lettered_at desc)
  where status = 'dead_letter';

-- -----------------------------------------------------------------------------
-- Things that run on a timetable
-- -----------------------------------------------------------------------------

create table public.job_schedules (
  id uuid primary key default public.generate_uuid_v7(),
  -- Null for a platform wide schedule, set for work on behalf of one tenant.
  company_id uuid,

  name text not null,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  queue_name text not null default 'default',

  -- Interval scheduling is used rather than cron text, because it is
  -- unambiguous and can be reasoned about in the database.
  interval_minutes integer not null default 60,
  -- Optional wall clock anchor in the timezone of the tenant.
  run_at_time time,
  timezone text not null default 'UTC',

  is_active boolean not null default true,
  last_run_at timestamptz,
  last_status public.job_status,
  next_run_at timestamptz not null default now(),
  run_count integer not null default 0,
  failure_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint job_schedules_name_check
    check (length(btrim(name)) between 2 and 80),
  constraint job_schedules_type_check
    check (job_type ~ '^[a-z][a-z0-9_]{2,60}$'),
  constraint job_schedules_interval_check
    check (interval_minutes between 1 and 43200),
  constraint job_schedules_payload_check
    check (jsonb_typeof(payload) = 'object')
);

comment on table public.job_schedules is
  'Work the platform repeats on a timetable, such as reminders and statements.';

create index job_schedules_due_idx
  on public.job_schedules (next_run_at)
  where is_active and deleted_at is null;

create index job_schedules_company_idx
  on public.job_schedules (company_id)
  where deleted_at is null;

-- The timetable every installation starts with.
insert into public.job_schedules (
  company_id, name, job_type, interval_minutes, queue_name
)
values
  (null, 'Send due reminders', 'send_due_reminders', 15, 'messaging'),
  (null, 'Mark overdue invoices', 'mark_overdue_invoices', 60, 'default'),
  (null, 'Issue recurring invoices', 'issue_recurring_invoices', 60, 'default'),
  (null, 'Collect due subscriptions', 'collect_due_subscriptions', 60, 'billing'),
  (null, 'Retry failed webhooks', 'retry_webhook_deliveries', 5, 'webhooks'),
  (null, 'Expire stale links and sessions', 'expire_stale_records', 60, 'default'),
  (null, 'Tidy the storage register', 'tidy_storage', 1440, 'storage'),
  (null, 'Recount usage against plans', 'recount_usage', 360, 'billing');

comment on column public.job_schedules.interval_minutes is
  'How often the work repeats. Fifteen minutes is the shortest the reminders need.';

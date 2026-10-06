-- supabase/migrations/00082_create_reminder_rules.sql
-- Automatic payment reminders, and the promises clients make.
--
-- Reminders are the single most effective way to get paid faster, and the
-- fastest way to lose a client if they arrive at three in the morning. Every
-- rule is evaluated in the time zone of the tenant and shifted out of quiet
-- hours and off non working days before it is sent.

create table public.reminder_rules (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  name text not null,
  template_key text not null default 'invoice_reminder',

  -- Negative is before the due date, positive is after it, zero is on the day.
  offset_days smallint not null,
  is_active boolean not null default true,

  -- Which documents the rule applies to.
  applies_to_status public.invoice_status[] not null
    default array['sent', 'viewed', 'partially_paid', 'overdue']::public.invoice_status[],
  minimum_balance numeric(18, 4) not null default 0,
  include_estimates boolean not null default false,

  -- Stop conditions, so a client is never chased endlessly.
  max_reminders smallint not null default 4,
  stop_after_days smallint,
  skip_if_promise_to_pay boolean not null default true,

  send_copy_to_owner boolean not null default false,
  display_order smallint not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint reminder_rules_name_check
    check (length(btrim(name)) between 2 and 80),
  constraint reminder_rules_offset_check
    check (offset_days between -90 and 365),
  constraint reminder_rules_balance_check
    check (minimum_balance >= 0),
  constraint reminder_rules_max_check
    check (max_reminders between 1 and 20),
  constraint reminder_rules_stop_check
    check (stop_after_days is null or stop_after_days between 1 and 365)
);

comment on table public.reminder_rules is
  'When a tenant chases an unpaid invoice, and with which wording.';
comment on column public.reminder_rules.offset_days is
  'Days relative to the due date: negative before, zero on the day, positive after.';

create unique index reminder_rules_offset_unique
  on public.reminder_rules (company_id, offset_days, template_key)
  where deleted_at is null;

create index reminder_rules_company_idx
  on public.reminder_rules (company_id)
  where deleted_at is null and is_active;

-- -----------------------------------------------------------------------------
-- Sending window
-- -----------------------------------------------------------------------------

-- One row per tenant describing when it is acceptable to contact a client.
create table public.reminder_settings (
  company_id uuid primary key,

  is_enabled boolean not null default true,
  time_zone text not null default 'UTC',

  -- Nothing leaves before or after these local times.
  quiet_hours_start time not null default '20:00',
  quiet_hours_end time not null default '08:00',
  -- Monday is 1, Sunday is 7.
  sending_weekdays smallint[] not null default array[1, 2, 3, 4, 5]::smallint[],

  -- Due dates that fall on a weekend move to the next working day.
  shift_due_dates_to_business_days boolean not null default false,
  daily_send_limit integer not null default 200,

  statement_day_of_month smallint,
  send_statements boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reminder_settings_weekdays_check
    check (array_length(sending_weekdays, 1) between 1 and 7),
  constraint reminder_settings_limit_check
    check (daily_send_limit between 1 and 10000),
  constraint reminder_settings_statement_day_check
    check (statement_day_of_month is null
           or statement_day_of_month between 1 and 28)
);

comment on table public.reminder_settings is
  'The local hours and days during which a tenant may contact its clients.';

-- -----------------------------------------------------------------------------
-- Scheduled reminders
-- -----------------------------------------------------------------------------

-- The queue of planned reminders. A row is written when an invoice is issued
-- and removed, or cancelled, the moment the invoice is settled.
create table public.invoice_reminders (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  invoice_id uuid not null,
  rule_id uuid,

  scheduled_for timestamptz not null,
  status text not null default 'scheduled',
  attempt_number smallint not null default 1,

  message_id uuid,
  sent_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invoice_reminders_status_check
    check (status in ('scheduled', 'sent', 'cancelled', 'skipped', 'failed')),
  constraint invoice_reminders_attempt_check
    check (attempt_number between 1 and 20)
);

comment on table public.invoice_reminders is
  'Planned reminder sends for one invoice, in the local time of the tenant.';

-- Not a partial index: the planner has to be able to infer it for the upsert
-- that rebuilds a reminder plan.
create unique index invoice_reminders_unique
  on public.invoice_reminders (invoice_id, rule_id, attempt_number);

create index invoice_reminders_due_idx
  on public.invoice_reminders (scheduled_for)
  where status = 'scheduled';

create index invoice_reminders_invoice_idx
  on public.invoice_reminders (invoice_id, scheduled_for);

-- -----------------------------------------------------------------------------
-- Promises to pay
-- -----------------------------------------------------------------------------

-- When a client says they will pay on a date, chasing stops until that date
-- passes. Collections teams live by this, and it keeps the tone right.
create table public.payment_promises (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  invoice_id uuid not null,
  client_id uuid,

  promised_date date not null,
  promised_amount numeric(18, 4),
  note text,
  recorded_by uuid,
  source text not null default 'staff',

  status text not null default 'open',
  resolved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payment_promises_amount_check
    check (promised_amount is null or promised_amount > 0),
  constraint payment_promises_status_check
    check (status in ('open', 'kept', 'broken', 'cancelled')),
  constraint payment_promises_source_check
    check (source in ('staff', 'client_portal', 'email_reply', 'phone'))
);

comment on table public.payment_promises is
  'A date a client committed to pay, which pauses the reminder ladder.';

create index payment_promises_invoice_idx
  on public.payment_promises (invoice_id, promised_date desc);

create index payment_promises_open_idx
  on public.payment_promises (company_id, promised_date)
  where status = 'open';

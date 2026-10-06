-- supabase/migrations/00068_create_usage_metering.sql
-- Usage counters and quota enforcement.
--
-- Counters are kept per company, per metric and per period, so a monthly
-- allowance resets on its own and a lifetime allowance simply never does. A
-- consumer increments the counter through public.consume_usage, which refuses
-- to go past the plan ceiling and returns a sentence the screen can show.

create table public.usage_counters (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  -- For example monthly_invoices, monthly_emails, storage_bytes, team_members.
  metric_key text not null,
  -- 'all' for a lifetime counter, otherwise the month as YYYY-MM.
  period_key text not null default 'all',

  used_quantity bigint not null default 0,
  peak_quantity bigint not null default 0,
  limit_snapshot bigint,

  period_start date,
  period_end date,
  last_incremented_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint usage_counters_metric_check
    check (metric_key ~ '^[a-z][a-z0-9_]{1,40}$'),
  constraint usage_counters_period_check
    check (period_key = 'all' or period_key ~ '^[0-9]{4}-[0-9]{2}$'),
  constraint usage_counters_quantity_check
    check (used_quantity >= 0 and peak_quantity >= 0)
);

comment on table public.usage_counters is
  'How much of each metered allowance a company has used in a period.';

create unique index usage_counters_unique
  on public.usage_counters (company_id, metric_key, period_key);

create index usage_counters_company_idx
  on public.usage_counters (company_id, metric_key);

-- -----------------------------------------------------------------------------
-- Events
-- -----------------------------------------------------------------------------

-- A thin event log behind the counters, so a disputed number can be explained
-- and an overage can be billed with evidence.
create table public.usage_events (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  metric_key text not null,
  quantity bigint not null default 1,
  entity_type text,
  entity_id uuid,
  actor_id uuid,
  detail jsonb not null default '{}'::jsonb,

  occurred_at timestamptz not null default now(),

  constraint usage_events_quantity_check
    check (quantity <> 0),
  constraint usage_events_detail_check
    check (jsonb_typeof(detail) = 'object')
);

comment on table public.usage_events is
  'Individual metered actions, kept so a counter can always be explained.';

create index usage_events_company_idx
  on public.usage_events (company_id, metric_key, occurred_at desc);

create trigger usage_events_append_only
  before update or delete on public.usage_events
  for each row execute function public.block_audit_mutation();

-- Returns the period key a metric is counted in.
create or replace function public.usage_period_key(
  p_metric_key text,
  p_reference date default current_date
)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
           when p_metric_key like 'monthly\_%' then to_char(p_reference, 'YYYY-MM')
           else 'all'
         end;
$$;

comment on function public.usage_period_key(text, date) is
  'Returns the counter period a metric belongs to, monthly or lifetime.';

-- Reports how much of an allowance is left.
create or replace function public.check_usage_limit(
  p_company_id uuid,
  p_metric_key text,
  p_requested bigint default 1
)
returns table (is_allowed boolean, used bigint, allowance bigint, remaining bigint, reason text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit bigint;
  v_used bigint;
  v_period text := public.usage_period_key(p_metric_key);
begin
  v_limit := public.usage_limit(p_company_id, p_metric_key);

  select coalesce(used_quantity, 0)
    into v_used
    from public.usage_counters
   where company_id = p_company_id
     and metric_key = p_metric_key
     and period_key = v_period;

  v_used := coalesce(v_used, 0);

  if v_limit is null then
    return query select true, v_used, null::bigint, null::bigint,
                        'This plan sets no limit on this item';
    return;
  end if;

  if v_used + coalesce(p_requested, 1) > v_limit then
    return query select false, v_used, v_limit, greatest(v_limit - v_used, 0),
                        format('You have used %s of %s on your plan. Upgrade to continue.',
                               v_used, v_limit);
    return;
  end if;

  return query select true, v_used, v_limit, v_limit - v_used,
                      'Within the allowance of this plan';
end;
$$;

comment on function public.check_usage_limit(uuid, text, bigint) is
  'Reports whether an action fits inside the remaining plan allowance.';

-- Records usage and moves the counter, refusing to pass the ceiling.
create or replace function public.consume_usage(
  p_company_id uuid,
  p_metric_key text,
  p_quantity bigint default 1,
  p_entity_type text default null,
  p_entity_id uuid default null
)
returns bigint
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_check record;
  v_period text := public.usage_period_key(p_metric_key);
  v_used bigint;
  v_limit bigint;
begin
  select * into v_check
    from public.check_usage_limit(p_company_id, p_metric_key, p_quantity);

  if not v_check.is_allowed then
    raise exception '%', v_check.reason using errcode = '53400';
  end if;

  v_limit := public.usage_limit(p_company_id, p_metric_key);

  insert into public.usage_counters (
    company_id, metric_key, period_key, used_quantity, peak_quantity,
    limit_snapshot, period_start, period_end, last_incremented_at
  )
  values (
    p_company_id, p_metric_key, v_period, p_quantity, p_quantity, v_limit,
    case when v_period = 'all' then null else to_date(v_period || '-01', 'YYYY-MM-DD') end,
    case when v_period = 'all'
         then null
         else public.end_of_month(to_date(v_period || '-01', 'YYYY-MM-DD'))
    end,
    now()
  )
  on conflict (company_id, metric_key, period_key) do update
     set used_quantity = public.usage_counters.used_quantity + excluded.used_quantity,
         peak_quantity = greatest(
           public.usage_counters.peak_quantity,
           public.usage_counters.used_quantity + excluded.used_quantity
         ),
         limit_snapshot = excluded.limit_snapshot,
         last_incremented_at = now(),
         updated_at = now()
  returning used_quantity into v_used;

  insert into public.usage_events (
    company_id, metric_key, quantity, entity_type, entity_id, actor_id
  )
  values (
    p_company_id, p_metric_key, p_quantity, p_entity_type, p_entity_id,
    public.current_user_id()
  );

  return v_used;
end;
$$;

comment on function public.consume_usage(uuid, text, bigint, text, uuid) is
  'Increments a usage counter after checking it against the plan allowance.';

-- Returns a counter to a lower value, used when a metered record is deleted.
create or replace function public.release_usage(
  p_company_id uuid,
  p_metric_key text,
  p_quantity bigint default 1
)
returns bigint
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_period text := public.usage_period_key(p_metric_key);
  v_used bigint;
begin
  update public.usage_counters
     set used_quantity = greatest(used_quantity - p_quantity, 0),
         updated_at = now()
   where company_id = p_company_id
     and metric_key = p_metric_key
     and period_key = v_period
  returning used_quantity into v_used;

  if v_used is null then
    return 0;
  end if;

  insert into public.usage_events (company_id, metric_key, quantity, actor_id)
  values (p_company_id, p_metric_key, -p_quantity, public.current_user_id());

  return v_used;
end;
$$;

comment on function public.release_usage(uuid, text, bigint) is
  'Lowers a usage counter when the record that consumed it is removed.';

-- Keeps the storage counter aligned with what the company actually stores.
create or replace function public.sync_storage_usage(p_company_id uuid)
returns bigint
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_used bigint;
begin
  select storage_used_bytes into v_used from public.companies where id = p_company_id;

  insert into public.usage_counters (
    company_id, metric_key, period_key, used_quantity, limit_snapshot, last_incremented_at
  )
  values (
    p_company_id, 'storage_bytes', 'all', coalesce(v_used, 0),
    public.usage_limit(p_company_id, 'storage_bytes'), now()
  )
  on conflict (company_id, metric_key, period_key) do update
     set used_quantity = excluded.used_quantity,
         limit_snapshot = excluded.limit_snapshot,
         updated_at = now();

  return coalesce(v_used, 0);
end;
$$;

comment on function public.sync_storage_usage(uuid) is
  'Copies the stored byte count of a company into its usage counter.';

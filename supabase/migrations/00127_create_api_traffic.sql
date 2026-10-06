-- supabase/migrations/00127_create_api_traffic.sql
-- Throttling and the request log behind it.
--
-- Rate limiting is done with fixed windows counted in the database so that
-- every instance of the application agrees, and so the numbers the headers
-- report are the numbers that were actually enforced.

create table public.rate_limit_counters (
  id uuid primary key default public.generate_uuid_v7(),

  -- What is being limited: an API key, an IP address, a tenant, an endpoint.
  bucket_kind text not null,
  bucket_key text not null,
  window_started_at timestamptz not null,
  window_seconds integer not null default 60,

  request_count integer not null default 0,
  limit_value integer not null,
  blocked_count integer not null default 0,
  last_request_at timestamptz not null default now(),

  created_at timestamptz not null default now(),

  constraint rate_limit_counters_kind_check
    check (bucket_kind in ('api_key', 'ip', 'company', 'endpoint', 'user',
                           'token_link', 'login')),
  constraint rate_limit_counters_key_check
    check (length(btrim(bucket_key)) between 1 and 200),
  constraint rate_limit_counters_window_check
    check (window_seconds in (1, 10, 60, 300, 3600, 86400)),
  constraint rate_limit_counters_count_check
    check (request_count >= 0 and blocked_count >= 0 and limit_value > 0)
);

comment on table public.rate_limit_counters is
  'One fixed window of request counting for one thing being throttled.';

create unique index rate_limit_counters_window_key
  on public.rate_limit_counters
     (bucket_kind, bucket_key, window_seconds, window_started_at);

create index rate_limit_counters_sweep_idx
  on public.rate_limit_counters (window_started_at);

-- -----------------------------------------------------------------------------
-- The request log
-- -----------------------------------------------------------------------------

create table public.api_request_logs (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,
  api_key_id uuid,

  method text not null,
  path text not null,
  route_pattern text,
  query_string text,

  status_code smallint not null,
  duration_ms integer not null default 0,
  request_bytes integer not null default 0,
  response_bytes integer not null default 0,

  ip_hash text,
  user_agent text,
  -- Carried through from the client so a support conversation can find the
  -- exact request.
  request_id text,
  idempotency_key text,

  error_code text,
  error_message text,
  was_rate_limited boolean not null default false,

  created_at timestamptz not null default now(),

  constraint api_request_logs_method_check
    check (method in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD',
                      'OPTIONS')),
  constraint api_request_logs_path_check
    check (length(btrim(path)) between 1 and 400),
  constraint api_request_logs_status_check
    check (status_code between 100 and 599),
  constraint api_request_logs_duration_check
    check (duration_ms >= 0 and request_bytes >= 0 and response_bytes >= 0),
  constraint api_request_logs_ip_check
    check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$')
);

comment on table public.api_request_logs is
  'One line per API request, for support, billing and abuse investigation.';

create index api_request_logs_company_idx
  on public.api_request_logs (company_id, created_at desc);

create index api_request_logs_key_idx
  on public.api_request_logs (api_key_id, created_at desc)
  where api_key_id is not null;

create index api_request_logs_errors_idx
  on public.api_request_logs (created_at desc)
  where status_code >= 400;

create unique index api_request_logs_idempotency_key
  on public.api_request_logs (api_key_id, idempotency_key)
  where idempotency_key is not null;

-- -----------------------------------------------------------------------------
-- Counting a request
-- -----------------------------------------------------------------------------

-- Counts one request against a bucket and says whether it is allowed. The
-- answer carries the numbers the response headers have to report.
create or replace function public.consume_rate_limit(
  p_bucket_kind text,
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer default 60
)
returns table (
  is_allowed boolean,
  limit_value integer,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_start timestamptz;
  v_count integer;
  v_limit integer := greatest(coalesce(p_limit, 60), 1);
  v_seconds integer := coalesce(p_window_seconds, 60);
begin
  -- Fixed windows: the start is the request time rounded down to the window.
  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / v_seconds) * v_seconds
  );

  insert into public.rate_limit_counters (
    bucket_kind, bucket_key, window_started_at, window_seconds, request_count,
    limit_value
  )
  values (p_bucket_kind, p_bucket_key, v_window_start, v_seconds, 1, v_limit)
  on conflict (bucket_kind, bucket_key, window_seconds, window_started_at)
  do update set request_count = public.rate_limit_counters.request_count + 1,
                last_request_at = now(),
                limit_value = excluded.limit_value
  returning request_count into v_count;

  if v_count > v_limit then
    update public.rate_limit_counters
       set blocked_count = blocked_count + 1
     where bucket_kind = p_bucket_kind
       and bucket_key = p_bucket_key
       and window_seconds = v_seconds
       and window_started_at = v_window_start;
  end if;

  return query
  select v_count <= v_limit,
         v_limit,
         greatest(v_limit - v_count, 0),
         v_window_start + make_interval(secs => v_seconds);
end;
$$;

comment on function public.consume_rate_limit(text, text, integer, integer) is
  'Counts one request against a window and reports whether it is allowed.';

-- Reads a bucket without counting against it, for a pre flight check.
create or replace function public.rate_limit_status(
  p_bucket_kind text,
  p_bucket_key text,
  p_window_seconds integer default 60
)
returns table (
  request_count integer,
  limit_value integer,
  remaining integer,
  reset_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.request_count,
         c.limit_value,
         greatest(c.limit_value - c.request_count, 0),
         c.window_started_at + make_interval(secs => c.window_seconds)
    from public.rate_limit_counters as c
   where c.bucket_kind = p_bucket_kind
     and c.bucket_key = p_bucket_key
     and c.window_seconds = coalesce(p_window_seconds, 60)
   order by c.window_started_at desc
   limit 1;
$$;

comment on function public.rate_limit_status(text, text, integer) is
  'Reports the state of a throttling window without counting a request.';

-- Old windows are noise. The sweeper runs on a schedule.
create or replace function public.prune_rate_limit_counters(
  p_older_than_hours integer default 48
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
  delete from public.rate_limit_counters
   where window_started_at
         < now() - make_interval(hours => greatest(coalesce(p_older_than_hours, 48), 1));

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

comment on function public.prune_rate_limit_counters(integer) is
  'Deletes throttling windows that have long since closed.';

-- Writes the log line for one request.
create or replace function public.record_api_request(
  p_company_id uuid,
  p_api_key_id uuid,
  p_method text,
  p_path text,
  p_status_code smallint,
  p_duration_ms integer,
  p_route_pattern text default null,
  p_request_id text default null,
  p_idempotency_key text default null,
  p_ip_hash text default null,
  p_error_code text default null,
  p_was_rate_limited boolean default false
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_log_id uuid;
begin
  insert into public.api_request_logs (
    company_id, api_key_id, method, path, route_pattern, status_code,
    duration_ms, request_id, idempotency_key, ip_hash, error_code,
    was_rate_limited
  )
  values (
    p_company_id, p_api_key_id, upper(p_method), p_path, p_route_pattern,
    p_status_code, greatest(coalesce(p_duration_ms, 0), 0), p_request_id,
    p_idempotency_key, p_ip_hash, p_error_code, coalesce(p_was_rate_limited, false)
  )
  on conflict do nothing
  returning id into v_log_id;

  if p_api_key_id is not null then
    perform public.touch_api_key(p_api_key_id, p_ip_hash);
  end if;

  return v_log_id;
end;
$$;

comment on function public.record_api_request(
  uuid, uuid, text, text, smallint, integer, text, text, text, text, text,
  boolean
) is 'Writes the log line for one API request and marks the key as used.';

-- What the API did for one tenant over a period.
create or replace function public.api_usage_summary(
  p_company_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  route_pattern text,
  request_count integer,
  error_count integer,
  rate_limited_count integer,
  average_duration_ms numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(l.route_pattern, l.path),
         count(*)::integer,
         (count(*) filter (where l.status_code >= 400))::integer,
         (count(*) filter (where l.was_rate_limited))::integer,
         round(avg(l.duration_ms), 1)
    from public.api_request_logs as l
   where l.company_id = p_company_id
     and l.created_at between p_from and p_to
   group by coalesce(l.route_pattern, l.path)
   order by count(*) desc;
$$;

comment on function public.api_usage_summary(uuid, timestamptz, timestamptz) is
  'Summarises API traffic of a tenant by route over a period.';

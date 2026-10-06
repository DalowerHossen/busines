-- A database-backed, atomic rate-limit bucket for authentication, payment,
-- API, and anti-scraping policies. The bucket key is a server-generated hash,
-- not a raw IP address or account identifier.

create table public.security_rate_limit_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint security_rate_limit_buckets_key_not_blank check (length(btrim(bucket_key)) > 0),
  constraint security_rate_limit_buckets_request_count_non_negative check (request_count >= 0),
  constraint security_rate_limit_buckets_expiry_after_start check (expires_at >= window_started_at)
);

create index security_rate_limit_buckets_expires_at_idx
  on public.security_rate_limit_buckets (expires_at);

comment on table public.security_rate_limit_buckets is
  'Atomic server-side rate-limit buckets keyed by a hashed route, method, identity, and request pattern.';

create or replace function public.consume_security_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_bucket public.security_rate_limit_buckets%rowtype;
  current_time timestamptz := now();
  next_expiry timestamptz;
begin
  if p_bucket_key is null or length(btrim(p_bucket_key)) = 0
     or p_limit < 1 or p_limit > 100000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid security rate-limit parameters.' using errcode = '22023';
  end if;

  next_expiry := current_time + make_interval(secs => p_window_seconds);

  insert into public.security_rate_limit_buckets (
    bucket_key,
    window_started_at,
    request_count,
    expires_at
  ) values (
    p_bucket_key,
    current_time,
    0,
    next_expiry
  ) on conflict (bucket_key) do nothing;

  select *
    into current_bucket
    from public.security_rate_limit_buckets
   where bucket_key = p_bucket_key
   for update;

  if current_bucket.expires_at <= current_time then
    update public.security_rate_limit_buckets
       set window_started_at = current_time,
           request_count = 1,
           expires_at = next_expiry
     where bucket_key = p_bucket_key;
    return query select true, greatest(p_limit - 1, 0), next_expiry;
    return;
  end if;

  if current_bucket.request_count >= p_limit then
    return query select false, 0, current_bucket.expires_at;
    return;
  end if;

  update public.security_rate_limit_buckets
     set request_count = request_count + 1
   where bucket_key = p_bucket_key;

  return query select true, greatest(p_limit - current_bucket.request_count - 1, 0), current_bucket.expires_at;
end;
$$;

revoke all on public.security_rate_limit_buckets from anon, authenticated;
revoke all on function public.consume_security_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_security_rate_limit(text, integer, integer) to service_role;

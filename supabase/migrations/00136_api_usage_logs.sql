-- supabase/migrations/00136_api_usage_logs.sql
-- Append-only API usage records for quota, audit, and developer analytics.

create table public.api_usage_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  api_key_id uuid null references public.api_keys (id),
  request_id text null,
  method text not null,
  path text not null,
  status_code integer not null,
  response_time_ms integer null,
  ip_hash text null,
  user_agent_hash text null,
  error_code text null,
  created_at timestamptz not null default now(),
  constraint api_usage_logs_method_not_blank check (length(btrim(method)) > 0),
  constraint api_usage_logs_path_not_blank check (length(btrim(path)) > 0),
  constraint api_usage_logs_status_code_valid check (status_code between 100 and 599),
  constraint api_usage_logs_response_time_valid check (
    response_time_ms is null or response_time_ms >= 0
  )
);

create index api_usage_logs_company_time_idx
  on public.api_usage_logs (company_id, created_at desc);
create index api_usage_logs_api_key_time_idx
  on public.api_usage_logs (api_key_id, created_at desc)
  where api_key_id is not null;
create index api_usage_logs_status_idx
  on public.api_usage_logs (company_id, status_code, created_at desc);

comment on table public.api_usage_logs is
  'Append-only public API request log used for quota and developer-facing usage analytics.';

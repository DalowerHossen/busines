-- supabase/migrations/00011_user_sessions.sql
-- Application-level session enrichment. This does NOT replace or duplicate
-- Supabase Auth's own session/refresh-token storage; it records metadata
-- Supabase Auth does not expose, so the product can show a "where you're
-- logged in" security dashboard, flag suspicious logins, and remember which
-- company a user last worked in when they belong to more than one.

create table public.user_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users (id),
  ip_address inet null,
  user_agent text null,
  device_label text null,
  active_company_id uuid null references public.companies (id),
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz null
);

create index user_sessions_user_id_idx on public.user_sessions (user_id);
create index user_sessions_active_idx on public.user_sessions (user_id) where revoked_at is null;

comment on table public.user_sessions is
  'Session metadata (IP, user agent, active company) enriching Supabase Auth sessions. Powers the security dashboard and suspicious-login alerts.';

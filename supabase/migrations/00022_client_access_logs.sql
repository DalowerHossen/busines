-- supabase/migrations/00022_client_access_logs.sql
-- The view/access audit log for a client_access_token (T1.7, T1.8),
-- capturing IP and user agent for anti-fraud purposes. This table is
-- append-only: no updated_at, no soft delete, rows are never edited or
-- removed once written. The richer consent/delivery/dispute-evidence
-- chain (signed checkbox text, versioned terms snapshot, tamper-proof
-- hash chain) is a separate system added in Phase 9 (V1-V6); this table
-- only records that a link was opened, by whom, from where.

create table public.client_access_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  token_id uuid not null references public.client_access_tokens (id),
  ip_address inet null,
  user_agent text null,
  viewed_at timestamptz not null default now()
);

create index client_access_logs_token_id_idx on public.client_access_logs (token_id);
create index client_access_logs_company_id_idx on public.client_access_logs (company_id);
create index client_access_logs_viewed_at_idx on public.client_access_logs (viewed_at);

comment on table public.client_access_logs is
  'Append-only view/access audit log for a client_access_token. Never updated or deleted once written.';

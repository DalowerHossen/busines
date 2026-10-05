-- supabase/migrations/00013_client_groups.sql
-- A named grouping a client can belong to (at most one at a time), for
-- example "Wholesale" or "VIP". Created before `clients` because
-- clients.group_id references this table.
--
-- Row Level Security is intentionally NOT enabled yet (deferred to Phase
-- 17-18). No generic updated_at trigger yet either (deferred to Phase 19).

create table public.client_groups (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name text not null,
  color text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index client_groups_company_id_idx on public.client_groups (company_id) where deleted_at is null;

comment on table public.client_groups is
  'A named client grouping (e.g. Wholesale, VIP). A client belongs to at most one group at a time.';

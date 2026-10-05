-- supabase/migrations/00004_companies.sql
-- The tenant (company) record. Every business-data table added in later
-- phases carries a company_id foreign key to this table and must be
-- queried with that scope, per the project's strict tenant-isolation rule.

create table public.companies (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid not null references public.users (id),
  name text not null,
  slug citext not null,
  kyc_status kyc_status not null default 'not_started',
  is_suspended boolean not null default false,
  suspended_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index companies_slug_key on public.companies (slug) where deleted_at is null;
create index companies_owner_user_id_idx on public.companies (owner_user_id);
create index companies_deleted_at_idx on public.companies (deleted_at) where deleted_at is null;

comment on table public.companies is
  'One row per tenant. Every business-data table is scoped to a company_id referencing this table.';
comment on column public.companies.is_suspended is
  'Set by a super_admin. A suspended company keeps its data (never deleted) but loses write/send access until reinstated.';

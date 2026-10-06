-- supabase/migrations/00115_accountant_company_access.sql
-- An accountant may access multiple companies through this join table;
-- unlike company_memberships, access is not limited to one tenant.

create table public.accountant_company_access (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  accountant_user_id uuid not null references public.users (id),
  invited_by_user_id uuid not null references public.users (id),
  is_active boolean not null default true,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint accountant_company_access_dates_valid check (
    revoked_at is null or revoked_at >= invited_at
  )
);

create unique index accountant_company_access_company_user_key
  on public.accountant_company_access (company_id, accountant_user_id)
  where deleted_at is null;
create index accountant_company_access_accountant_idx
  on public.accountant_company_access (accountant_user_id, is_active)
  where deleted_at is null;
create index accountant_company_access_company_idx
  on public.accountant_company_access (company_id, is_active)
  where deleted_at is null;

comment on table public.accountant_company_access is
  'A multi-company access grant for an accountant. RLS later limits every query to an active grant.';

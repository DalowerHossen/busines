-- supabase/migrations/00005_company_memberships.sql
-- Links a user to a company with exactly one company-scoped role. The
-- `owner` role is also denormalized onto companies.owner_user_id for fast
-- lookups, but a matching membership row is still created so the owner
-- appears in team listings alongside staff and affiliates.
--
-- `accountant` is deliberately excluded from this table: an accountant can
-- be linked to several companies at once, which this single-company-per-row
-- shape cannot represent. Accountant access is modeled by
-- accountant_company_access, added in Phase 15.

create table public.company_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  user_id uuid not null references public.users (id),
  role account_role not null,
  -- Validated against the StaffPermission union (src/types/auth.ts) at the
  -- application layer. Empty for every role except 'staff'.
  permissions text[] not null default '{}',
  invited_by_user_id uuid null references public.users (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint company_memberships_role_valid check (role in ('owner', 'staff', 'affiliate'))
);

create unique index company_memberships_company_user_key
  on public.company_memberships (company_id, user_id)
  where deleted_at is null;
create index company_memberships_company_id_idx on public.company_memberships (company_id);
create index company_memberships_user_id_idx on public.company_memberships (user_id);
create index company_memberships_deleted_at_idx
  on public.company_memberships (deleted_at)
  where deleted_at is null;

comment on table public.company_memberships is
  'One row per (company, user) with the owner/staff/affiliate role that user holds in that company.';
comment on column public.company_memberships.permissions is
  'Fine-grained staff permission keys (e.g. manage_invoices, request_send_client_email). Never grants send_client_email directly to staff.';

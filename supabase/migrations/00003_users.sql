-- supabase/migrations/00003_users.sql
-- Application-level user profile, one row per Supabase Auth user. This
-- table only stores profile and platform-role data; credentials,
-- passwords, and session tokens remain entirely inside Supabase Auth's own
-- `auth.users` table and are never duplicated here.
--
-- Row Level Security is intentionally NOT enabled yet in this migration.
-- Policies are added for every table in Phase 17-18 (DB Hardening); until
-- then, access is only through the service-role key from trusted server
-- code. The `updated_at` auto-touch trigger is added in Phase 19 alongside
-- every other trigger; for now the column simply defaults to `now()`.

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext not null,
  full_name text not null,
  avatar_provider_file_id text null,
  -- Null for every company-scoped role (owner/staff/accountant/affiliate).
  -- Only 'super_admin' or 'reseller' are ever stored here; company-scoped
  -- roles live on company_memberships.role instead.
  platform_role account_role null,
  is_email_verified boolean not null default false,
  is_two_factor_enabled boolean not null default false,
  preferred_two_factor_method two_factor_method null,
  last_login_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint users_platform_role_valid check (
    platform_role is null or platform_role in ('super_admin', 'reseller')
  )
);

create unique index users_email_key on public.users (email) where deleted_at is null;
create index users_platform_role_idx on public.users (platform_role) where platform_role is not null;
create index users_deleted_at_idx on public.users (deleted_at) where deleted_at is null;

comment on table public.users is
  'One row per Supabase Auth user. Credentials stay in auth.users; this table only holds profile and platform-role data.';

-- Automatically creates the matching public.users row the moment someone
-- signs up through Supabase Auth, so the rest of the schema can always
-- join against public.users without a manual provisioning step.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, is_email_verified)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email_confirmed_at is not null
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

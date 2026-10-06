-- supabase/migrations/00021_install_identity_triggers.sql
-- Installs the standard trigger set and the audit trail on the identity tables.
--
-- Standard set: updated_at maintenance, created_by and updated_by stamping,
-- hard delete protection and immutability of soft deleted rows.
-- Tables without a deleted_at column receive timestamp maintenance only.

-- Tables that carry the full audit column set.
select public.install_standard_triggers('companies');
select public.install_standard_triggers('users');
select public.install_standard_triggers('resellers');
select public.install_standard_triggers('company_profiles');
select public.install_standard_triggers('accountant_company_access');
select public.install_standard_triggers('team_invitations');

-- Security tables keep a rolling record rather than a soft deleted history,
-- so only the timestamp trigger applies.
select public.install_timestamp_trigger('user_two_factor');

-- Every privileged change is written to the tamper evident trail.
select public.install_audit_trigger('companies');
select public.install_audit_trigger('users');
select public.install_audit_trigger('resellers');
select public.install_audit_trigger('company_profiles');
select public.install_audit_trigger('accountant_company_access');
select public.install_audit_trigger('team_invitations');

-- Keeps the company count on a reseller accurate without an extra query in the
-- application layer.
create or replace function public.sync_reseller_tenant_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_reseller uuid;
  v_new_reseller uuid;
begin
  if tg_op = 'UPDATE' then
    v_old_reseller := old.reseller_id;
  end if;

  v_new_reseller := new.reseller_id;

  if v_old_reseller is not null and v_old_reseller is distinct from v_new_reseller then
    update public.resellers r
       set sub_tenant_count = (
             select count(*)
               from public.companies c
              where c.reseller_id = r.id
                and c.deleted_at is null
           )
     where r.id = v_old_reseller;
  end if;

  if v_new_reseller is not null then
    update public.resellers r
       set sub_tenant_count = (
             select count(*)
               from public.companies c
              where c.reseller_id = r.id
                and c.deleted_at is null
           )
     where r.id = v_new_reseller;
  end if;

  return new;
end;
$$;

comment on function public.sync_reseller_tenant_count() is
  'Keeps resellers.sub_tenant_count aligned with the companies assigned to it.';

create trigger companies_sync_reseller_count
  after insert or update of reseller_id, deleted_at on public.companies
  for each row execute function public.sync_reseller_tenant_count();

-- A company must always keep exactly one usable profile row, so the profile is
-- created as soon as the company exists.
create or replace function public.create_default_company_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
      from public.company_profiles
     where company_id = new.id
       and deleted_at is null
  ) then
    return new;
  end if;

  insert into public.company_profiles (
    company_id, legal_name, trade_name, country_code, created_by, updated_by
  )
  values (
    new.id, new.legal_name, new.display_name, new.country_code,
    new.created_by, new.updated_by
  );

  return new;
end;
$$;

comment on function public.create_default_company_profile() is
  'Creates the document profile that belongs to a newly registered company.';

create trigger companies_create_default_profile
  after insert on public.companies
  for each row execute function public.create_default_company_profile();

-- An invitation that has passed its expiry date is no longer usable, whatever
-- the stored status says.
create or replace function public.expire_stale_invitations()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.team_invitations
     set status = 'expired',
         updated_at = now()
   where status = 'pending'
     and deleted_at is null
     and expires_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.expire_stale_invitations() is
  'Marks every pending invitation whose expiry date has passed as expired.';

-- Mirrors the same rule for accountant grants.
create or replace function public.expire_stale_access_grants()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.accountant_company_access
     set status = 'expired',
         updated_at = now()
   where status = 'active'
     and deleted_at is null
     and expires_at is not null
     and expires_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.expire_stale_access_grants() is
  'Marks every accountant grant whose expiry date has passed as expired.';

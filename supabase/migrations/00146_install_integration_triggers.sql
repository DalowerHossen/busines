-- supabase/migrations/00146_install_integration_triggers.sql
-- Timestamps, audit trail and the rules that keep the credential vault safe.

select public.install_standard_triggers('integration_credentials');
select public.install_timestamp_trigger('integration_providers');

-- Changing who the platform is connected to, with which key, is one of the
-- most consequential things anybody can do here, so every change is recorded
-- with the actor. The audit writer redacts secret looking values on the way in.
select public.install_audit_trigger('integration_credentials');
select public.install_audit_trigger('integration_providers');

-- -----------------------------------------------------------------------------
-- Nothing about a credential changes quietly
-- -----------------------------------------------------------------------------

-- Moves the configuration counter and the per row version on every write, so
-- a running instance notices a new key within seconds instead of at restart.
create or replace function public.stamp_integration_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    new.config_version := old.config_version + 1;
  end if;

  perform public.bump_integration_revision();

  return new;
end;
$$;

comment on function public.stamp_integration_change() is
  'Advances the credential version and the global revision on every change.';

create trigger integration_credentials_30_stamp_change
  before insert or update on public.integration_credentials
  for each row execute function public.stamp_integration_change();

-- -----------------------------------------------------------------------------
-- A credential stays where it was put
-- -----------------------------------------------------------------------------

-- Moving a credential between tenants, or between providers, would hand one
-- tenant another tenant's key. It is never a legitimate edit.
create or replace function public.guard_credential_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.company_id is distinct from old.company_id then
    raise exception 'A credential cannot be moved to another tenant'
      using errcode = '42501';
  end if;

  if new.provider_key is distinct from old.provider_key then
    raise exception 'A credential cannot be moved to another provider'
      using errcode = '42501';
  end if;

  if new.environment is distinct from old.environment then
    raise exception 'A credential cannot change between live and test'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_credential_identity() is
  'Stops a saved credential from changing tenant, provider or environment.';

create trigger integration_credentials_20_guard_identity
  before update on public.integration_credentials
  for each row execute function public.guard_credential_identity();

-- -----------------------------------------------------------------------------
-- A masked hint is a hint, not a secret
-- -----------------------------------------------------------------------------

-- The interface shows these values in plain sight, so anything long enough to
-- be a usable key is refused outright rather than displayed.
create or replace function public.guard_masked_hints()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_entry record;
begin
  for v_entry in
    select key, value
      from jsonb_each_text(coalesce(new.masked_hints, '{}'::jsonb))
  loop
    if length(coalesce(v_entry.value, '')) > 12 then
      raise exception
        'The hint for % is long enough to be the secret itself', v_entry.key
        using errcode = '22023';
    end if;
  end loop;

  return new;
end;
$$;

comment on function public.guard_masked_hints() is
  'Refuses a masked hint that is long enough to be a usable secret.';

create trigger integration_credentials_25_guard_hints
  before insert or update on public.integration_credentials
  for each row execute function public.guard_masked_hints();

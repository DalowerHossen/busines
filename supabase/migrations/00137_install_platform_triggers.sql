-- supabase/migrations/00137_install_platform_triggers.sql
-- Timestamps, audit trails and the guards that keep platform operations honest.

select public.install_standard_triggers('api_keys');
select public.install_standard_triggers('webhook_endpoints');

-- An approval request records who asked and who decided rather than a generic
-- author, so it takes the timestamp and soft delete guards without the actor
-- stamping.
select public.install_timestamp_trigger('approval_requests');
select public.install_soft_delete_guard('approval_requests');

select public.install_timestamp_trigger('background_jobs');
select public.install_timestamp_trigger('job_schedules');
select public.install_timestamp_trigger('webhook_deliveries');
select public.install_timestamp_trigger('platform_settings');
select public.install_timestamp_trigger('feature_flags');
select public.install_timestamp_trigger('tenant_security_policies');

-- Changing a key, an endpoint, a setting or a security rule is exactly the
-- kind of thing an auditor asks about, so each one is written down.
select public.install_audit_trigger('api_keys');
select public.install_audit_trigger('webhook_endpoints');
select public.install_audit_trigger('platform_settings');
select public.install_audit_trigger('feature_flags');
select public.install_audit_trigger('tenant_security_policies');
select public.install_audit_trigger('approval_requests');

create trigger approval_requests_05_number
  before insert on public.approval_requests
  for each row execute function public.assign_approval_number();

-- -----------------------------------------------------------------------------
-- An API key digest never changes
-- -----------------------------------------------------------------------------

-- A key is rotated by issuing a new digest through the rotation routine, which
-- keeps the old one working for its grace period. Editing the digest in place
-- would quietly break that promise.
create or replace function public.guard_api_key_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.company_id is distinct from old.company_id then
    raise exception 'An API key cannot be moved to another company'
      using errcode = '42501';
  end if;

  if new.environment is distinct from old.environment then
    raise exception 'An API key cannot change between live and test'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_api_key_identity() is
  'Stops an API key from changing tenant or environment after it is issued.';

create trigger api_keys_20_guard_identity
  before update on public.api_keys
  for each row execute function public.guard_api_key_identity();

-- -----------------------------------------------------------------------------
-- A delivered event is history
-- -----------------------------------------------------------------------------

-- The payload a tenant was sent has to stay exactly as it was sent, otherwise
-- a signature dispute cannot be settled.
create or replace function public.guard_outbound_event_payload()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.payload is distinct from old.payload
     or new.event_type is distinct from old.event_type
     or new.company_id is distinct from old.company_id then
    raise exception 'A published event payload cannot be rewritten'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_outbound_event_payload() is
  'Keeps a published webhook event exactly as it was published.';

create trigger outbound_events_20_guard_payload
  before update on public.outbound_events
  for each row execute function public.guard_outbound_event_payload();

-- -----------------------------------------------------------------------------
-- Keeping a tenant security policy sane
-- -----------------------------------------------------------------------------

-- Turning on an address restriction from a machine that is not on the list is
-- the fastest way for an owner to lock themselves out, so the rule is that the
-- allowed list has to be filled in first. The check constraint covers the empty
-- list; this covers the softer case of a policy that contradicts itself.
create or replace function public.guard_security_policy()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.require_two_factor and not new.require_two_factor_for_owner then
    raise exception
      'Two factor cannot be required of the team but not of the owner'
      using errcode = '22023';
  end if;

  if new.staff_daily_cap is not null
     and new.staff_single_action_cap is not null
     and new.staff_single_action_cap > new.staff_daily_cap then
    raise exception 'A single action cap cannot be larger than the daily cap'
      using errcode = '22023';
  end if;

  if new.auto_delete_after_retention and new.data_retention_months is null then
    raise exception
      'Automatic deletion needs a retention period to count from'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

comment on function public.guard_security_policy() is
  'Rejects a tenant security policy that contradicts itself.';

create trigger tenant_security_policies_20_guard
  before insert or update on public.tenant_security_policies
  for each row execute function public.guard_security_policy();

-- -----------------------------------------------------------------------------
-- A finished job keeps its outcome
-- -----------------------------------------------------------------------------

create or replace function public.guard_finished_job()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status in ('succeeded', 'cancelled')
     and new.status is distinct from old.status then
    raise exception 'A finished job cannot be moved back into the queue'
      using errcode = '42501';
  end if;

  if new.job_type is distinct from old.job_type then
    raise exception 'A queued job cannot change what it does'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_finished_job() is
  'Stops a job that already finished from being quietly restarted.';

create trigger background_jobs_20_guard_finished
  before update on public.background_jobs
  for each row execute function public.guard_finished_job();

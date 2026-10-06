-- supabase/migrations/00123_install_storage_triggers.sql
-- Timestamps, audit trails and the rules that keep files and contracts
-- trustworthy.

select public.install_standard_triggers('storage_targets');
select public.install_standard_triggers('files');
select public.install_standard_triggers('contracts');
select public.install_standard_triggers('contract_templates');

select public.install_timestamp_trigger('upload_sessions');
select public.install_timestamp_trigger('storage_quotas');
select public.install_timestamp_trigger('contract_signers');

select public.install_audit_trigger('storage_targets');
select public.install_audit_trigger('files');
select public.install_audit_trigger('contracts');

create trigger contracts_05_number
  before insert on public.contracts
  for each row execute function public.assign_contract_number();

-- -----------------------------------------------------------------------------
-- Storage accounting
-- -----------------------------------------------------------------------------

-- Keeps the quota row in step whenever the register changes.
create or replace function public.refresh_storage_quota_from_file()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := coalesce(new.company_id, old.company_id);
begin
  if v_company_id is not null then
    perform public.recalculate_storage_usage(v_company_id);
  end if;

  return null;
end;
$$;

comment on function public.refresh_storage_quota_from_file() is
  'Recounts the storage of a tenant after a file is added, changed or removed.';

create trigger files_90_quota
  after insert or update of byte_size, deleted_at, purged_at, storage_tier
  or delete on public.files
  for each row execute function public.refresh_storage_quota_from_file();

-- A stored object is identified by its key, and the key is part of the
-- evidence trail. It is written once.
create or replace function public.guard_file_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.storage_key is distinct from old.storage_key then
    raise exception 'The storage key of a file cannot be changed'
      using errcode = '42501';
  end if;

  if old.content_hash is not null
     and new.content_hash is distinct from old.content_hash then
    raise exception 'The content digest of a file cannot be changed'
      using errcode = '42501';
  end if;

  if old.purged_at is not null and new.purged_at is null then
    raise exception 'A deleted object cannot be brought back'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_file_identity() is
  'Keeps the key and the digest of a stored file unchanged.';

create trigger files_10_identity_guard
  before update on public.files
  for each row execute function public.guard_file_identity();

-- -----------------------------------------------------------------------------
-- Contract rules
-- -----------------------------------------------------------------------------

-- Once a contract has been sent, the wording is what the signers saw.
create or replace function public.guard_sent_contract()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status <> 'draft'
     and (new.body_html is distinct from old.body_html
          or new.content_hash is distinct from old.content_hash
          or new.contract_number is distinct from old.contract_number
          or new.company_id is distinct from old.company_id) then
    raise exception 'The wording of a sent contract cannot be changed. Void it and send a new one.'
      using errcode = '42501';
  end if;

  if old.status = 'completed'
     and new.status not in ('completed', 'voided')
     and new.status is distinct from old.status then
    raise exception 'A signed contract cannot be reopened' using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_sent_contract() is
  'Freezes the wording of a contract from the moment it is sent.';

create trigger contracts_10_sent_guard
  before update on public.contracts
  for each row execute function public.guard_sent_contract();

-- A signature and the evidence around it are permanent.
create or replace function public.guard_signed_signer()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status = 'signed'
     and (new.signed_at is distinct from old.signed_at
          or new.signature_hash is distinct from old.signature_hash
          or new.typed_signature is distinct from old.typed_signature
          or new.email is distinct from old.email
          or new.full_name is distinct from old.full_name
          or new.consent_given_at is distinct from old.consent_given_at
          or new.status <> 'signed') then
    raise exception 'A signature cannot be altered once it has been given'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_signed_signer() is
  'Keeps a given signature and its consent record unchanged.';

create trigger contract_signers_10_signed_guard
  before update on public.contract_signers
  for each row execute function public.guard_signed_signer();

-- The trail is append only, because a trail that can be edited proves
-- nothing.
create or replace function public.guard_contract_event()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'The contract trail is a permanent record'
    using errcode = '42501';
end;
$$;

comment on function public.guard_contract_event() is
  'Blocks edits and deletions of the contract trail.';

create trigger contract_events_10_append_only
  before update or delete on public.contract_events
  for each row execute function public.guard_contract_event();

-- Keeps the signer count on the contract honest as people are added.
create or replace function public.refresh_contract_signer_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract_id uuid := coalesce(new.contract_id, old.contract_id);
begin
  update public.contracts as c
     set signer_count = counts.signer_count,
         signed_count = counts.signed_count,
         updated_at = now()
    from (
      select count(*)::smallint as signer_count,
             count(*) filter (where status = 'signed')::smallint as signed_count
        from public.contract_signers
       where contract_id = v_contract_id
    ) as counts
   where c.id = v_contract_id;

  return null;
end;
$$;

comment on function public.refresh_contract_signer_count() is
  'Keeps the signer counts on a contract in step with its signers.';

create trigger contract_signers_90_counts
  after insert or delete on public.contract_signers
  for each row execute function public.refresh_contract_signer_count();

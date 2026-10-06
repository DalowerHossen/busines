-- supabase/tests/phase21_storage_provider_folders.sql
-- Run against a disposable Supabase/Postgres database after the Phase 21
-- migration. The browser roles must not be able to read or mutate the
-- server-only provider-folder mapping.

begin;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000101',
  true
);

do $$
begin
  begin
    insert into public.storage_provider_folders (
      company_id,
      provider_id,
      provider_folder_id
    )
    values (
      '10000000-0000-0000-0000-000000000101',
      'google_drive',
      'phase21-browser-must-not-write'
    );
    raise exception 'authenticated role was able to write server-only storage mapping';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

rollback;

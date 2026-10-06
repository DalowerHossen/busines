-- supabase/migrations/00016_create_company_profile_snapshots.sql
-- Frozen copies of the business identity.
--
-- When a document is issued, the current profile is captured here and the
-- document stores the snapshot identifier. Changing the logo, address or bank
-- details later never alters a document that was already sent, which is a
-- legal requirement for issued invoices.

create table public.company_profile_snapshots (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  -- Complete profile payload at the moment of issue.
  profile_data jsonb not null,

  -- SHA-256 of profile_data, used to reuse an identical snapshot instead of
  -- storing a duplicate row for every document.
  content_hash text not null,

  logo_storage_key text,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint company_profile_snapshots_payload_check
    check (jsonb_typeof(profile_data) = 'object' and profile_data <> '{}'::jsonb),
  constraint company_profile_snapshots_hash_check
    check (content_hash ~ '^[0-9a-f]{64}$')
);

comment on table public.company_profile_snapshots is
  'Immutable business identity captured when a document is issued.';

create unique index company_profile_snapshots_hash_unique
  on public.company_profile_snapshots (company_id, content_hash);

create index company_profile_snapshots_company_idx
  on public.company_profile_snapshots (company_id, captured_at desc);

-- Snapshots are append only. They are never updated and never deleted while a
-- document still references them.
create or replace function public.block_snapshot_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'Company profile snapshots are immutable'
    using errcode = '42501';
end;
$$;

comment on function public.block_snapshot_mutation() is
  'Trigger function that keeps issued document snapshots immutable.';

create trigger company_profile_snapshots_immutable
  before update or delete on public.company_profile_snapshots
  for each row execute function public.block_snapshot_mutation();

-- Captures the current profile, reusing an identical previous snapshot.
create or replace function public.capture_company_profile_snapshot(p_company_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_profile jsonb;
  v_logo_key text;
  v_hash text;
  v_snapshot_id uuid;
begin
  if p_company_id is null then
    raise exception 'A company identifier is required to capture a snapshot'
      using errcode = '22023';
  end if;

  select to_jsonb(profile) - 'id' - 'created_at' - 'updated_at' - 'deleted_at'
                           - 'created_by' - 'updated_by',
         profile.logo_storage_key
    into v_profile, v_logo_key
    from public.company_profiles as profile
   where profile.company_id = p_company_id
     and profile.deleted_at is null;

  if v_profile is null then
    raise exception 'Company % has no profile to capture', p_company_id
      using errcode = 'P0002';
  end if;

  v_hash := encode(extensions.digest(v_profile::text, 'sha256'), 'hex');

  select id
    into v_snapshot_id
    from public.company_profile_snapshots
   where company_id = p_company_id
     and content_hash = v_hash;

  if v_snapshot_id is not null then
    return v_snapshot_id;
  end if;

  insert into public.company_profile_snapshots (
    company_id,
    profile_data,
    content_hash,
    logo_storage_key
  )
  values (
    p_company_id,
    v_profile,
    v_hash,
    v_logo_key
  )
  returning id into v_snapshot_id;

  return v_snapshot_id;
end;
$$;

comment on function public.capture_company_profile_snapshot(uuid) is
  'Returns the snapshot identifier for the current profile, creating it if new.';

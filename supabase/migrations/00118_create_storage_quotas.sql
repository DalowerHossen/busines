-- supabase/migrations/00118_create_storage_quotas.sql
-- How much space a tenant may use, and what it is using right now.
--
-- The quota is enforced before an upload is agreed rather than after the
-- bytes arrive, because refusing a file that is already in the bucket costs
-- money and annoys the person who uploaded it.

create table public.storage_quotas (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  -- Null means the plan decides; a number here overrides the plan.
  quota_bytes bigint,
  used_bytes bigint not null default 0,
  file_count integer not null default 0,

  -- Counted separately so a huge export does not look like customer data.
  archive_bytes bigint not null default 0,
  -- Delivery, which is what a storage bill is really made of.
  egress_bytes_this_month bigint not null default 0,
  egress_reset_at date not null default date_trunc('month', current_date)::date,

  warning_sent_at timestamptz,
  exceeded_at timestamptz,
  last_calculated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint storage_quotas_bytes_check
    check (coalesce(quota_bytes, 0) >= 0 and used_bytes >= 0
           and archive_bytes >= 0 and egress_bytes_this_month >= 0),
  constraint storage_quotas_count_check
    check (file_count >= 0)
);

comment on table public.storage_quotas is
  'The storage allowance of a tenant and what it has used.';

create unique index storage_quotas_company_key
  on public.storage_quotas (company_id);

-- -----------------------------------------------------------------------------
-- Measuring and enforcing
-- -----------------------------------------------------------------------------

-- The allowance in bytes: the override if there is one, otherwise whatever
-- the plan entitles the tenant to, otherwise a workable free tier.
create or replace function public.storage_quota_bytes(p_company_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_override bigint;
begin
  select quota_bytes into v_override
    from public.storage_quotas
   where company_id = p_company_id;

  if v_override is not null then
    return v_override;
  end if;

  -- The plan decides, through the same entitlement resolver the rest of the
  -- product uses. A plan with no stated ceiling falls back to one gigabyte.
  return coalesce(public.usage_limit(p_company_id, 'storage_bytes'), 1073741824);
end;
$$;

comment on function public.storage_quota_bytes(uuid) is
  'Returns the storage allowance of a tenant in bytes.';

-- Recounts what a tenant is actually holding, from the register itself.
create or replace function public.recalculate_storage_usage(p_company_id uuid)
returns bigint
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_used bigint;
  v_archive bigint;
  v_count integer;
begin
  select coalesce(sum(byte_size), 0),
         coalesce(sum(byte_size) filter (where storage_tier = 'archive'), 0),
         count(*)::integer
    into v_used, v_archive, v_count
    from public.files
   where company_id = p_company_id
     and deleted_at is null
     and purged_at is null;

  insert into public.storage_quotas (
    company_id, used_bytes, archive_bytes, file_count, last_calculated_at
  )
  values (p_company_id, v_used, v_archive, v_count, now())
  on conflict (company_id) do update
     set used_bytes = excluded.used_bytes,
         archive_bytes = excluded.archive_bytes,
         file_count = excluded.file_count,
         last_calculated_at = now(),
         exceeded_at = case
                         when excluded.used_bytes
                              >= public.storage_quota_bytes(p_company_id)
                           then now()
                         else null
                       end,
         updated_at = now();

  -- The company row carries the same number, because the metering module
  -- reads it when it reports usage against the plan.
  update public.companies
     set storage_used_bytes = v_used,
         updated_at = now()
   where id = p_company_id;

  perform public.sync_storage_usage(p_company_id);

  return v_used;
end;
$$;

comment on function public.recalculate_storage_usage(uuid) is
  'Recounts the storage a tenant holds and records it against the quota.';

-- Answers the only question an upload needs to ask.
create or replace function public.storage_quota_allows(
  p_company_id uuid,
  p_additional_bytes bigint
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_used bigint;
  v_quota bigint;
begin
  if p_company_id is null then
    return true;
  end if;

  select used_bytes into v_used
    from public.storage_quotas
   where company_id = p_company_id;

  v_quota := public.storage_quota_bytes(p_company_id);

  return coalesce(v_used, 0) + coalesce(p_additional_bytes, 0) <= v_quota;
end;
$$;

comment on function public.storage_quota_allows(uuid, bigint) is
  'Returns true when a tenant still has room for a file of this size.';

-- What the storage of a tenant looks like on one screen.
create or replace function public.storage_usage_report(p_company_id uuid)
returns table (
  file_purpose text,
  file_count integer,
  total_bytes bigint,
  share_percentage numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select f.file_purpose,
         count(*)::integer,
         sum(f.byte_size)::bigint,
         round(
           100.0 * sum(f.byte_size)
           / nullif(sum(sum(f.byte_size)) over (), 0),
           2
         )
    from public.files as f
   where f.company_id = p_company_id
     and f.deleted_at is null
     and f.purged_at is null
   group by f.file_purpose
   order by sum(f.byte_size) desc;
$$;

comment on function public.storage_usage_report(uuid) is
  'Breaks the storage of a tenant down by what the files are for.';

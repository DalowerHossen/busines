-- supabase/migrations/00223_create_data_import.sql
-- Moving a business in from wherever it kept its records before.
--
-- Nobody adopts an invoicing product by typing four hundred clients into it
-- by hand. They arrive with a spreadsheet exported from the last tool, and
-- the first hour decides whether they stay. So importing has to be safe
-- rather than clever.
--
-- Three things make it safe. Every import is tried first and reported on
-- before a single row is written, so a person sees exactly what would
-- happen. A row that matches something already here is counted as a match
-- rather than silently duplicated, because a duplicated client is worse
-- than a missing one. And every run is recorded with its counts, so a bad
-- import can be recognised afterwards rather than argued about.

create table public.data_import_batches (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  -- clients, products or opening_balances.
  import_kind text not null,
  source_label text,

  is_dry_run boolean not null default true,
  row_count integer not null default 0,
  created_count integer not null default 0,
  matched_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  problems jsonb not null default '[]'::jsonb,

  started_at timestamptz not null default now(),
  finished_at timestamptz,
  started_by uuid,

  constraint data_import_kind_check
    check (import_kind in ('clients', 'products', 'opening_balances')),
  constraint data_import_counts_check
    check (row_count >= 0 and created_count >= 0 and matched_count >= 0
           and skipped_count >= 0 and error_count >= 0),
  constraint data_import_problems_check
    check (jsonb_typeof(problems) = 'array')
);

comment on table public.data_import_batches is
  'Every attempt to bring records in from another system, rehearsal or real.';

comment on column public.data_import_batches.is_dry_run is
  'A rehearsal writes nothing and exists so a person can see what would happen.';

create index data_import_batches_company_idx
  on public.data_import_batches (company_id, started_at desc);

-- -----------------------------------------------------------------------------
-- Bringing clients in
-- -----------------------------------------------------------------------------

create or replace function public.import_client_rows(
  p_company_id uuid,
  p_rows jsonb,
  p_is_dry_run boolean default true,
  p_source_label text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_row jsonb;
  v_name text;
  v_email text;
  v_existing uuid;
  v_created integer := 0;
  v_matched integer := 0;
  v_skipped integer := 0;
  v_problems jsonb := '[]'::jsonb;
  v_index integer := 0;
  v_batch_id uuid;
begin
  if not (public.is_service_role() or public.can_write_company_data(p_company_id)) then
    raise exception 'You are not allowed to bring records into this business'
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'An import needs a list of rows' using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'That is more than two thousand rows. Split the file and import it in parts'
      using errcode = '22023';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_index := v_index + 1;
    v_name := btrim(coalesce(v_row ->> 'display_name', ''));
    v_email := lower(btrim(coalesce(v_row ->> 'email', '')));

    if v_name = '' then
      v_skipped := v_skipped + 1;
      v_problems := v_problems || jsonb_build_object(
        'row', v_index, 'problem', 'No name in this row, so there is nothing to call the client'
      );
      continue;
    end if;

    if v_email <> '' and not public.is_valid_email(v_email) then
      v_skipped := v_skipped + 1;
      v_problems := v_problems || jsonb_build_object(
        'row', v_index, 'problem', 'That is not an email address: ' || v_email
      );
      continue;
    end if;

    -- A client already here is matched, never duplicated. A duplicate costs
    -- somebody an afternoon of merging later.
    select id into v_existing
      from public.clients
     where company_id = p_company_id
       and deleted_at is null
       and (
         (v_email <> '' and lower(email::text) = v_email)
         or lower(display_name) = lower(v_name)
       )
     limit 1;

    if v_existing is not null then
      v_matched := v_matched + 1;
      continue;
    end if;

    v_created := v_created + 1;

    if not p_is_dry_run then
      insert into public.clients (
        company_id, display_name, legal_name, email, phone,
        default_payment_terms_days, created_by, updated_by
      )
      values (
        p_company_id, v_name,
        nullif(btrim(coalesce(v_row ->> 'legal_name', '')), ''),
        nullif(v_email, '')::citext,
        nullif(btrim(coalesce(v_row ->> 'phone', '')), ''),
        nullif(btrim(coalesce(v_row ->> 'payment_terms_days', '')), '')::smallint,
        public.current_user_id(), public.current_user_id()
      );
    end if;
  end loop;

  insert into public.data_import_batches (
    company_id, import_kind, source_label, is_dry_run, row_count,
    created_count, matched_count, skipped_count, error_count, problems,
    finished_at, started_by
  )
  values (
    p_company_id, 'clients', nullif(btrim(coalesce(p_source_label, '')), ''),
    coalesce(p_is_dry_run, true), v_index, v_created, v_matched, v_skipped,
    jsonb_array_length(v_problems), v_problems, now(), public.current_user_id()
  )
  returning id into v_batch_id;

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'is_dry_run', coalesce(p_is_dry_run, true),
    'row_count', v_index,
    'created_count', v_created,
    'matched_count', v_matched,
    'skipped_count', v_skipped,
    'problems', v_problems
  );
end;
$$;

comment on function public.import_client_rows(uuid, jsonb, boolean, text) is
  'Brings clients in from another system, matching anybody already here.';

-- -----------------------------------------------------------------------------
-- Bringing products in
-- -----------------------------------------------------------------------------

create or replace function public.import_product_rows(
  p_company_id uuid,
  p_rows jsonb,
  p_is_dry_run boolean default true,
  p_source_label text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row jsonb;
  v_name text;
  v_sku text;
  v_price numeric;
  v_existing uuid;
  v_created integer := 0;
  v_matched integer := 0;
  v_skipped integer := 0;
  v_problems jsonb := '[]'::jsonb;
  v_index integer := 0;
  v_batch_id uuid;
begin
  if not (public.is_service_role() or public.can_write_company_data(p_company_id)) then
    raise exception 'You are not allowed to bring records into this business'
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'An import needs a list of rows' using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'That is more than two thousand rows. Split the file and import it in parts'
      using errcode = '22023';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_index := v_index + 1;
    v_name := btrim(coalesce(v_row ->> 'name', ''));
    v_sku := btrim(coalesce(v_row ->> 'sku', ''));

    if v_name = '' then
      v_skipped := v_skipped + 1;
      v_problems := v_problems || jsonb_build_object(
        'row', v_index, 'problem', 'No name in this row'
      );
      continue;
    end if;

    begin
      v_price := coalesce(nullif(btrim(coalesce(v_row ->> 'unit_price', '')), ''), '0')::numeric;
    exception
      when others then
        v_skipped := v_skipped + 1;
        v_problems := v_problems || jsonb_build_object(
          'row', v_index,
          'problem', 'The price is not a number: ' || coalesce(v_row ->> 'unit_price', '')
        );
        continue;
    end;

    if v_price < 0 then
      v_skipped := v_skipped + 1;
      v_problems := v_problems || jsonb_build_object(
        'row', v_index, 'problem', 'A price below zero is not a price'
      );
      continue;
    end if;

    select id into v_existing
      from public.products
     where company_id = p_company_id
       and deleted_at is null
       and (
         (v_sku <> '' and lower(coalesce(sku, '')) = lower(v_sku))
         or lower(name) = lower(v_name)
       )
     limit 1;

    if v_existing is not null then
      v_matched := v_matched + 1;
      continue;
    end if;

    v_created := v_created + 1;

    if not p_is_dry_run then
      insert into public.products (
        company_id, name, sku, description, unit_price, product_type,
        created_by, updated_by
      )
      values (
        p_company_id, v_name, nullif(v_sku, ''),
        nullif(btrim(coalesce(v_row ->> 'description', '')), ''),
        v_price,
        case
          when lower(coalesce(v_row ->> 'product_type', '')) = 'goods' then 'goods'
          else 'service'
        end::public.product_type,
        public.current_user_id(), public.current_user_id()
      );
    end if;
  end loop;

  insert into public.data_import_batches (
    company_id, import_kind, source_label, is_dry_run, row_count,
    created_count, matched_count, skipped_count, error_count, problems,
    finished_at, started_by
  )
  values (
    p_company_id, 'products', nullif(btrim(coalesce(p_source_label, '')), ''),
    coalesce(p_is_dry_run, true), v_index, v_created, v_matched, v_skipped,
    jsonb_array_length(v_problems), v_problems, now(), public.current_user_id()
  )
  returning id into v_batch_id;

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'is_dry_run', coalesce(p_is_dry_run, true),
    'row_count', v_index,
    'created_count', v_created,
    'matched_count', v_matched,
    'skipped_count', v_skipped,
    'problems', v_problems
  );
end;
$$;

comment on function public.import_product_rows(uuid, jsonb, boolean, text) is
  'Brings products in from another system, matching anything already here.';

-- -----------------------------------------------------------------------------
-- What has been imported before
-- -----------------------------------------------------------------------------

create or replace function public.import_history(p_company_id uuid, p_limit integer default 20)
returns table (
  batch_id uuid,
  import_kind text,
  source_label text,
  is_dry_run boolean,
  row_count integer,
  created_count integer,
  matched_count integer,
  skipped_count integer,
  problems jsonb,
  started_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You cannot read the imports of another business'
      using errcode = '42501';
  end if;

  return query
    select b.id, b.import_kind, b.source_label, b.is_dry_run, b.row_count,
           b.created_count, b.matched_count, b.skipped_count, b.problems, b.started_at
      from public.data_import_batches as b
     where b.company_id = p_company_id
     order by b.started_at desc
     limit greatest(coalesce(p_limit, 20), 1);
end;
$$;

comment on function public.import_history(uuid, integer) is
  'Lists what has been imported, rehearsals included, with the counts of each run.';

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.data_import_batches enable row level security;
alter table public.data_import_batches force row level security;

create policy data_import_batches_select on public.data_import_batches
  for select to authenticated
  using (public.has_company_access(company_id));

grant select on public.data_import_batches to authenticated;

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.import_client_rows(uuid, jsonb, boolean, text)
  from public, authenticated;
revoke execute on function public.import_product_rows(uuid, jsonb, boolean, text)
  from public, authenticated;
revoke execute on function public.import_history(uuid, integer)
  from public, authenticated;

grant execute on function public.import_client_rows(uuid, jsonb, boolean, text)
  to authenticated, service_role;
grant execute on function public.import_product_rows(uuid, jsonb, boolean, text)
  to authenticated, service_role;
grant execute on function public.import_history(uuid, integer)
  to authenticated, service_role;

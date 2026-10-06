-- supabase/migrations/00010_create_document_numbering.sql
-- Gapless, race free document numbering.
--
-- Invoice numbers must be sequential and must never repeat, even when several
-- staff members create documents at the same instant. A transaction level
-- advisory lock serialises counter access per company and document type, and
-- the counter row itself is locked for update.

create table if not exists public.document_number_counters (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  document_type public.document_type not null,
  period_key text not null default 'all',
  prefix text not null default '',
  suffix text not null default '',
  padding smallint not null default 4,
  next_value bigint not null default 1,
  last_issued_number text,
  last_issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_number_counters_unique
    unique (company_id, document_type, period_key),
  constraint document_number_counters_padding_check
    check (padding between 0 and 12),
  constraint document_number_counters_next_value_check
    check (next_value > 0),
  constraint document_number_counters_prefix_check
    check (length(prefix) <= 16),
  constraint document_number_counters_suffix_check
    check (length(suffix) <= 16)
);

comment on table public.document_number_counters is
  'Per company, per document type sequence counters used for gapless numbering.';

create index if not exists document_number_counters_company_idx
  on public.document_number_counters (company_id, document_type);

select public.install_timestamp_trigger('document_number_counters');

-- Resolves the period key used to group a counter.
-- 'never' keeps one continuous sequence, 'yearly' and 'monthly' restart it.
create or replace function public.resolve_period_key(
  p_reset_policy text,
  p_reference date default current_date
)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  case coalesce(p_reset_policy, 'never')
    when 'never' then
      return 'all';
    when 'yearly' then
      return to_char(p_reference, 'YYYY');
    when 'monthly' then
      return to_char(p_reference, 'YYYY-MM');
    else
      raise exception 'Unsupported numbering reset policy %', p_reset_policy
        using errcode = '22023';
  end case;
end;
$$;

comment on function public.resolve_period_key(text, date) is
  'Returns the counter grouping key for a numbering reset policy.';

-- Formats a numeric sequence value into the final document number.
create or replace function public.format_document_number(
  p_prefix text,
  p_value bigint,
  p_padding smallint,
  p_suffix text
)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(p_prefix, '')
      || lpad(p_value::text, greatest(coalesce(p_padding, 4)::integer, length(p_value::text)), '0')
      || coalesce(p_suffix, '');
$$;

comment on function public.format_document_number(text, bigint, smallint, text) is
  'Builds the final document number from a prefix, padded value and suffix.';

-- Issues the next document number for a company and document type.
-- The function is volatile and must only be called inside a write transaction.
create or replace function public.next_document_number(
  p_company_id uuid,
  p_document_type public.document_type,
  p_prefix text default null,
  p_padding smallint default null,
  p_reset_policy text default 'never',
  p_suffix text default null,
  p_reference date default current_date
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_period_key text;
  v_lock_key bigint;
  v_counter public.document_number_counters%rowtype;
  v_number text;
begin
  if p_company_id is null then
    raise exception 'A company identifier is required to issue a document number'
      using errcode = '22023';
  end if;

  v_period_key := public.resolve_period_key(p_reset_policy, p_reference);

  -- Serialise concurrent callers for this company, type and period.
  v_lock_key := hashtextextended(
    p_company_id::text || ':' || p_document_type::text || ':' || v_period_key,
    0
  );
  perform pg_advisory_xact_lock(v_lock_key);

  select *
    into v_counter
    from public.document_number_counters
   where company_id = p_company_id
     and document_type = p_document_type
     and period_key = v_period_key
     for update;

  if not found then
    insert into public.document_number_counters (
      company_id,
      document_type,
      period_key,
      prefix,
      suffix,
      padding,
      next_value
    )
    values (
      p_company_id,
      p_document_type,
      v_period_key,
      coalesce(p_prefix, ''),
      coalesce(p_suffix, ''),
      coalesce(p_padding, 4),
      1
    )
    returning * into v_counter;
  end if;

  if p_prefix is not null and p_prefix <> v_counter.prefix then
    v_counter.prefix := p_prefix;
  end if;

  if p_suffix is not null and p_suffix <> v_counter.suffix then
    v_counter.suffix := p_suffix;
  end if;

  if p_padding is not null and p_padding <> v_counter.padding then
    v_counter.padding := p_padding;
  end if;

  v_number := public.format_document_number(
    v_counter.prefix,
    v_counter.next_value,
    v_counter.padding,
    v_counter.suffix
  );

  update public.document_number_counters
     set next_value = v_counter.next_value + 1,
         prefix = v_counter.prefix,
         suffix = v_counter.suffix,
         padding = v_counter.padding,
         last_issued_number = v_number,
         last_issued_at = now()
   where id = v_counter.id;

  return v_number;
end;
$$;

comment on function public.next_document_number(
  uuid, public.document_type, text, smallint, text, text, date
) is 'Issues the next gapless document number for a company and document type.';

-- Reserves a starting value when a company imports historic documents.
create or replace function public.set_document_number_start(
  p_company_id uuid,
  p_document_type public.document_type,
  p_next_value bigint,
  p_reset_policy text default 'never',
  p_reference date default current_date
)
returns bigint
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_period_key text;
  v_current bigint;
begin
  if p_next_value is null or p_next_value < 1 then
    raise exception 'The starting value must be greater than zero, received %', p_next_value
      using errcode = '22023';
  end if;

  v_period_key := public.resolve_period_key(p_reset_policy, p_reference);

  insert into public.document_number_counters (
    company_id,
    document_type,
    period_key,
    next_value
  )
  values (
    p_company_id,
    p_document_type,
    v_period_key,
    p_next_value
  )
  on conflict (company_id, document_type, period_key) do update
     set next_value = greatest(public.document_number_counters.next_value, excluded.next_value)
   returning next_value into v_current;

  return v_current;
end;
$$;

comment on function public.set_document_number_start(
  uuid, public.document_type, bigint, text, date
) is 'Raises the numbering counter so imported historic numbers are never reused.';

-- supabase/migrations/00028_create_tax_rates.sql
-- Tax rates and compound tax groups.
--
-- A rate is never edited once it has been used on an issued document: the
-- percentage is copied onto the document line, and a changed rate is stored as
-- a new record with its own effective period. That keeps historic documents
-- arithmetically reproducible.

create table public.tax_rates (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  name text not null,
  code text,
  kind public.tax_rate_kind not null default 'vat',

  -- Percentage with four decimal places, for example 7.2500.
  rate_percentage numeric(9, 4) not null,

  -- A compound rate is applied on top of the amount including earlier taxes.
  is_compound boolean not null default false,
  is_default boolean not null default false,
  is_recoverable boolean not null default true,

  -- Jurisdiction, used by the tax reports and by automatic rate selection.
  country_code char(2),
  state_region text,
  tax_authority text,
  registration_number text,

  -- Rate that replaces this one when a client is reverse charged.
  reverse_charge_note text,

  effective_from date not null default current_date,
  effective_to date,
  archived_at timestamptz,

  description text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint tax_rates_name_check
    check (length(btrim(name)) between 1 and 80),
  constraint tax_rates_rate_check
    check (rate_percentage >= 0 and rate_percentage <= 100),
  constraint tax_rates_country_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint tax_rates_period_check
    check (effective_to is null or effective_to >= effective_from)
);

comment on table public.tax_rates is
  'Tax percentages available to documents, with their effective periods.';
comment on column public.tax_rates.is_compound is
  'When set, the rate applies to the amount that already includes earlier taxes.';

create unique index tax_rates_default_unique
  on public.tax_rates (company_id)
  where is_default and deleted_at is null and archived_at is null;

create unique index tax_rates_code_unique
  on public.tax_rates (company_id, code)
  where code is not null and deleted_at is null;

create index tax_rates_company_idx
  on public.tax_rates (company_id)
  where deleted_at is null and archived_at is null;

create index tax_rates_jurisdiction_idx
  on public.tax_rates (company_id, country_code, state_region)
  where deleted_at is null;

create or replace function public.demote_other_default_tax_rates()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.is_default and new.deleted_at is null and new.archived_at is null then
    update public.tax_rates
       set is_default = false,
           updated_at = now()
     where company_id = new.company_id
       and id <> new.id
       and is_default
       and deleted_at is null;
  end if;

  return new;
end;
$$;

comment on function public.demote_other_default_tax_rates() is
  'Keeps a single default tax rate per company when another one is promoted.';

create trigger tax_rates_single_default
  before insert or update of is_default on public.tax_rates
  for each row execute function public.demote_other_default_tax_rates();

-- -----------------------------------------------------------------------------
-- Tax groups
-- -----------------------------------------------------------------------------

-- A group bundles several rates, for example a state rate plus a city rate, and
-- is selected on a document line exactly like a single rate.
create table public.tax_groups (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  name text not null,
  code text,
  description text,
  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint tax_groups_name_check
    check (length(btrim(name)) between 1 and 80)
);

comment on table public.tax_groups is
  'Named combinations of tax rates applied together on a document line.';

create unique index tax_groups_name_unique
  on public.tax_groups (company_id, name)
  where deleted_at is null;

create table public.tax_group_members (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  tax_group_id uuid not null,
  tax_rate_id uuid not null,

  -- Lower numbers are applied first, which matters for compound rates.
  apply_order smallint not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tax_group_members_order_check
    check (apply_order between 1 and 20)
);

comment on table public.tax_group_members is
  'The individual rates that make up a tax group, in application order.';

create unique index tax_group_members_unique
  on public.tax_group_members (tax_group_id, tax_rate_id);

create index tax_group_members_rate_idx
  on public.tax_group_members (tax_rate_id);

-- Returns the effective percentage of a group as a single number, taking the
-- compound rates into account. Used for previews and for report totals.
create or replace function public.effective_tax_group_rate(p_tax_group_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_member record;
  v_base numeric := 100;
  v_total numeric := 0;
begin
  for v_member in
    select r.rate_percentage, r.is_compound
      from public.tax_group_members as m
      join public.tax_rates as r on r.id = m.tax_rate_id
     where m.tax_group_id = p_tax_group_id
       and r.deleted_at is null
     order by m.apply_order asc
  loop
    if v_member.is_compound then
      v_total := v_total + ((v_base + v_total) * v_member.rate_percentage / 100);
    else
      v_total := v_total + (v_base * v_member.rate_percentage / 100);
    end if;
  end loop;

  return round(v_total, 4);
end;
$$;

comment on function public.effective_tax_group_rate(uuid) is
  'Returns the combined percentage of a tax group, including compound rates.';

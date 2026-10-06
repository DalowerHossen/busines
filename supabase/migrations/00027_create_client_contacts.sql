-- supabase/migrations/00027_create_client_contacts.sql
-- Named people inside a client organisation.
--
-- Documents are addressed to the client, while copies and reminders go to the
-- contacts that are marked to receive them. A contact never holds a login.

create table public.client_contacts (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  client_id uuid not null,

  full_name text not null,
  job_title text,
  email citext,
  phone text,
  mobile text,

  is_primary boolean not null default false,
  receives_invoices boolean not null default true,
  receives_reminders boolean not null default true,
  receives_statements boolean not null default false,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint client_contacts_full_name_check
    check (length(btrim(full_name)) between 1 and 160),
  constraint client_contacts_email_check
    check (email is null or public.is_valid_email(email::text)),
  constraint client_contacts_reachable_check
    check (email is not null or phone is not null or mobile is not null)
);

comment on table public.client_contacts is
  'People at a client organisation who receive documents and reminders.';

create unique index client_contacts_primary_unique
  on public.client_contacts (client_id)
  where is_primary and deleted_at is null;

create unique index client_contacts_email_unique
  on public.client_contacts (client_id, email)
  where email is not null and deleted_at is null;

create index client_contacts_client_idx
  on public.client_contacts (client_id)
  where deleted_at is null;

create index client_contacts_company_idx
  on public.client_contacts (company_id)
  where deleted_at is null;

-- Exactly one contact carries the primary flag, so promoting a contact
-- demotes the previous one instead of failing on the unique index.
create or replace function public.demote_other_primary_contacts()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.is_primary and new.deleted_at is null then
    update public.client_contacts
       set is_primary = false,
           updated_at = now()
     where client_id = new.client_id
       and id <> new.id
       and is_primary
       and deleted_at is null;
  end if;

  return new;
end;
$$;

comment on function public.demote_other_primary_contacts() is
  'Keeps a single primary contact per client when another one is promoted.';

create trigger client_contacts_single_primary
  before insert or update of is_primary on public.client_contacts
  for each row execute function public.demote_other_primary_contacts();

-- -----------------------------------------------------------------------------
-- Addresses
-- -----------------------------------------------------------------------------

create table public.client_addresses (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  client_id uuid not null,

  address_type public.address_type not null default 'billing',
  label text,
  attention_to text,

  address_line1 text not null,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  country_code char(2) not null,

  is_default boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint client_addresses_line1_check
    check (length(btrim(address_line1)) between 1 and 200),
  constraint client_addresses_country_check
    check (country_code ~ '^[A-Z]{2}$')
);

comment on table public.client_addresses is
  'Billing and shipping addresses printed on the documents of a client.';

create unique index client_addresses_default_unique
  on public.client_addresses (client_id, address_type)
  where is_default and deleted_at is null;

create index client_addresses_client_idx
  on public.client_addresses (client_id, address_type)
  where deleted_at is null;

create index client_addresses_company_idx
  on public.client_addresses (company_id)
  where deleted_at is null;

-- The same single default rule applies per address type.
create or replace function public.demote_other_default_addresses()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.is_default and new.deleted_at is null then
    update public.client_addresses
       set is_default = false,
           updated_at = now()
     where client_id = new.client_id
       and address_type = new.address_type
       and id <> new.id
       and is_default
       and deleted_at is null;
  end if;

  return new;
end;
$$;

comment on function public.demote_other_default_addresses() is
  'Keeps a single default address per type when another one is promoted.';

create trigger client_addresses_single_default
  before insert or update of is_default on public.client_addresses
  for each row execute function public.demote_other_default_addresses();

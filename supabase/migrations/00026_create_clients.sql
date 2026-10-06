-- supabase/migrations/00026_create_clients.sql
-- The client directory.
--
-- A client is never an account on the platform. Clients receive documents
-- through signed links, so this table holds the billing identity only.
-- Normalised contact columns support duplicate detection and merging, which
-- keeps the directory clean as it grows.

create table public.clients (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  -- Human readable reference such as CL-0001, unique inside the company.
  client_number text not null,

  client_type public.client_type not null default 'business',
  status public.client_status not null default 'active',

  display_name text not null,
  legal_name text,
  contact_person text,

  email citext,
  phone text,
  mobile text,
  website text,

  -- Lowercase, punctuation free copies used for duplicate detection.
  normalized_name text,
  normalized_email citext,
  normalized_phone text,

  -- Billing behaviour.
  billing_currency char(3),
  default_payment_terms_days smallint,
  default_price_list_id uuid,
  default_tax_rate_id uuid,
  credit_limit numeric(18, 2),
  late_fee_percentage numeric(5, 2),

  -- Statutory identifiers and international tax handling.
  tax_id text,
  vat_number text,
  vat_number_validated_at timestamptz,
  registration_number text,
  country_code char(2),
  is_tax_exempt boolean not null default false,
  tax_exemption_reason text,
  applies_reverse_charge boolean not null default false,

  -- Communication preferences for reminders and statements.
  preferred_contact_channel public.message_channel not null default 'email',
  send_reminders boolean not null default true,
  statement_delivery_enabled boolean not null default false,
  portal_notes text,
  internal_notes text,

  -- Duplicate handling. A merged client stays readable so old documents keep
  -- resolving, but it is excluded from pickers and reports.
  merged_into_client_id uuid,
  merged_at timestamptz,

  first_invoiced_at timestamptz,
  last_invoiced_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint clients_client_number_check
    check (length(btrim(client_number)) between 1 and 40),
  constraint clients_display_name_check
    check (length(btrim(display_name)) between 1 and 160),
  constraint clients_email_check
    check (email is null or public.is_valid_email(email::text)),
  constraint clients_currency_check
    check (billing_currency is null or billing_currency ~ '^[A-Z]{3}$'),
  constraint clients_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint clients_payment_terms_check
    check (default_payment_terms_days is null
           or default_payment_terms_days between 0 and 365),
  constraint clients_credit_limit_check
    check (credit_limit is null or credit_limit >= 0),
  constraint clients_late_fee_check
    check (late_fee_percentage is null or late_fee_percentage between 0 and 100),
  constraint clients_tax_exemption_check
    check (not is_tax_exempt or tax_exemption_reason is not null),
  constraint clients_merge_check
    check (merged_into_client_id is null or merged_at is not null),
  constraint clients_self_merge_check
    check (merged_into_client_id is distinct from id)
);

comment on table public.clients is
  'Billing identity of the people and businesses a company invoices.';
comment on column public.clients.merged_into_client_id is
  'Set when this record was merged into another client during deduplication.';
comment on column public.clients.applies_reverse_charge is
  'Set for cross border business clients where the client accounts for the tax.';

create unique index clients_number_unique
  on public.clients (company_id, client_number)
  where deleted_at is null;

create index clients_company_status_idx
  on public.clients (company_id, status)
  where deleted_at is null and merged_into_client_id is null;

create index clients_company_name_idx
  on public.clients (company_id, display_name)
  where deleted_at is null;

create index clients_email_idx
  on public.clients (company_id, normalized_email)
  where deleted_at is null and normalized_email is not null;

create index clients_phone_idx
  on public.clients (company_id, normalized_phone)
  where deleted_at is null and normalized_phone is not null;

create index clients_name_trgm_idx
  on public.clients using gin (display_name extensions.gin_trgm_ops);

create index clients_merged_idx
  on public.clients (merged_into_client_id)
  where merged_into_client_id is not null;

-- Keeps the normalised duplicate detection columns in step with the record.
create or replace function public.set_client_normalized_columns()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  new.normalized_name := nullif(
    btrim(regexp_replace(lower(extensions.unaccent(coalesce(new.display_name, ''))),
                         '[^a-z0-9]+', ' ', 'g')),
    ''
  );
  new.normalized_email := nullif(lower(btrim(coalesce(new.email::text, ''))), '')::citext;
  new.normalized_phone := nullif(
    regexp_replace(coalesce(new.phone, new.mobile, ''), '[^0-9]', '', 'g'),
    ''
  );

  return new;
end;
$$;

comment on function public.set_client_normalized_columns() is
  'Maintains the normalised name, email and phone used for duplicate detection.';

create trigger clients_set_normalized_columns
  before insert or update of display_name, email, phone, mobile on public.clients
  for each row execute function public.set_client_normalized_columns();

-- Lists the existing clients that look like the supplied details, so the user
-- is warned before a duplicate is created.
create or replace function public.find_duplicate_clients(
  p_company_id uuid,
  p_display_name text,
  p_email text default null,
  p_phone text default null,
  p_exclude_client_id uuid default null
)
returns table (
  client_id uuid,
  display_name text,
  match_reason text,
  similarity_score numeric
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select c.id,
         c.display_name,
         case
           when p_email is not null and c.normalized_email = lower(btrim(p_email))::citext
             then 'email'
           when p_phone is not null
                and c.normalized_phone = nullif(regexp_replace(p_phone, '[^0-9]', '', 'g'), '')
             then 'phone'
           else 'name'
         end as match_reason,
         round(similarity(c.display_name, coalesce(p_display_name, ''))::numeric, 3)
    from public.clients as c
   where c.company_id = p_company_id
     and c.deleted_at is null
     and c.merged_into_client_id is null
     and (p_exclude_client_id is null or c.id <> p_exclude_client_id)
     and (
       (p_email is not null and c.normalized_email = lower(btrim(p_email))::citext)
       or (p_phone is not null
           and c.normalized_phone = nullif(regexp_replace(p_phone, '[^0-9]', '', 'g'), ''))
       or similarity(c.display_name, coalesce(p_display_name, '')) >= 0.6
     )
   order by 4 desc
   limit 20;
$$;

comment on function public.find_duplicate_clients(uuid, text, text, text, uuid) is
  'Returns clients that resemble the supplied details, ranked by similarity.';

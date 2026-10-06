-- supabase/migrations/00078_create_sender_identities.sql
-- Who a message is sent as, and the domain proof behind it.
--
-- Platform mail leaves as support@kdsolutionit.com. A tenant may send under
-- its own domain, but only after the three records below verify, because an
-- unverified domain lands in the spam folder and damages the shared
-- reputation of every other tenant.

create table public.sending_domains (
  id uuid primary key default public.generate_uuid_v7(),

  -- Null for the platform domain, set for a tenant owned domain.
  company_id uuid,

  domain_name text not null,
  -- The subdomain mail actually leaves from, for example mail.example.com.
  mail_subdomain text,

  provider text not null default 'resend',
  provider_domain_reference text,

  spf_record text not null,
  dkim_host text not null,
  dkim_record text not null,
  dmarc_record text not null,
  return_path_host text,

  spf_verified_at timestamptz,
  dkim_verified_at timestamptz,
  dmarc_verified_at timestamptz,
  last_checked_at timestamptz,
  last_check_message text,

  is_verified boolean not null default false,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint sending_domains_name_check
    check (domain_name ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  constraint sending_domains_subdomain_check
    check (mail_subdomain is null
           or mail_subdomain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  constraint sending_domains_verified_check
    check (not is_verified
           or (spf_verified_at is not null and dkim_verified_at is not null))
);

comment on table public.sending_domains is
  'Domains mail may leave from, with the records that have to be published.';
comment on column public.sending_domains.is_verified is
  'Only set once the sender policy and signature records both resolve.';

create unique index sending_domains_name_unique
  on public.sending_domains (domain_name)
  where deleted_at is null;

create index sending_domains_company_idx
  on public.sending_domains (company_id)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Sender identities
-- -----------------------------------------------------------------------------

create table public.sender_identities (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,
  sending_domain_id uuid,

  from_name text not null,
  from_email citext not null,
  reply_to_email citext,

  -- Set when the tenant has not verified a domain of its own: the message
  -- leaves from the platform address and only the reply address is theirs.
  uses_platform_domain boolean not null default true,

  is_default boolean not null default false,
  is_active boolean not null default true,

  last_used_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint sender_identities_from_name_check
    check (length(btrim(from_name)) between 2 and 80),
  constraint sender_identities_from_email_check
    check (public.is_valid_email(from_email::text)),
  constraint sender_identities_reply_to_check
    check (reply_to_email is null or public.is_valid_email(reply_to_email::text)),
  constraint sender_identities_domain_check
    check (uses_platform_domain or sending_domain_id is not null)
);

comment on table public.sender_identities is
  'The name and address a message is sent as, per tenant or for the platform.';

create unique index sender_identities_default_unique
  on public.sender_identities (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_default and deleted_at is null;

create index sender_identities_company_idx
  on public.sender_identities (company_id)
  where deleted_at is null;

-- The platform identity. Every message the platform itself sends, and every
-- tenant message until that tenant verifies a domain, leaves from here.
insert into public.sending_domains (
  domain_name, mail_subdomain, spf_record, dkim_host, dkim_record, dmarc_record,
  return_path_host, is_verified, spf_verified_at, dkim_verified_at
)
values (
  'kdsolutionit.com',
  'mail.kdsolutionit.com',
  'v=spf1 include:amazonses.com ~all',
  'resend._domainkey.mail.kdsolutionit.com',
  'p=publish-the-value-from-the-mail-provider-dashboard',
  'v=DMARC1; p=quarantine; rua=mailto:dmarc@kdsolutionit.com; adkim=s; aspf=s',
  'bounces.mail.kdsolutionit.com',
  false,
  null,
  null
);

insert into public.sender_identities (
  sending_domain_id, from_name, from_email, reply_to_email,
  uses_platform_domain, is_default
)
select id, 'KD SOLUTION IT', 'support@kdsolutionit.com', 'support@kdsolutionit.com',
       true, true
  from public.sending_domains
 where domain_name = 'kdsolutionit.com';

-- -----------------------------------------------------------------------------
-- Resolution
-- -----------------------------------------------------------------------------

-- Returns the identity a company should send as, falling back to the platform
-- identity whenever the tenant has not set one up or lost its verification.
create or replace function public.resolve_sender_identity(p_company_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_identity_id uuid;
begin
  if p_company_id is not null then
    select si.id
      into v_identity_id
      from public.sender_identities as si
      left join public.sending_domains as sd on sd.id = si.sending_domain_id
     where si.company_id = p_company_id
       and si.is_active
       and si.deleted_at is null
       and (si.uses_platform_domain or coalesce(sd.is_verified, false))
     order by si.is_default desc, si.created_at
     limit 1;
  end if;

  if v_identity_id is not null then
    return v_identity_id;
  end if;

  select id
    into v_identity_id
    from public.sender_identities
   where company_id is null
     and is_default
     and is_active
     and deleted_at is null
   limit 1;

  return v_identity_id;
end;
$$;

comment on function public.resolve_sender_identity(uuid) is
  'Returns the sender a company may use, falling back to the platform address.';

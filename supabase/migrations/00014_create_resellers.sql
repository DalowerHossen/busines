-- supabase/migrations/00014_create_resellers.sql
-- White label partners. A reseller sells the platform under its own brand and
-- manages its own sub tenants, but never sees the business data of those
-- tenants: invoices, clients and documents remain private to each company.

create table public.resellers (
  id uuid primary key default public.generate_uuid_v7(),
  user_id uuid not null,

  partner_name text not null,
  slug text not null,
  status public.reseller_status not null default 'pending_review',

  contact_email citext not null,
  contact_phone text,
  country_code char(2) not null default 'US',

  -- White label presentation applied to the tenants created by this partner.
  brand_name text,
  brand_logo_url text,
  brand_primary_color text,
  brand_accent_color text,
  custom_domain text,
  custom_domain_verified_at timestamptz,
  hide_platform_branding boolean not null default false,

  -- Commercial terms.
  revenue_share_percentage numeric(5, 2) not null default 20.00,
  margin_percentage numeric(5, 2) not null default 0.00,
  billing_currency char(3) not null default 'USD',
  max_sub_tenants integer,

  -- Maintained by a trigger on companies; never written by the application.
  sub_tenant_count integer not null default 0,

  agreement_version text,
  agreement_accepted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  rejection_reason text,
  suspended_at timestamptz,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint resellers_slug_format_check
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  constraint resellers_contact_email_check
    check (public.is_valid_email(contact_email::text)),
  constraint resellers_country_code_check
    check (country_code ~ '^[A-Z]{2}$'),
  constraint resellers_billing_currency_check
    check (billing_currency ~ '^[A-Z]{3}$'),
  constraint resellers_revenue_share_check
    check (revenue_share_percentage between 0 and 100),
  constraint resellers_margin_check
    check (margin_percentage between 0 and 100),
  constraint resellers_max_sub_tenants_check
    check (max_sub_tenants is null or max_sub_tenants > 0),
  constraint resellers_sub_tenant_count_check
    check (sub_tenant_count >= 0),
  constraint resellers_primary_color_check
    check (brand_primary_color is null or brand_primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint resellers_accent_color_check
    check (brand_accent_color is null or brand_accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint resellers_approval_check
    check (status <> 'approved' or approved_at is not null)
);

comment on table public.resellers is
  'White label partners that resell the platform and manage their own tenants.';
comment on column public.resellers.hide_platform_branding is
  'Removes the platform badge from documents and portals for this partner.';

create unique index resellers_user_unique
  on public.resellers (user_id)
  where deleted_at is null;

create unique index resellers_slug_unique
  on public.resellers (slug)
  where deleted_at is null;

create unique index resellers_custom_domain_unique
  on public.resellers (lower(custom_domain))
  where deleted_at is null and custom_domain is not null;

create index resellers_status_idx
  on public.resellers (status)
  where deleted_at is null;

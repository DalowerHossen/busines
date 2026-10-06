-- supabase/migrations/00015_create_company_profiles.sql
-- The business identity that is written onto every invoice, estimate, PDF,
-- email and public document page. Editing the profile affects new documents
-- only; issued documents keep the snapshot captured when they were sent.

create table public.company_profiles (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  -- Identity.
  legal_name text not null,
  trade_name text,
  logo_url text,
  logo_storage_key text,
  logo_updated_at timestamptz,

  -- Contact details printed on documents.
  email citext,
  phone text,
  website text,
  support_email citext,
  support_phone text,

  -- Registered address.
  address_line1 text,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  country_code char(2) not null default 'US',

  -- Statutory identifiers required on a compliant invoice.
  tax_id text,
  vat_number text,
  registration_number text,
  tax_registration_label text not null default 'Tax ID',

  -- Remit to block.
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_routing_number text,
  bank_swift_code text,
  bank_iban text,
  remit_to_instructions text,

  -- Document numbering preferences.
  invoice_prefix text not null default 'INV-',
  estimate_prefix text not null default 'EST-',
  credit_note_prefix text not null default 'CN-',
  debit_note_prefix text not null default 'DN-',
  proforma_prefix text not null default 'PF-',
  purchase_order_prefix text not null default 'PO-',
  receipt_prefix text not null default 'RCP-',
  number_padding smallint not null default 4,
  numbering_reset_policy text not null default 'never',

  -- Document defaults.
  default_payment_terms_days smallint not null default 30,
  default_due_date_uses_business_days boolean not null default false,
  default_notes text,
  default_terms text,
  default_footer_text text,

  -- Tenant branding, applied to documents, emails and public pages.
  brand_primary_color text not null default '#1D4ED8',
  brand_accent_color text not null default '#0EA5E9',
  brand_heading_font text not null default 'Inter',
  brand_body_font text not null default 'Inter',
  invoice_template_key text not null default 'classic',
  paper_size text not null default 'letter',
  show_platform_badge boolean not null default true,

  -- Client link behaviour. Links open directly by default so that invoices are
  -- paid quickly; an owner may require an emailed code instead.
  require_email_otp_for_links boolean not null default false,
  document_link_expiry_days smallint not null default 90,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint company_profiles_legal_name_check
    check (length(btrim(legal_name)) between 2 and 200),
  constraint company_profiles_country_code_check
    check (country_code ~ '^[A-Z]{2}$'),
  constraint company_profiles_email_check
    check (email is null or public.is_valid_email(email::text)),
  constraint company_profiles_support_email_check
    check (support_email is null or public.is_valid_email(support_email::text)),
  constraint company_profiles_padding_check
    check (number_padding between 0 and 12),
  constraint company_profiles_reset_policy_check
    check (numbering_reset_policy in ('never', 'yearly', 'monthly')),
  constraint company_profiles_payment_terms_check
    check (default_payment_terms_days between 0 and 365),
  constraint company_profiles_primary_color_check
    check (brand_primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint company_profiles_accent_color_check
    check (brand_accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint company_profiles_paper_size_check
    check (paper_size in ('a4', 'letter')),
  constraint company_profiles_template_check
    check (invoice_template_key in ('classic', 'modern', 'minimal', 'compact')),
  constraint company_profiles_link_expiry_check
    check (document_link_expiry_days between 1 and 3650),
  constraint company_profiles_prefix_length_check
    check (
      length(invoice_prefix) <= 16
      and length(estimate_prefix) <= 16
      and length(credit_note_prefix) <= 16
      and length(debit_note_prefix) <= 16
      and length(proforma_prefix) <= 16
      and length(purchase_order_prefix) <= 16
      and length(receipt_prefix) <= 16
    )
);

comment on table public.company_profiles is
  'Business identity auto filled into documents, emails and public pages.';
comment on column public.company_profiles.require_email_otp_for_links is
  'When enabled, a client must enter an emailed code before a document opens.';

create unique index company_profiles_company_unique
  on public.company_profiles (company_id)
  where deleted_at is null;

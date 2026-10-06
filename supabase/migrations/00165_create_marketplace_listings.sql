-- supabase/migrations/00165_create_marketplace_listings.sql
-- The template marketplace: what is for sale and who made it.
--
-- A listing is a packaged piece of work -- an invoice template, a chart of
-- accounts, an email set, an automation recipe -- that one tenant publishes
-- and another installs. Everything about the sale lives here; the money side
-- lives in the orders file that follows.

create table public.marketplace_vendors (
  id uuid primary key default public.generate_uuid_v7(),

  -- A vendor is either a tenant or a white label partner, never both.
  company_id uuid,
  reseller_id uuid,

  vendor_name text not null,
  vendor_slug text not null,
  headline text,
  bio text,
  support_email citext,
  website_url text,
  logo_path text,

  status text not null default 'pending_review',
  revenue_share_percentage numeric(5, 2) not null default 70,
  payout_currency char(3) not null default 'USD',
  payout_method text,
  payout_details_encrypted text,

  listing_count integer not null default 0,
  install_count integer not null default 0,
  lifetime_earnings numeric(18, 4) not null default 0,
  average_rating numeric(3, 2),

  approved_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint marketplace_vendors_party_check
    check (num_nonnulls(company_id, reseller_id) = 1),
  constraint marketplace_vendors_name_check
    check (length(btrim(vendor_name)) between 2 and 80),
  constraint marketplace_vendors_slug_check
    check (vendor_slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  constraint marketplace_vendors_status_check
    check (status in ('pending_review', 'approved', 'suspended', 'closed')),
  constraint marketplace_vendors_share_check
    check (revenue_share_percentage between 0 and 100),
  constraint marketplace_vendors_currency_check
    check (payout_currency ~ '^[A-Z]{3}$'),
  constraint marketplace_vendors_rating_check
    check (average_rating is null or average_rating between 1 and 5),
  constraint marketplace_vendors_counts_check
    check (listing_count >= 0 and install_count >= 0 and lifetime_earnings >= 0),
  constraint marketplace_vendors_approved_check
    check (status <> 'approved' or approved_at is not null),
  constraint marketplace_vendors_email_check
    check (support_email is null or public.is_valid_email(support_email::text))
);

comment on table public.marketplace_vendors is
  'A tenant or partner who sells templates in the marketplace.';

create unique index marketplace_vendors_slug_unique
  on public.marketplace_vendors (vendor_slug)
  where deleted_at is null;

create unique index marketplace_vendors_company_unique
  on public.marketplace_vendors (company_id)
  where company_id is not null and deleted_at is null;

create unique index marketplace_vendors_reseller_unique
  on public.marketplace_vendors (reseller_id)
  where reseller_id is not null and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Listings
-- -----------------------------------------------------------------------------

create table public.marketplace_listings (
  id uuid primary key default public.generate_uuid_v7(),
  vendor_id uuid not null,

  listing_slug text not null,
  title text not null,
  summary text not null,
  description text,
  category text not null,
  tags text[] not null default array[]::text[],

  -- What the buyer actually receives.
  artifact_kind text not null,
  artifact_payload jsonb not null default '{}'::jsonb,
  preview_image_path text,
  demo_url text,

  pricing_model text not null default 'one_time',
  price_amount numeric(18, 4) not null default 0,
  price_currency char(3) not null default 'USD',

  version text not null default '1.0.0',
  minimum_platform_version text,
  status text not null default 'draft',

  -- Moderation, because an installed template runs inside a tenant.
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_notes text,
  published_at timestamptz,
  unpublished_at timestamptz,

  install_count integer not null default 0,
  purchase_count integer not null default 0,
  rating_total integer not null default 0,
  rating_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint marketplace_listings_slug_check
    check (listing_slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  constraint marketplace_listings_title_check
    check (length(btrim(title)) between 3 and 90),
  constraint marketplace_listings_summary_check
    check (length(btrim(summary)) between 20 and 200),
  constraint marketplace_listings_category_check
    check (category in ('invoice_template', 'email_template', 'chart_of_accounts',
                        'report_pack', 'automation_recipe', 'industry_preset',
                        'tax_profile', 'checklist')),
  constraint marketplace_listings_artifact_check
    check (artifact_kind in ('document_template', 'email_set', 'account_tree',
                             'report_definition', 'automation', 'preset_bundle')),
  constraint marketplace_listings_pricing_check
    check (pricing_model in ('free', 'one_time', 'subscription')),
  constraint marketplace_listings_price_check
    check (price_amount >= 0
           and (pricing_model <> 'free' or price_amount = 0)
           and (pricing_model = 'free' or price_amount > 0)),
  constraint marketplace_listings_currency_check
    check (price_currency ~ '^[A-Z]{3}$'),
  constraint marketplace_listings_version_check
    check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  constraint marketplace_listings_status_check
    check (status in ('draft', 'in_review', 'rejected', 'published',
                      'unpublished', 'archived')),
  constraint marketplace_listings_published_check
    check (status <> 'published' or published_at is not null),
  constraint marketplace_listings_review_check
    check (status <> 'rejected' or review_notes is not null),
  constraint marketplace_listings_counts_check
    check (install_count >= 0 and purchase_count >= 0
           and rating_count >= 0 and rating_total >= 0),
  constraint marketplace_listings_tags_check
    check (cardinality(tags) <= 10)
);

comment on table public.marketplace_listings is
  'One packaged template offered for sale or free installation.';

create unique index marketplace_listings_slug_unique
  on public.marketplace_listings (listing_slug)
  where deleted_at is null;

create index marketplace_listings_browse_idx
  on public.marketplace_listings (category, published_at desc)
  where status = 'published' and deleted_at is null;

create index marketplace_listings_vendor_idx
  on public.marketplace_listings (vendor_id, status)
  where deleted_at is null;

create index marketplace_listings_search_idx
  on public.marketplace_listings
  using gin (title extensions.gin_trgm_ops);

-- Every published change keeps its own copy, so an install can be reproduced.
create table public.marketplace_listing_versions (
  id uuid primary key default public.generate_uuid_v7(),
  listing_id uuid not null,

  version text not null,
  changelog text,
  artifact_payload jsonb not null,
  is_current boolean not null default false,
  published_at timestamptz not null default now(),
  published_by uuid,

  created_at timestamptz not null default now(),

  constraint marketplace_listing_versions_version_check
    check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$')
);

comment on table public.marketplace_listing_versions is
  'A frozen copy of a listing payload at the moment it was published.';

create unique index marketplace_listing_versions_unique
  on public.marketplace_listing_versions (listing_id, version);

create unique index marketplace_listing_versions_current
  on public.marketplace_listing_versions (listing_id)
  where is_current;

-- -----------------------------------------------------------------------------
-- What buyers say afterwards
-- -----------------------------------------------------------------------------

create table public.marketplace_reviews (
  id uuid primary key default public.generate_uuid_v7(),
  listing_id uuid not null,
  company_id uuid not null,

  rating smallint not null,
  title text,
  body text,
  -- Only someone who installed it may leave a review.
  install_id uuid,

  vendor_reply text,
  vendor_replied_at timestamptz,
  is_visible boolean not null default true,
  hidden_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint marketplace_reviews_rating_check
    check (rating between 1 and 5),
  constraint marketplace_reviews_body_check
    check (body is null or length(btrim(body)) between 10 and 2000),
  constraint marketplace_reviews_hidden_check
    check (is_visible or hidden_reason is not null)
);

comment on table public.marketplace_reviews is
  'A rating left by a tenant who installed a marketplace listing.';

create unique index marketplace_reviews_once
  on public.marketplace_reviews (listing_id, company_id)
  where deleted_at is null;

create index marketplace_reviews_listing_idx
  on public.marketplace_reviews (listing_id, created_at desc)
  where is_visible and deleted_at is null;

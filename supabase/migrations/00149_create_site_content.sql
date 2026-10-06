-- supabase/migrations/00149_create_site_content.sql
-- The marketing site, held in the database rather than in the source tree.
--
-- Every public page, its wording and its search engine metadata live here so
-- the people who write the copy can change it without a deployment. A page
-- that has never been edited still renders, because the seeded rows are the
-- real wording of the site rather than a placeholder.

create table public.site_pages (
  id uuid primary key default public.generate_uuid_v7(),

  slug text not null,
  title text not null,
  -- The page kind decides which layout renders it.
  page_type text not null default 'marketing',

  -- The body, as an ordered list of blocks the renderer understands.
  content_blocks jsonb not null default '[]'::jsonb,
  excerpt text,

  is_published boolean not null default false,
  published_at timestamptz,
  show_in_navigation boolean not null default false,
  navigation_label text,
  navigation_order smallint not null default 100,

  -- Search engine metadata, per page, editable by the marketing team.
  meta_title text,
  meta_description text,
  canonical_url text,
  open_graph_title text,
  open_graph_description text,
  open_graph_image_url text,
  structured_data jsonb not null default '{}'::jsonb,
  robots_directive text not null default 'index,follow',
  sitemap_priority numeric(2, 1) not null default 0.5,
  sitemap_change_frequency text not null default 'monthly',

  view_count bigint not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint site_pages_slug_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*$'),
  constraint site_pages_title_check
    check (length(btrim(title)) between 2 and 160),
  constraint site_pages_type_check
    check (page_type in ('marketing', 'legal', 'help', 'blog', 'landing')),
  constraint site_pages_blocks_check
    check (jsonb_typeof(content_blocks) = 'array'),
  constraint site_pages_meta_title_check
    check (meta_title is null or length(btrim(meta_title)) between 10 and 70),
  constraint site_pages_meta_description_check
    check (meta_description is null
           or length(btrim(meta_description)) between 50 and 160),
  constraint site_pages_robots_check
    check (robots_directive in ('index,follow', 'noindex,follow',
                                'index,nofollow', 'noindex,nofollow')),
  constraint site_pages_priority_check
    check (sitemap_priority between 0.0 and 1.0),
  constraint site_pages_frequency_check
    check (sitemap_change_frequency in ('always', 'hourly', 'daily', 'weekly',
                                        'monthly', 'yearly', 'never')),
  constraint site_pages_published_check
    check (not is_published or published_at is not null),
  constraint site_pages_navigation_check
    check (not show_in_navigation or navigation_label is not null)
);

comment on table public.site_pages is
  'The public pages of the marketing site, with their wording and metadata.';

create unique index site_pages_slug_unique
  on public.site_pages (slug)
  where deleted_at is null;

create index site_pages_published_idx
  on public.site_pages (page_type, navigation_order)
  where is_published and deleted_at is null;

create index site_pages_navigation_idx
  on public.site_pages (navigation_order)
  where show_in_navigation and is_published and deleted_at is null;

insert into public.site_pages (
  slug, title, page_type, excerpt, is_published, published_at,
  show_in_navigation, navigation_label, navigation_order, meta_title,
  meta_description, sitemap_priority, sitemap_change_frequency
)
values
  ('home', 'Send invoices. Get paid. Grow.', 'marketing',
   'Professional invoices in under a minute, online payments, reminders and inventory in one dashboard.',
   true, now(), false, null, 10,
   'KD SOLUTION IT: Smart Billing for Modern Business',
   'Create professional invoices in under a minute, accept card and wallet payments, send automatic reminders and watch the money arrive.',
   1.0, 'weekly'),
  ('features', 'Everything you need to bill with confidence', 'marketing',
   'Invoicing, payments, subscriptions, inventory and reporting, built to work together.',
   true, now(), true, 'Features', 20,
   'Features of KD SOLUTION IT invoicing software',
   'Professional invoices, online payments, recurring billing, client management, reminders, inventory and reports in a single dashboard.',
   0.9, 'monthly'),
  ('pricing', 'Simple pricing that grows with you', 'marketing',
   'Start free, upgrade when the invoices start piling up.',
   true, now(), true, 'Pricing', 30,
   'KD SOLUTION IT pricing and plans',
   'Start on the free plan and move up when you need more. Every paid plan comes with a fourteen day trial and no card up front.',
   0.9, 'monthly'),
  ('integrations', 'Works with what you already use', 'marketing',
   'Payment gateways, mail delivery, storage and accounting, connected in a few minutes.',
   true, now(), true, 'Integrations', 40,
   'Integrations: payments, email and storage',
   'Connect Stripe, PayPal, Paddle, bKash, Nagad and more, along with your mail provider and object storage, from the settings screen.',
   0.7, 'monthly'),
  ('contact', 'Talk to a person', 'marketing',
   'Questions about billing, migration or a plan? Write to us.',
   true, now(), true, 'Contact', 50,
   'Contact the KD SOLUTION IT team',
   'Ask us about plans, migrating your existing invoices, custom payment gateways or anything else. We answer every message.',
   0.5, 'yearly'),
  ('terms-of-service', 'Terms of Service', 'legal',
   'The agreement between you and KD SOLUTION IT.',
   true, now(), false, null, 60,
   'Terms of Service of KD SOLUTION IT',
   'The terms that govern your use of the KD SOLUTION IT billing platform, including payment, cancellation and acceptable use.',
   0.3, 'yearly'),
  ('privacy-policy', 'Privacy Policy', 'legal',
   'What we collect, why we collect it and how to have it removed.',
   true, now(), false, null, 70,
   'Privacy Policy of KD SOLUTION IT',
   'What personal data the platform collects, why it is needed, how long it is kept and how to export or delete everything we hold.',
   0.3, 'yearly'),
  ('cookie-policy', 'Cookie Policy', 'legal',
   'The cookies the site sets and how to refuse them.',
   true, now(), false, null, 80,
   'Cookie Policy of KD SOLUTION IT',
   'Which cookies the site sets, which are strictly necessary, which are for measurement, and how to change your mind at any time.',
   0.3, 'yearly'),
  ('refund-policy', 'Refund Policy', 'legal',
   'When a subscription payment is refunded, and how to ask.',
   true, now(), false, null, 90,
   'Refund Policy of KD SOLUTION IT',
   'When a subscription payment can be refunded, how long it takes, and what happens to your data after a cancellation.',
   0.3, 'yearly');

-- -----------------------------------------------------------------------------
-- Addresses that moved
-- -----------------------------------------------------------------------------

-- A marketing site accumulates old addresses. Sending them to the right page
-- with a permanent redirect keeps the search ranking that was earned.
create table public.url_redirects (
  id uuid primary key default public.generate_uuid_v7(),

  source_path text not null,
  target_path text not null,
  status_code smallint not null default 301,
  reason text,

  is_active boolean not null default true,
  hit_count bigint not null default 0,
  last_hit_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,

  constraint url_redirects_source_check
    check (source_path ~ '^/[A-Za-z0-9._~/-]*$'),
  constraint url_redirects_target_check
    check (target_path ~ '^(/[A-Za-z0-9._~/-]*|https://[A-Za-z0-9.-]+(/.*)?)$'),
  constraint url_redirects_status_check
    check (status_code in (301, 302, 307, 308)),
  constraint url_redirects_not_circular
    check (source_path <> target_path)
);

comment on table public.url_redirects is
  'Permanent and temporary redirects for addresses the site used to serve.';

create unique index url_redirects_source_unique
  on public.url_redirects (source_path)
  where is_active;

-- Follows a redirect and counts it, so dead rules can be retired.
create or replace function public.follow_redirect(p_source_path text)
returns table (target_path text, status_code smallint)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  update public.url_redirects as r
     set hit_count = r.hit_count + 1,
         last_hit_at = now()
   where r.source_path = p_source_path
     and r.is_active
  returning r.target_path, r.status_code;
end;
$$;

comment on function public.follow_redirect(text) is
  'Resolves an old address to its replacement and counts the hit.';

-- The sitemap, built from whatever is published right now.
create or replace function public.sitemap_entries()
returns table (
  path text,
  last_modified timestamptz,
  change_frequency text,
  priority numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when p.slug = 'home' then '/' else '/' || p.slug end,
         p.updated_at,
         p.sitemap_change_frequency,
         p.sitemap_priority
    from public.site_pages as p
   where p.is_published
     and p.deleted_at is null
     and p.robots_directive in ('index,follow', 'index,nofollow')
   order by p.sitemap_priority desc, p.slug;
$$;

comment on function public.sitemap_entries() is
  'Returns the published pages that belong in the sitemap.';

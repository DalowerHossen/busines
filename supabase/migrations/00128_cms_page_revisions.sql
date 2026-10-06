-- supabase/migrations/00128_cms_page_revisions.sql
-- Immutable CMS revision history for preview, rollback, and audit.

create table public.cms_page_revisions (
  id uuid primary key default extensions.gen_random_uuid(),
  page_id uuid not null references public.cms_pages (id) on delete cascade,
  company_id uuid null references public.companies (id),
  version integer not null,
  title text not null,
  excerpt text null,
  content jsonb not null,
  seo_title text null,
  seo_description text null,
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  constraint cms_page_revisions_version_positive check (version > 0),
  constraint cms_page_revisions_content_object check (jsonb_typeof(content) = 'object')
);

create unique index cms_page_revisions_page_version_key
  on public.cms_page_revisions (page_id, version);
create index cms_page_revisions_page_created_idx
  on public.cms_page_revisions (page_id, created_at desc);
create index cms_page_revisions_company_idx
  on public.cms_page_revisions (company_id, created_at desc)
  where company_id is not null;

comment on table public.cms_page_revisions is
  'Immutable versioned content snapshot for a CMS page.';

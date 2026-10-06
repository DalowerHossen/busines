-- supabase/migrations/00127_cms_pages.sql
-- CMS-editable platform and tenant pages. A NULL company_id represents a
-- platform page; a tenant value represents a scoped white-label override.

create table public.cms_pages (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid null references public.companies (id),
  page_key text not null,
  slug text not null,
  title text not null,
  excerpt text null,
  content jsonb not null default '{}'::jsonb,
  seo_title text null,
  seo_description text null,
  og_image_provider_file_id text null,
  status content_status not null default 'draft',
  published_at timestamptz null,
  scheduled_at timestamptz null,
  created_by_user_id uuid null references public.users (id),
  updated_by_user_id uuid null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint cms_pages_page_key_not_blank check (length(btrim(page_key)) > 0),
  constraint cms_pages_slug_not_blank check (length(btrim(slug)) > 0),
  constraint cms_pages_title_not_blank check (length(btrim(title)) > 0),
  constraint cms_pages_content_object check (jsonb_typeof(content) = 'object'),
  constraint cms_pages_published_fields_valid check (
    (status = 'published' and published_at is not null) or status <> 'published'
  )
);

create unique index cms_pages_platform_key
  on public.cms_pages (lower(page_key))
  where company_id is null and deleted_at is null;
create unique index cms_pages_company_key
  on public.cms_pages (company_id, lower(page_key))
  where company_id is not null and deleted_at is null;
create unique index cms_pages_platform_slug_key
  on public.cms_pages (lower(slug))
  where company_id is null and deleted_at is null;
create unique index cms_pages_company_slug_key
  on public.cms_pages (company_id, lower(slug))
  where company_id is not null and deleted_at is null;
create index cms_pages_status_idx
  on public.cms_pages (company_id, status, updated_at desc)
  where deleted_at is null;

comment on table public.cms_pages is
  'A CMS-managed platform page or tenant white-label page with structured content and SEO metadata.';

-- supabase/migrations/00129_blog_categories_tags.sql
-- Platform blog taxonomy. Tenant-specific content may use the same tables
-- through the company_id scope.

create table public.blog_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid null references public.companies (id),
  name text not null,
  slug text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint blog_categories_name_not_blank check (length(btrim(name)) > 0),
  constraint blog_categories_slug_not_blank check (length(btrim(slug)) > 0)
);

create unique index blog_categories_platform_slug_key
  on public.blog_categories (lower(slug))
  where company_id is null and deleted_at is null;
create unique index blog_categories_company_slug_key
  on public.blog_categories (company_id, lower(slug))
  where company_id is not null and deleted_at is null;

create table public.blog_tags (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid null references public.companies (id),
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint blog_tags_name_not_blank check (length(btrim(name)) > 0),
  constraint blog_tags_slug_not_blank check (length(btrim(slug)) > 0)
);

create unique index blog_tags_platform_slug_key
  on public.blog_tags (lower(slug))
  where company_id is null and deleted_at is null;
create unique index blog_tags_company_slug_key
  on public.blog_tags (company_id, lower(slug))
  where company_id is not null and deleted_at is null;

comment on table public.blog_categories is
  'A CMS blog category at platform or tenant scope.';
comment on table public.blog_tags is
  'A CMS blog tag at platform or tenant scope.';

-- supabase/migrations/00130_blog_posts.sql
-- Draftable and schedulable blog posts with cover media and SEO metadata.

create table public.blog_posts (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid null references public.companies (id),
  category_id uuid null references public.blog_categories (id) on delete set null,
  author_user_id uuid null references public.users (id),
  slug text not null,
  title text not null,
  excerpt text null,
  content jsonb not null default '{}'::jsonb,
  cover_provider_file_id text null,
  seo_title text null,
  seo_description text null,
  status content_status not null default 'draft',
  published_at timestamptz null,
  scheduled_at timestamptz null,
  view_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint blog_posts_slug_not_blank check (length(btrim(slug)) > 0),
  constraint blog_posts_title_not_blank check (length(btrim(title)) > 0),
  constraint blog_posts_content_object check (jsonb_typeof(content) = 'object'),
  constraint blog_posts_view_count_non_negative check (view_count >= 0),
  constraint blog_posts_published_fields_valid check (
    (status = 'published' and published_at is not null) or status <> 'published'
  )
);

create unique index blog_posts_platform_slug_key
  on public.blog_posts (lower(slug))
  where company_id is null and deleted_at is null;
create unique index blog_posts_company_slug_key
  on public.blog_posts (company_id, lower(slug))
  where company_id is not null and deleted_at is null;
create index blog_posts_status_idx
  on public.blog_posts (company_id, status, published_at desc)
  where deleted_at is null;
create index blog_posts_category_idx
  on public.blog_posts (category_id)
  where category_id is not null and deleted_at is null;

create table public.blog_post_tags (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid null references public.companies (id),
  post_id uuid not null references public.blog_posts (id) on delete cascade,
  tag_id uuid not null references public.blog_tags (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index blog_post_tags_post_tag_key
  on public.blog_post_tags (post_id, tag_id);
create index blog_post_tags_company_idx
  on public.blog_post_tags (company_id);

comment on table public.blog_posts is
  'A platform or tenant blog post with draft, publish, schedule, cover, taxonomy, and SEO fields.';
comment on table public.blog_post_tags is
  'Many-to-many blog post taxonomy link.';

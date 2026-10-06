-- supabase/migrations/00131_faq_items.sql
-- CMS-managed frequently asked questions for public pages and tenant
-- white-label sites.

create table public.faq_items (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid null references public.companies (id),
  category text not null default 'general',
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  published_at timestamptz null,
  created_by_user_id uuid null references public.users (id),
  updated_by_user_id uuid null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint faq_items_category_not_blank check (length(btrim(category)) > 0),
  constraint faq_items_question_not_blank check (length(btrim(question)) > 0),
  constraint faq_items_answer_not_blank check (length(btrim(answer)) > 0),
  constraint faq_items_sort_order_non_negative check (sort_order >= 0)
);

create index faq_items_scope_order_idx
  on public.faq_items (company_id, category, sort_order)
  where is_published = true and deleted_at is null;
create index faq_items_scope_updated_idx
  on public.faq_items (company_id, updated_at desc)
  where deleted_at is null;

comment on table public.faq_items is
  'A publishable CMS FAQ entry at platform or tenant scope.';

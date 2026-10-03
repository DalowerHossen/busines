-- supabase/migrations/00030_invoice_templates.sql
-- A reusable visual layout for rendering an invoice or estimate PDF (for
-- example "Classic" or "Modern Blue"). company_id is null for a
-- platform-provided built-in template available to every company, and set
-- for a company's own custom template. This is deliberately the simple
-- per-document layout selector only -- the much larger buy/sell Template
-- Marketplace (author profiles, ratings, revenue share, moderation) is a
-- separate system arriving in Phase 61 and will extend this same table
-- rather than replace it.
--
-- Also fulfils the forward reference left open in 00023_invoices.sql: now
-- that this table exists, the real foreign key is added on
-- invoices.template_id.

create table public.invoice_templates (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid null references public.companies (id),
  name text not null,
  slug text not null,
  is_built_in boolean not null default false,
  layout_config jsonb not null default '{}'::jsonb,
  thumbnail_provider_file_id text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint invoice_templates_company_id_matches_built_in check (
    (is_built_in and company_id is null) or (not is_built_in and company_id is not null)
  )
);

-- Two partial unique indexes, same reasoning as system_settings in Phase
-- 5: a plain UNIQUE (company_id, slug) would not dedupe built-in rows
-- because company_id is NULL there and SQL NULLs never compare equal.
create unique index invoice_templates_built_in_slug_key
  on public.invoice_templates (slug)
  where company_id is null;
create unique index invoice_templates_company_slug_key
  on public.invoice_templates (company_id, slug)
  where company_id is not null;
create index invoice_templates_company_id_idx
  on public.invoice_templates (company_id)
  where deleted_at is null;

comment on table public.invoice_templates is
  'Reusable invoice/estimate PDF layouts. A null company_id is a platform-provided built-in template; otherwise a company''s own custom template.';

alter table public.invoices
  add constraint invoices_template_id_fkey
  foreign key (template_id) references public.invoice_templates (id);

-- supabase/migrations/00083_email_templates.sql
-- Branded transactional email templates. Platform templates have a NULL
-- company_id; tenant templates override them through the scoped unique key.

create table public.email_templates (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid null references public.companies (id),
  template_key text not null,
  display_name text not null,
  category text not null default 'transactional',
  subject_template text not null,
  body_html text not null,
  body_text text not null,
  variable_names text[] not null default '{}',
  is_active boolean not null default true,
  version integer not null default 1,
  created_by_user_id uuid null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint email_templates_key_not_blank check (length(btrim(template_key)) > 0),
  constraint email_templates_display_name_not_blank check (length(btrim(display_name)) > 0),
  constraint email_templates_category_valid check (
    category in ('transactional', 'authentication', 'subscription', 'marketing', 'system')
  ),
  constraint email_templates_version_positive check (version > 0),
  constraint email_templates_scope_creator check (
    company_id is not null or created_by_user_id is null
  )
);

create unique index email_templates_platform_key
  on public.email_templates (lower(template_key))
  where company_id is null and deleted_at is null;
create unique index email_templates_company_key
  on public.email_templates (company_id, lower(template_key))
  where company_id is not null and deleted_at is null;
create index email_templates_company_id_idx
  on public.email_templates (company_id)
  where deleted_at is null;
create index email_templates_active_idx
  on public.email_templates (company_id, is_active)
  where is_active = true and deleted_at is null;

comment on table public.email_templates is
  'A branded, versioned email template managed at platform or tenant scope.';

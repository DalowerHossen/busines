-- supabase/migrations/00147_contract_templates.sql
-- Reusable contract templates with structured merge-field definitions.

create table public.contract_templates (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid null references public.companies (id),
  name text not null,
  description text null,
  content jsonb not null default '{}'::jsonb,
  merge_fields text[] not null default '{}',
  is_active boolean not null default true,
  created_by_user_id uuid null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint contract_templates_name_not_blank check (length(btrim(name)) > 0),
  constraint contract_templates_content_object check (jsonb_typeof(content) = 'object')
);

create unique index contract_templates_platform_name_key
  on public.contract_templates (lower(name))
  where company_id is null and deleted_at is null;
create unique index contract_templates_company_name_key
  on public.contract_templates (company_id, lower(name))
  where company_id is not null and deleted_at is null;
create index contract_templates_scope_active_idx
  on public.contract_templates (company_id, is_active)
  where is_active = true and deleted_at is null;

comment on table public.contract_templates is
  'A platform or tenant contract template with merge-field metadata.';

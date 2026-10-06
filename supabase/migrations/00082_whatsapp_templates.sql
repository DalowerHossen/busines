-- supabase/migrations/00082_whatsapp_templates.sql
-- WhatsApp message templates submitted to and synchronised with the
-- configured provider. A NULL company_id represents a platform-managed
-- template available to eligible tenants.

create table public.whatsapp_templates (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid null references public.companies (id),
  template_name text not null,
  language_code text not null default 'en_US',
  category whatsapp_template_category not null default 'utility',
  status whatsapp_template_status not null default 'draft',
  provider_template_id text null,
  components jsonb not null default '{}'::jsonb,
  rejection_reason text null,
  submitted_at timestamptz null,
  approved_at timestamptz null,
  created_by_user_id uuid null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint whatsapp_templates_name_not_blank check (length(btrim(template_name)) > 0),
  constraint whatsapp_templates_language_not_blank check (length(btrim(language_code)) > 0),
  constraint whatsapp_templates_components_object check (jsonb_typeof(components) = 'object'),
  constraint whatsapp_templates_scope_creator check (
    company_id is not null or created_by_user_id is null
  )
);

create unique index whatsapp_templates_platform_name_key
  on public.whatsapp_templates (lower(template_name), lower(language_code))
  where company_id is null and deleted_at is null;
create unique index whatsapp_templates_company_name_key
  on public.whatsapp_templates (company_id, lower(template_name), lower(language_code))
  where company_id is not null and deleted_at is null;
create unique index whatsapp_templates_provider_id_key
  on public.whatsapp_templates (provider_template_id)
  where provider_template_id is not null and deleted_at is null;
create index whatsapp_templates_company_id_idx
  on public.whatsapp_templates (company_id)
  where deleted_at is null;
create index whatsapp_templates_status_idx
  on public.whatsapp_templates (status)
  where deleted_at is null;

comment on table public.whatsapp_templates is
  'A platform or tenant WhatsApp template with provider approval state and structured component data.';

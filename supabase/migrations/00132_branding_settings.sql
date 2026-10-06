-- supabase/migrations/00132_branding_settings.sql
-- CSS-variable branding values for the platform and each tenant. Uploaded
-- binary assets remain in the configured storage provider.

create table public.branding_settings (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid null references public.companies (id),
  brand_name text not null,
  logo_provider_file_id text null,
  favicon_provider_file_id text null,
  primary_color text not null default '#1d4ed8',
  secondary_color text not null default '#0f172a',
  accent_color text not null default '#38bdf8',
  font_family text not null default 'Inter',
  light_theme jsonb not null default '{}'::jsonb,
  dark_theme jsonb not null default '{}'::jsonb,
  custom_domain text null,
  is_active boolean not null default true,
  created_by_user_id uuid null references public.users (id),
  updated_by_user_id uuid null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branding_settings_brand_name_not_blank check (length(btrim(brand_name)) > 0),
  constraint branding_settings_light_theme_object check (jsonb_typeof(light_theme) = 'object'),
  constraint branding_settings_dark_theme_object check (jsonb_typeof(dark_theme) = 'object')
);

create unique index branding_settings_platform_key
  on public.branding_settings ((company_id is null))
  where company_id is null;
create unique index branding_settings_company_key
  on public.branding_settings (company_id)
  where company_id is not null;
create unique index branding_settings_domain_key
  on public.branding_settings (lower(custom_domain))
  where custom_domain is not null;
create index branding_settings_active_idx
  on public.branding_settings (company_id, is_active)
  where is_active = true;

comment on table public.branding_settings is
  'Platform or tenant CSS-variable branding configuration with storage-provider asset references.';

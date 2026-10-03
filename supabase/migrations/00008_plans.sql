-- supabase/migrations/00008_plans.sql
-- Subscription plan definitions. Seeded with the default tiers in Phase 19
-- (src/config/plans.ts holds the fallback/seed values); every field here is
-- editable by a super_admin from the admin panel after the first deploy.

create table public.plans (
  id uuid primary key default extensions.gen_random_uuid(),
  tier_id text not null,
  name text not null,
  monthly_price_amount numeric(14, 2) not null default 0,
  yearly_price_amount numeric(14, 2) not null default 0,
  currency_code text not null default 'USD',
  max_clients integer null,
  max_invoices_per_month integer null,
  max_staff_seats integer null,
  max_storage_mb integer null,
  max_whatsapp_messages_per_month integer null,
  allows_custom_branding boolean not null default false,
  allows_api_access boolean not null default false,
  allows_multi_currency boolean not null default false,
  is_publicly_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index plans_tier_id_key on public.plans (tier_id) where deleted_at is null;
create index plans_sort_order_idx on public.plans (sort_order);

comment on table public.plans is
  'Subscription plan definitions. A null limit column means unlimited. The free tier (tier_id = ''free'') is always assigned to a new company on signup.';

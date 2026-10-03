-- supabase/migrations/00009_subscriptions.sql
-- A company's subscription to a plan over time. The company's *current*
-- plan is derived by querying for the row with status in
-- ('trialing', 'active') rather than storing a plan_id directly on
-- companies, which keeps this as the single source of truth for billing
-- history and avoids a circular-dependency at migration time.

create table public.subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  plan_id uuid not null references public.plans (id),
  status subscription_status not null default 'trialing',
  billing_cycle billing_cycle not null default 'monthly',
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz null,
  trial_ends_at timestamptz null,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_company_id_idx on public.subscriptions (company_id);
create index subscriptions_status_idx on public.subscriptions (status);
-- At most one subscription may be actively driving a company's plan.
create unique index subscriptions_one_active_per_company
  on public.subscriptions (company_id)
  where status in ('trialing', 'active', 'past_due');

comment on table public.subscriptions is
  'Billing history for a company''s plan. A company''s current plan is whichever row has status trialing/active/past_due.';

-- supabase/migrations/00151_create_landing_experiments.sql
-- Landing pages and the experiments that improve them.
--
-- A landing page is a site page with a campaign attached: its own address,
-- its own wording and its own conversion goal. An experiment splits the
-- traffic between variants of that page and keeps the result, so a decision
-- about wording is settled by numbers rather than by opinion.

create table public.landing_pages (
  id uuid primary key default public.generate_uuid_v7(),

  slug text not null,
  name text not null,
  headline text not null,
  subheadline text,
  content_blocks jsonb not null default '[]'::jsonb,

  call_to_action_label text not null default 'Start free',
  call_to_action_path text not null default '/register',
  -- The event that counts as success for this page.
  goal_event_name text not null default 'signup_completed',

  -- Where the traffic is expected to come from, prefilled into the links.
  default_utm_source text,
  default_utm_medium text,
  default_utm_campaign text,

  meta_title text,
  meta_description text,
  open_graph_image_url text,

  is_published boolean not null default false,
  published_at timestamptz,

  view_count bigint not null default 0,
  conversion_count bigint not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint landing_pages_slug_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint landing_pages_name_check
    check (length(btrim(name)) between 2 and 80),
  constraint landing_pages_headline_check
    check (length(btrim(headline)) between 5 and 120),
  constraint landing_pages_blocks_check
    check (jsonb_typeof(content_blocks) = 'array'),
  constraint landing_pages_cta_check
    check (call_to_action_path ~ '^/[A-Za-z0-9._~/-]*$'),
  constraint landing_pages_goal_check
    check (goal_event_name ~ '^[a-z][a-z0-9_]{2,60}$'),
  constraint landing_pages_published_check
    check (not is_published or published_at is not null),
  constraint landing_pages_counts_check
    check (view_count >= 0 and conversion_count >= 0)
);

comment on table public.landing_pages is
  'Campaign landing pages, each with its own wording and conversion goal.';

create unique index landing_pages_slug_unique
  on public.landing_pages (slug)
  where deleted_at is null;

create index landing_pages_published_idx
  on public.landing_pages (published_at desc)
  where is_published and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Experiments
-- -----------------------------------------------------------------------------

create table public.experiments (
  id uuid primary key default public.generate_uuid_v7(),

  key text not null,
  name text not null,
  hypothesis text,
  -- What is being varied: a landing page, a pricing table, a button.
  surface text not null default 'landing_page',
  landing_page_id uuid,

  goal_event_name text not null,
  status text not null default 'draft',

  -- Traffic that takes part at all. The rest always sees the control.
  traffic_percentage smallint not null default 100,

  started_at timestamptz,
  ended_at timestamptz,
  winning_variant_id uuid,
  conclusion text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint experiments_key_check
    check (key ~ '^[a-z][a-z0-9_]{2,60}$'),
  constraint experiments_name_check
    check (length(btrim(name)) between 2 and 80),
  constraint experiments_surface_check
    check (surface in ('landing_page', 'pricing', 'signup', 'checkout', 'email')),
  constraint experiments_goal_check
    check (goal_event_name ~ '^[a-z][a-z0-9_]{2,60}$'),
  constraint experiments_status_check
    check (status in ('draft', 'running', 'paused', 'concluded', 'abandoned')),
  constraint experiments_traffic_check
    check (traffic_percentage between 1 and 100),
  constraint experiments_window_check
    check (ended_at is null or started_at is null or ended_at > started_at),
  constraint experiments_running_check
    check (status <> 'running' or started_at is not null),
  constraint experiments_concluded_check
    check (status <> 'concluded' or ended_at is not null)
);

comment on table public.experiments is
  'A question about the site, answered by splitting traffic between variants.';

create unique index experiments_key_unique
  on public.experiments (key)
  where deleted_at is null;

create index experiments_running_idx
  on public.experiments (surface)
  where status = 'running' and deleted_at is null;

create table public.experiment_variants (
  id uuid primary key default public.generate_uuid_v7(),
  experiment_id uuid not null,

  key text not null,
  name text not null,
  is_control boolean not null default false,
  -- How the traffic is divided. The weights of one experiment add up to 100.
  weight smallint not null default 50,

  -- What this variant changes, read by the renderer.
  overrides jsonb not null default '{}'::jsonb,

  assignment_count integer not null default 0,
  conversion_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint experiment_variants_key_check
    check (key ~ '^[a-z][a-z0-9_]{0,30}$'),
  constraint experiment_variants_name_check
    check (length(btrim(name)) between 1 and 60),
  constraint experiment_variants_weight_check
    check (weight between 1 and 100),
  constraint experiment_variants_overrides_check
    check (jsonb_typeof(overrides) = 'object'),
  constraint experiment_variants_counts_check
    check (assignment_count >= 0 and conversion_count >= 0
           and conversion_count <= assignment_count)
);

comment on table public.experiment_variants is
  'One version of the thing being tested, with the share of traffic it takes.';

create unique index experiment_variants_key_unique
  on public.experiment_variants (experiment_id, key);

create unique index experiment_variants_single_control
  on public.experiment_variants (experiment_id)
  where is_control;

-- Who saw which variant. One assignment per visitor per experiment, so a
-- visitor never sees the page change under them between two page loads.
create table public.experiment_assignments (
  id uuid primary key default public.generate_uuid_v7(),
  experiment_id uuid not null,
  variant_id uuid not null,

  visitor_token text not null,
  user_id uuid,

  assigned_at timestamptz not null default now(),
  converted_at timestamptz,

  constraint experiment_assignments_token_check
    check (length(btrim(visitor_token)) between 16 and 128)
);

comment on table public.experiment_assignments is
  'The variant one visitor was shown, kept so the page never changes on them.';

create unique index experiment_assignments_unique
  on public.experiment_assignments (experiment_id, visitor_token);

create index experiment_assignments_variant_idx
  on public.experiment_assignments (variant_id, assigned_at);

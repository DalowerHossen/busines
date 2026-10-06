-- supabase/migrations/00032_create_tags_and_saved_views.sql
-- Tags and saved list views.
--
-- Tags are shared across the record types that benefit from them, so a label
-- such as "key account" is defined once. Saved views store the filters, column
-- choice and sort order a user applies to a list, either privately or for the
-- whole team.

create table public.tags (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  name text not null,
  slug text not null,
  color text not null default '#1d4ed8',
  description text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint tags_name_check
    check (length(btrim(name)) between 1 and 40),
  constraint tags_slug_check
    check (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  constraint tags_color_check
    check (color ~ '^#[0-9A-Fa-f]{6}$')
);

comment on table public.tags is
  'Reusable labels applied to clients, products and documents.';

create unique index tags_slug_unique
  on public.tags (company_id, slug)
  where deleted_at is null;

create index tags_company_idx
  on public.tags (company_id)
  where deleted_at is null;

create table public.taggings (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  tag_id uuid not null,

  entity_type public.taggable_entity not null,
  entity_id uuid not null,

  created_at timestamptz not null default now(),
  created_by uuid
);

comment on table public.taggings is
  'Links a tag to one record, identified by its type and identifier.';

create unique index taggings_unique
  on public.taggings (tag_id, entity_type, entity_id);

create index taggings_entity_idx
  on public.taggings (company_id, entity_type, entity_id);

-- -----------------------------------------------------------------------------
-- Saved views
-- -----------------------------------------------------------------------------

create table public.saved_views (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  -- Null when the view is shared with the whole company.
  owner_user_id uuid,

  entity_type public.taggable_entity not null,
  name text not null,

  filters jsonb not null default '{}'::jsonb,
  visible_columns jsonb not null default '[]'::jsonb,
  sort_order jsonb not null default '[]'::jsonb,

  is_shared boolean not null default false,
  is_default boolean not null default false,
  position smallint not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint saved_views_name_check
    check (length(btrim(name)) between 1 and 60),
  constraint saved_views_filters_check
    check (jsonb_typeof(filters) = 'object'),
  constraint saved_views_columns_check
    check (jsonb_typeof(visible_columns) = 'array'),
  constraint saved_views_sort_check
    check (jsonb_typeof(sort_order) = 'array'),
  constraint saved_views_ownership_check
    check (is_shared or owner_user_id is not null)
);

comment on table public.saved_views is
  'Stored filter, column and sort combinations for a list screen.';

create unique index saved_views_name_unique
  on public.saved_views (company_id, entity_type, coalesce(owner_user_id, company_id), name)
  where deleted_at is null;

create index saved_views_lookup_idx
  on public.saved_views (company_id, entity_type, position)
  where deleted_at is null;

create index saved_views_owner_idx
  on public.saved_views (owner_user_id)
  where owner_user_id is not null and deleted_at is null;

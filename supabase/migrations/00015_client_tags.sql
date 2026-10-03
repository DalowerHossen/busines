-- supabase/migrations/00015_client_tags.sql
-- Free-form labels attachable to one or more clients, distinct from a
-- client_group which a client can only belong to one of at a time. The tag
-- definitions and their many-to-many assignment to clients are kept in
-- this one file as a single logical unit.

create table public.client_tags (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name text not null,
  color text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index client_tags_company_id_idx on public.client_tags (company_id) where deleted_at is null;

comment on table public.client_tags is
  'Free-form label definitions. A client may carry any number of tags at once, via client_tag_assignments.';

create table public.client_tag_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  client_id uuid not null references public.clients (id),
  tag_id uuid not null references public.client_tags (id),
  created_at timestamptz not null default now()
);

create unique index client_tag_assignments_client_tag_key
  on public.client_tag_assignments (client_id, tag_id);
create index client_tag_assignments_company_id_idx on public.client_tag_assignments (company_id);
create index client_tag_assignments_tag_id_idx on public.client_tag_assignments (tag_id);

comment on table public.client_tag_assignments is
  'Many-to-many join between clients and client_tags.';

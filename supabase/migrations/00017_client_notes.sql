-- supabase/migrations/00017_client_notes.sql
-- A private, internal, authored note left on a client record. Never
-- visible to the client themselves (unlike the quick notes field on
-- clients, this table keeps a full author + timestamp per entry).

create table public.client_notes (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  client_id uuid not null references public.clients (id),
  author_user_id uuid not null references public.users (id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index client_notes_company_id_idx on public.client_notes (company_id) where deleted_at is null;
create index client_notes_client_id_idx on public.client_notes (client_id) where deleted_at is null;

comment on table public.client_notes is
  'Internal, authored notes on a client record. Never shown to the client themselves.';

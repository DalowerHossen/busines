-- supabase/migrations/00140_support_ticket_messages.sql
-- Conversation messages for a support ticket. Internal notes are visible to
-- support staff only and are never sent to the requester.

create table public.support_ticket_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_user_id uuid null references public.users (id),
  author_email citext null,
  body text not null,
  is_internal_note boolean not null default false,
  attachment_provider_file_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint support_ticket_messages_body_not_blank check (length(btrim(body)) > 0),
  constraint support_ticket_messages_author_valid check (
    author_user_id is not null or author_email is not null
  )
);

create index support_ticket_messages_ticket_time_idx
  on public.support_ticket_messages (ticket_id, created_at);

comment on table public.support_ticket_messages is
  'A support conversation message or internal staff note.';

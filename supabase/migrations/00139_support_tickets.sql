-- supabase/migrations/00139_support_tickets.sql
-- Support ticket inbox. A NULL company_id represents a public/platform
-- ticket; a tenant value scopes the ticket to one company.

create table public.support_tickets (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid null references public.companies (id),
  ticket_number text not null,
  requester_user_id uuid null references public.users (id),
  requester_email citext not null,
  subject text not null,
  category text not null default 'general',
  status support_ticket_status not null default 'open',
  priority support_ticket_priority not null default 'normal',
  assigned_to_user_id uuid null references public.users (id),
  last_replied_at timestamptz null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint support_tickets_number_not_blank check (length(btrim(ticket_number)) > 0),
  constraint support_tickets_email_not_blank check (length(btrim(requester_email::text)) > 0),
  constraint support_tickets_subject_not_blank check (length(btrim(subject)) > 0),
  constraint support_tickets_category_not_blank check (length(btrim(category)) > 0)
);

create unique index support_tickets_number_key
  on public.support_tickets (ticket_number)
  where deleted_at is null;
create index support_tickets_inbox_idx
  on public.support_tickets (company_id, status, priority, updated_at desc)
  where deleted_at is null;
create index support_tickets_requester_idx
  on public.support_tickets (requester_email, created_at desc)
  where deleted_at is null;

comment on table public.support_tickets is
  'A public or tenant support request routed through the platform inbox.';

-- supabase/migrations/00084_notifications.sql
-- In-app notification records. Additional channel delivery is tracked by
-- message_deliveries; delivered_channels is a compact projection used by
-- the notification centre.

create table public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  recipient_user_id uuid not null references public.users (id),
  type notification_type not null,
  title text not null,
  body text not null,
  link_path text null,
  delivered_channels communication_channel[] not null default array['in_app']::communication_channel[],
  read_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint notifications_title_not_blank check (length(btrim(title)) > 0),
  constraint notifications_body_not_blank check (length(btrim(body)) > 0),
  constraint notifications_channels_not_empty check (cardinality(delivered_channels) > 0)
);

create index notifications_recipient_unread_idx
  on public.notifications (company_id, recipient_user_id, created_at desc)
  where read_at is null and deleted_at is null;
create index notifications_company_id_idx
  on public.notifications (company_id)
  where deleted_at is null;
create index notifications_type_idx
  on public.notifications (company_id, type)
  where deleted_at is null;

comment on table public.notifications is
  'A tenant-scoped in-app notification for one platform user, with a projection of channels already delivered.';

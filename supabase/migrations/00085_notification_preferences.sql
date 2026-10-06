-- supabase/migrations/00085_notification_preferences.sql
-- Per-user opt-in preferences. The application must honour these rows before
-- sending optional email, WhatsApp, SMS, Telegram, or Viber notifications.

create table public.notification_preferences (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type notification_type not null,
  channel communication_channel not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_channel_valid check (channel <> 'in_app')
);

create unique index notification_preferences_user_type_channel_key
  on public.notification_preferences (user_id, type, channel);
create index notification_preferences_user_id_idx
  on public.notification_preferences (user_id, is_enabled);

comment on table public.notification_preferences is
  'A user-level opt-in or opt-out preference for non-in-app notification delivery.';

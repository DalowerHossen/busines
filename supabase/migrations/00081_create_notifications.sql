-- supabase/migrations/00081_create_notifications.sql
-- In application notifications and the preferences that govern them.
--
-- A notification is addressed to a person, not to a tenant, because an
-- accountant works across several companies and must see each one in the same
-- list without crossing the data between them.

create table public.notifications (
  id uuid primary key default public.generate_uuid_v7(),

  user_id uuid not null,
  -- The tenant the notification is about, when there is one.
  company_id uuid,

  notification_kind public.notification_type not null,
  title text not null,
  body text not null,
  action_url text,
  action_label text,

  severity text not null default 'info',
  icon_key text,

  related_entity_type text,
  related_entity_id uuid,

  read_at timestamptz,
  dismissed_at timestamptz,
  -- Set when the same notification was also emailed or pushed.
  message_id uuid,

  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notifications_title_check
    check (length(btrim(title)) between 2 and 120),
  constraint notifications_body_check
    check (length(btrim(body)) between 2 and 600),
  constraint notifications_severity_check
    check (severity in ('info', 'success', 'warning', 'critical')),
  constraint notifications_action_check
    check (action_url is null or action_label is not null)
);

comment on table public.notifications is
  'Messages shown inside the application to one signed in person.';

create index notifications_user_idx
  on public.notifications (user_id, created_at desc);

create index notifications_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null and dismissed_at is null;

create index notifications_company_idx
  on public.notifications (company_id, created_at desc)
  where company_id is not null;

-- -----------------------------------------------------------------------------
-- Preferences
-- -----------------------------------------------------------------------------

-- One row per person, per notification kind, per channel. A missing row means
-- the platform default applies, which keeps the table small for people who
-- never change anything.
create table public.notification_preferences (
  id uuid primary key default public.generate_uuid_v7(),
  user_id uuid not null,
  company_id uuid,

  notification_kind public.notification_type not null,
  channel public.message_channel not null default 'in_app',
  is_enabled boolean not null default true,

  -- Digest instead of one message per event.
  digest_frequency text not null default 'immediate',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notification_preferences_digest_check
    check (digest_frequency in ('immediate', 'hourly', 'daily', 'weekly', 'never'))
);

comment on table public.notification_preferences is
  'Per person choice of which events arrive, on which channel, how often.';

create unique index notification_preferences_unique
  on public.notification_preferences (
    user_id,
    coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
    notification_kind,
    channel
  );

create index notification_preferences_user_idx
  on public.notification_preferences (user_id);

-- -----------------------------------------------------------------------------
-- Delivery
-- -----------------------------------------------------------------------------

-- Reports whether a person wants an event on a channel.
create or replace function public.wants_notification(
  p_user_id uuid,
  p_kind public.notification_type,
  p_channel public.message_channel default 'in_app',
  p_company_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_enabled boolean;
begin
  select is_enabled
    into v_enabled
    from public.notification_preferences
   where user_id = p_user_id
     and notification_kind = p_kind
     and channel = p_channel
     and coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = coalesce(p_company_id, '00000000-0000-0000-0000-000000000000'::uuid)
   limit 1;

  -- A security alert is never silenced, whatever the preference says.
  if p_kind = 'security_alert' then
    return true;
  end if;

  return coalesce(v_enabled, true);
end;
$$;

comment on function public.wants_notification(
  uuid, public.notification_type, public.message_channel, uuid
) is 'Returns true when a person still wants this event on this channel.';

-- Raises a notification, honouring the preference of the recipient.
create or replace function public.notify_user(
  p_user_id uuid,
  p_kind public.notification_type,
  p_title text,
  p_body text,
  p_company_id uuid default null,
  p_action_url text default null,
  p_action_label text default null,
  p_severity text default 'info'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.wants_notification(p_user_id, p_kind, 'in_app', p_company_id) then
    return null;
  end if;

  if not exists (
    select 1 from public.users where id = p_user_id and deleted_at is null
  ) then
    return null;
  end if;

  insert into public.notifications (
    user_id, company_id, notification_kind, title, body, action_url,
    action_label, severity
  )
  values (
    p_user_id, p_company_id, p_kind, p_title, p_body, p_action_url,
    p_action_label, p_severity
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.notify_user(
  uuid, public.notification_type, text, text, uuid, text, text, text
) is 'Raises an in application notification when the recipient wants it.';

-- Notifies everyone who works inside one tenant.
create or replace function public.notify_company(
  p_company_id uuid,
  p_kind public.notification_type,
  p_title text,
  p_body text,
  p_action_url text default null,
  p_action_label text default null,
  p_severity text default 'info'
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select id
      from public.users
     where company_id = p_company_id
       and role in ('owner', 'staff')
       and status = 'active'
       and deleted_at is null
  loop
    if public.notify_user(
         v_row.id, p_kind, p_title, p_body, p_company_id, p_action_url,
         p_action_label, p_severity
       ) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

comment on function public.notify_company(
  uuid, public.notification_type, text, text, text, text, text
) is 'Raises the same notification for every active member of a tenant.';

-- Marks the unread notifications of the caller as read.
create or replace function public.mark_notifications_read(
  p_notification_ids uuid[] default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := public.current_user_id();
  v_count integer;
begin
  if v_user_id is null then
    return 0;
  end if;

  update public.notifications
     set read_at = now(),
         updated_at = now()
   where user_id = v_user_id
     and read_at is null
     and (p_notification_ids is null or id = any (p_notification_ids));

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

comment on function public.mark_notifications_read(uuid[]) is
  'Marks the notifications of the signed in person as read.';

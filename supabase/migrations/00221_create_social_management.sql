-- supabase/migrations/00221_create_social_management.sql
-- Writing, approving and connecting the accounts a business posts from.
--
-- The publishing machinery already exists: a calendar, a queue, a record of
-- what each network said. What was missing is the human end of it, which is
-- where almost every mistake happens. Three rules are enforced here rather
-- than left to a screen.
--
-- A token for a social account is a credential like any other, so it is
-- encrypted before it arrives and never read back.
--
-- A post that is already out cannot be edited into saying something else.
-- The network has it; pretending otherwise only makes the record dishonest.
--
-- An automatic rule cannot run until somebody has looked at it, because a
-- rule that posts to a public account the moment an invoice is paid will
-- eventually post something a business did not want said.

create or replace function public.save_social_channel(
  p_company_id uuid,
  p_platform text,
  p_account_name text,
  p_account_handle text default null,
  p_external_account_id text default null,
  p_access_token_encrypted text default null,
  p_refresh_token_encrypted text default null,
  p_masked_hint text default null,
  p_token_expires_at timestamptz default null,
  p_granted_scopes text[] default array[]::text[],
  p_channel_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_channel_id uuid;
begin
  if not (public.is_service_role()
          or (p_company_id is null and public.is_super_admin())
          or (p_company_id is not null and public.is_company_owner(p_company_id))) then
    raise exception 'Only an owner may connect an account to post from'
      using errcode = '42501';
  end if;

  if p_channel_id is null then
    insert into public.social_channels (
      company_id, platform, account_name, account_handle, external_account_id,
      access_token_encrypted, refresh_token_encrypted, masked_hint,
      token_expires_at, granted_scopes, is_connected, created_by, updated_by
    )
    values (
      p_company_id, p_platform, btrim(p_account_name),
      nullif(btrim(coalesce(p_account_handle, '')), ''),
      nullif(btrim(coalesce(p_external_account_id, '')), ''),
      p_access_token_encrypted, p_refresh_token_encrypted, p_masked_hint,
      p_token_expires_at, coalesce(p_granted_scopes, array[]::text[]),
      p_access_token_encrypted is not null,
      public.current_user_id(), public.current_user_id()
    )
    returning id into v_channel_id;

    return v_channel_id;
  end if;

  update public.social_channels
     set account_name = btrim(p_account_name),
         account_handle = nullif(btrim(coalesce(p_account_handle, '')), ''),
         external_account_id =
           coalesce(nullif(btrim(coalesce(p_external_account_id, '')), ''),
                    external_account_id),
         access_token_encrypted =
           coalesce(p_access_token_encrypted, access_token_encrypted),
         refresh_token_encrypted =
           coalesce(p_refresh_token_encrypted, refresh_token_encrypted),
         masked_hint = coalesce(p_masked_hint, masked_hint),
         token_expires_at = coalesce(p_token_expires_at, token_expires_at),
         granted_scopes = coalesce(p_granted_scopes, granted_scopes),
         is_connected =
           coalesce(p_access_token_encrypted, access_token_encrypted) is not null,
         connection_error = null,
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_channel_id
     and deleted_at is null;

  if not found then
    raise exception 'That account was not found' using errcode = 'P0002';
  end if;

  return p_channel_id;
end;
$$;

comment on function public.save_social_channel(
  uuid, text, text, text, text, text, text, text, timestamptz, text[], uuid
) is 'Connects an account to post from, keeping its token encrypted.';

create or replace function public.disconnect_social_channel(p_channel_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_channel public.social_channels%rowtype;
begin
  select * into v_channel
    from public.social_channels
   where id = p_channel_id and deleted_at is null;

  if not found then
    return false;
  end if;

  if not (public.is_service_role()
          or (v_channel.company_id is null and public.is_super_admin())
          or (v_channel.company_id is not null
              and public.is_company_owner(v_channel.company_id))) then
    raise exception 'Only an owner may disconnect an account' using errcode = '42501';
  end if;

  -- Everything already published stays published; what goes is our ability
  -- to post again.
  update public.social_channels
     set access_token_encrypted = null,
         refresh_token_encrypted = null,
         masked_hint = null,
         is_connected = false,
         is_active = false,
         token_expires_at = null,
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_channel_id;

  return true;
end;
$$;

comment on function public.disconnect_social_channel(uuid) is
  'Stops posting from an account without touching what it already published.';

create or replace function public.social_channel_list(p_company_id uuid default null)
returns table (
  channel_id uuid,
  platform text,
  account_name text,
  account_handle text,
  is_connected boolean,
  is_active boolean,
  masked_hint text,
  token_expires_at timestamptz,
  connection_error text,
  last_published_at timestamptz,
  post_count integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_company_id is null then
    if not (public.is_service_role() or public.is_super_admin()) then
      raise exception 'Only the platform team may read the platform accounts'
        using errcode = '42501';
    end if;
  elsif not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You cannot read the accounts of another business'
      using errcode = '42501';
  end if;

  return query
    select c.id, c.platform, c.account_name, c.account_handle, c.is_connected,
           c.is_active, c.masked_hint, c.token_expires_at, c.connection_error,
           c.last_published_at, c.post_count
      from public.social_channels as c
     where c.company_id is not distinct from p_company_id
       and c.deleted_at is null
     order by c.platform, c.account_name;
end;
$$;

comment on function public.social_channel_list(uuid) is
  'Lists the accounts a business can post from, showing a hint rather than a token.';

-- -----------------------------------------------------------------------------
-- Writing a post
-- -----------------------------------------------------------------------------

create or replace function public.save_social_post(
  p_company_id uuid,
  p_title text,
  p_body text,
  p_link_url text default null,
  p_hashtags text[] default array[]::text[],
  p_post_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_post_id uuid;
  v_status text;
begin
  if not (public.is_service_role()
          or (p_company_id is null and public.is_super_admin())
          or (p_company_id is not null
              and public.can_write_company_data(p_company_id))) then
    raise exception 'You are not allowed to write posts for this business'
      using errcode = '42501';
  end if;

  if p_post_id is null then
    insert into public.social_posts (
      company_id, title, body, link_url, hashtags, status, created_by, updated_by
    )
    values (
      p_company_id, btrim(p_title), btrim(p_body),
      nullif(btrim(coalesce(p_link_url, '')), ''),
      coalesce(p_hashtags, array[]::text[]), 'draft',
      public.current_user_id(), public.current_user_id()
    )
    returning id into v_post_id;

    return v_post_id;
  end if;

  select status into v_status
    from public.social_posts
   where id = p_post_id and deleted_at is null;

  if v_status is null then
    raise exception 'That post was not found' using errcode = 'P0002';
  end if;

  -- The network already has it. Editing our copy would only make the record
  -- disagree with what the world actually saw.
  if v_status in ('published', 'partially_published', 'publishing') then
    raise exception 'A post that has gone out cannot be rewritten'
      using errcode = '22023';
  end if;

  update public.social_posts
     set title = btrim(p_title),
         body = btrim(p_body),
         link_url = case
                      when p_link_url is null then link_url
                      else nullif(btrim(p_link_url), '')
                    end,
         hashtags = coalesce(p_hashtags, hashtags),
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_post_id;

  return p_post_id;
end;
$$;

comment on function public.save_social_post(uuid, text, text, text, text[], uuid) is
  'Writes or edits a post, refusing to rewrite one the networks already have.';

create or replace function public.approve_social_post(p_post_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_post public.social_posts%rowtype;
begin
  select * into v_post
    from public.social_posts
   where id = p_post_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That post was not found' using errcode = 'P0002';
  end if;

  if not (public.is_service_role()
          or (v_post.company_id is null and public.is_super_admin())
          or (v_post.company_id is not null
              and public.is_company_owner(v_post.company_id))) then
    raise exception 'Only an owner may approve something that goes out publicly'
      using errcode = '42501';
  end if;

  if v_post.status not in ('draft', 'awaiting_approval') then
    return false;
  end if;

  update public.social_posts
     set approved_by = public.current_user_id(),
         approved_at = now(),
         status = case
                    when scheduled_for is not null then 'scheduled'
                    else 'awaiting_approval'
                  end,
         updated_at = now()
   where id = p_post_id;

  return true;
end;
$$;

comment on function public.approve_social_post(uuid) is
  'Records that an owner read a post before it went anywhere public.';

create or replace function public.cancel_social_post(p_post_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_post public.social_posts%rowtype;
begin
  select * into v_post
    from public.social_posts
   where id = p_post_id and deleted_at is null
     for update;

  if not found then
    return false;
  end if;

  if not (public.is_service_role()
          or (v_post.company_id is null and public.is_super_admin())
          or (v_post.company_id is not null
              and public.can_write_company_data(v_post.company_id))) then
    raise exception 'You are not allowed to change posts for this business'
      using errcode = '42501';
  end if;

  if v_post.status in ('published', 'partially_published') then
    raise exception 'A post that has gone out cannot be called back here'
      using errcode = '22023';
  end if;

  update public.social_posts
     set status = 'cancelled',
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_post_id;

  update public.social_post_targets
     set status = 'cancelled'
   where post_id = p_post_id
     and status in ('pending', 'publishing');

  return true;
end;
$$;

comment on function public.cancel_social_post(uuid) is
  'Stops a post that has not gone out yet, on every channel at once.';

create or replace function public.social_post_list(
  p_company_id uuid default null,
  p_limit integer default 50
)
returns table (
  post_id uuid,
  title text,
  body text,
  link_url text,
  status text,
  scheduled_for timestamptz,
  published_at timestamptz,
  approved_at timestamptz,
  channel_count integer,
  published_count integer,
  failed_count integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_company_id is null then
    if not (public.is_service_role() or public.is_super_admin()) then
      raise exception 'Only the platform team may read the platform calendar'
        using errcode = '42501';
    end if;
  elsif not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You cannot read the calendar of another business'
      using errcode = '42501';
  end if;

  return query
    select p.id, p.title, p.body, p.link_url, p.status, p.scheduled_for,
           p.published_at, p.approved_at,
           (select count(*) from public.social_post_targets as t
             where t.post_id = p.id)::int,
           (select count(*) from public.social_post_targets as t
             where t.post_id = p.id and t.status = 'published')::int,
           (select count(*) from public.social_post_targets as t
             where t.post_id = p.id and t.status = 'failed')::int,
           p.created_at
      from public.social_posts as p
     where p.company_id is not distinct from p_company_id
       and p.deleted_at is null
     order by coalesce(p.scheduled_for, p.created_at) desc
     limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

comment on function public.social_post_list(uuid, integer) is
  'Lists what has been written, when it goes out and how much of it landed.';

-- -----------------------------------------------------------------------------
-- Rules that write posts by themselves
-- -----------------------------------------------------------------------------

create or replace function public.save_social_auto_rule(
  p_company_id uuid,
  p_name text,
  p_trigger_event text,
  p_body_template text,
  p_channel_ids uuid[],
  p_requires_approval boolean default true,
  p_minimum_hours_between_posts integer default 24,
  p_is_active boolean default false,
  p_link_template text default null,
  p_rule_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule_id uuid;
begin
  if not (public.is_service_role()
          or (p_company_id is null and public.is_super_admin())
          or (p_company_id is not null and public.is_company_owner(p_company_id))) then
    raise exception 'Only an owner may set up automatic posting'
      using errcode = '42501';
  end if;

  if coalesce(p_is_active, false)
     and coalesce(array_length(p_channel_ids, 1), 0) = 0 then
    raise exception 'A rule cannot be switched on with nowhere to post'
      using errcode = '22023';
  end if;

  if p_rule_id is null then
    insert into public.social_auto_rules (
      company_id, name, trigger_event, body_template, link_template, channel_ids,
      requires_approval, minimum_hours_between_posts, is_active, created_by, updated_by
    )
    values (
      p_company_id, btrim(p_name), p_trigger_event, btrim(p_body_template),
      nullif(btrim(coalesce(p_link_template, '')), ''),
      coalesce(p_channel_ids, array[]::uuid[]),
      coalesce(p_requires_approval, true),
      coalesce(p_minimum_hours_between_posts, 24)::smallint,
      coalesce(p_is_active, false),
      public.current_user_id(), public.current_user_id()
    )
    returning id into v_rule_id;

    return v_rule_id;
  end if;

  update public.social_auto_rules
     set name = btrim(p_name),
         trigger_event = p_trigger_event,
         body_template = btrim(p_body_template),
         link_template = case
                           when p_link_template is null then link_template
                           else nullif(btrim(p_link_template), '')
                         end,
         channel_ids = coalesce(p_channel_ids, channel_ids),
         requires_approval = coalesce(p_requires_approval, requires_approval),
         minimum_hours_between_posts =
           coalesce(p_minimum_hours_between_posts, minimum_hours_between_posts)::smallint,
         is_active = coalesce(p_is_active, is_active),
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_rule_id
     and deleted_at is null;

  if not found then
    raise exception 'That rule was not found' using errcode = 'P0002';
  end if;

  return p_rule_id;
end;
$$;

comment on function public.save_social_auto_rule(
  uuid, text, text, text, uuid[], boolean, integer, boolean, text, uuid
) is 'Sets up a rule that turns something happening in the product into a post.';

create or replace function public.social_rule_list(p_company_id uuid default null)
returns table (
  rule_id uuid,
  name text,
  trigger_event text,
  body_template text,
  channel_count integer,
  requires_approval boolean,
  minimum_hours_between_posts smallint,
  is_active boolean,
  last_triggered_at timestamptz,
  trigger_count integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_company_id is null then
    if not (public.is_service_role() or public.is_super_admin()) then
      raise exception 'Only the platform team may read the platform rules'
        using errcode = '42501';
    end if;
  elsif not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You cannot read the rules of another business'
      using errcode = '42501';
  end if;

  return query
    select r.id, r.name, r.trigger_event, r.body_template,
           coalesce(array_length(r.channel_ids, 1), 0),
           r.requires_approval, r.minimum_hours_between_posts, r.is_active,
           r.last_triggered_at, r.trigger_count
      from public.social_auto_rules as r
     where r.company_id is not distinct from p_company_id
       and r.deleted_at is null
     order by r.name;
end;
$$;

comment on function public.social_rule_list(uuid) is
  'Lists the automatic posting rules and how often each has actually fired.';

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.save_social_channel(
  uuid, text, text, text, text, text, text, text, timestamptz, text[], uuid
) from public, authenticated;
revoke execute on function public.disconnect_social_channel(uuid)
  from public, authenticated;
revoke execute on function public.social_channel_list(uuid)
  from public, authenticated;
revoke execute on function public.save_social_post(uuid, text, text, text, text[], uuid)
  from public, authenticated;
revoke execute on function public.approve_social_post(uuid)
  from public, authenticated;
revoke execute on function public.cancel_social_post(uuid)
  from public, authenticated;
revoke execute on function public.social_post_list(uuid, integer)
  from public, authenticated;
revoke execute on function public.save_social_auto_rule(
  uuid, text, text, text, uuid[], boolean, integer, boolean, text, uuid
) from public, authenticated;
revoke execute on function public.social_rule_list(uuid)
  from public, authenticated;

grant execute on function public.save_social_channel(
  uuid, text, text, text, text, text, text, text, timestamptz, text[], uuid
) to authenticated, service_role;
grant execute on function public.disconnect_social_channel(uuid)
  to authenticated, service_role;
grant execute on function public.social_channel_list(uuid)
  to authenticated, service_role;
grant execute on function public.save_social_post(uuid, text, text, text, text[], uuid)
  to authenticated, service_role;
grant execute on function public.approve_social_post(uuid)
  to authenticated, service_role;
grant execute on function public.cancel_social_post(uuid)
  to authenticated, service_role;
grant execute on function public.social_post_list(uuid, integer)
  to authenticated, service_role;
grant execute on function public.save_social_auto_rule(
  uuid, text, text, text, uuid[], boolean, integer, boolean, text, uuid
) to authenticated, service_role;
grant execute on function public.social_rule_list(uuid)
  to authenticated, service_role;

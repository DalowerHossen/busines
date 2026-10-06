-- supabase/migrations/00154_create_campaign_functions.sql
-- Building a list, sending to it, and respecting the people on it.

-- Subscribes an address, or brings a lapsed one back.
create or replace function public.subscribe_to_marketing(
  p_company_id uuid,
  p_email_address text,
  p_source text default 'newsletter_form',
  p_client_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_valid_email(p_email_address) then
    raise exception 'That is not an address we can write to' using errcode = '22023';
  end if;

  insert into public.marketing_subscriptions (
    company_id, email_address, client_id, user_id, source
  )
  values (
    p_company_id, public.normalize_email(p_email_address)::citext, p_client_id,
    public.current_user_id(), coalesce(p_source, 'newsletter_form')
  )
  on conflict (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
               email_address)
  do update set is_subscribed = true,
                unsubscribed_at = null,
                unsubscribe_reason = null,
                subscribed_at = now(),
                updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.subscribe_to_marketing(uuid, text, text, uuid) is
  'Adds an address to the news list, or brings a lapsed one back.';

-- Stops the news for one address. Invoices and receipts are unaffected,
-- because those are not marketing and were never optional.
create or replace function public.unsubscribe_from_marketing(
  p_company_id uuid,
  p_email_address text,
  p_reason text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  update public.marketing_subscriptions
     set is_subscribed = false,
         unsubscribed_at = now(),
         unsubscribe_reason = p_reason,
         updated_at = now()
   where company_id is not distinct from p_company_id
     and email_address = public.normalize_email(p_email_address)::citext
     and is_subscribed;

  return found;
end;
$$;

comment on function public.unsubscribe_from_marketing(uuid, text, text) is
  'Stops marketing messages to one address without touching their invoices.';

-- May this address be written to at all?
create or replace function public.may_receive_marketing(
  p_company_id uuid,
  p_email_address text
)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
           select 1
             from public.marketing_subscriptions as s
            where s.company_id is not distinct from p_company_id
              and s.email_address = public.normalize_email(p_email_address)::citext
              and s.is_subscribed
         )
     and not exists (
           select 1
             from public.email_suppressions as e
            where e.email = public.normalize_email(p_email_address)::citext
              and (e.company_id is null or e.company_id = p_company_id)
              and e.released_at is null
              and (e.expires_at is null or e.expires_at > now())
         );
$$;

comment on function public.may_receive_marketing(uuid, text) is
  'Returns whether an address has agreed to news and is not suppressed.';

-- Builds the recipient list of a campaign from the subscribed addresses,
-- skipping anybody who asked to be left alone or who has bounced before.
create or replace function public.build_campaign_audience(p_campaign_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_campaign public.marketing_campaigns%rowtype;
  v_count integer;
begin
  select * into v_campaign
    from public.marketing_campaigns
   where id = p_campaign_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That campaign does not exist' using errcode = 'P0002';
  end if;

  if not (public.is_service_role()
          or public.is_super_admin()
          or (v_campaign.company_id is not null
              and public.is_company_owner(v_campaign.company_id))) then
    raise exception 'Only an owner can build a campaign audience'
      using errcode = '42501';
  end if;

  if v_campaign.status not in ('draft', 'scheduled') then
    raise exception 'The audience of a campaign that is already sending cannot be rebuilt'
      using errcode = '22023';
  end if;

  insert into public.campaign_recipients (
    campaign_id, company_id, client_id, email_address, scheduled_for
  )
  select v_campaign.id,
         v_campaign.company_id,
         s.client_id,
         s.email_address,
         coalesce(v_campaign.scheduled_for, now())
    from public.marketing_subscriptions as s
   where s.company_id is not distinct from v_campaign.company_id
     and s.is_subscribed
     and public.may_receive_marketing(v_campaign.company_id, s.email_address::text)
  on conflict do nothing;

  select count(*)::int into v_count
    from public.campaign_recipients
   where campaign_id = p_campaign_id;

  update public.marketing_campaigns
     set recipient_count = v_count,
         updated_at = now()
   where id = p_campaign_id;

  return v_count;
end;
$$;

comment on function public.build_campaign_audience(uuid) is
  'Fills the recipient list of a campaign from the people who agreed to it.';

-- Hands the next batch of due messages to a sending worker.
create or replace function public.claim_campaign_recipients(
  p_limit integer default 100
)
returns setof public.campaign_recipients
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with due as (
    select r.id
      from public.campaign_recipients as r
      join public.marketing_campaigns as c on c.id = r.campaign_id
     where r.status = 'pending'
       and r.scheduled_for <= now()
       and c.status in ('scheduled', 'sending')
       and c.deleted_at is null
     order by r.scheduled_for
     limit greatest(coalesce(p_limit, 100), 1)
       for update of r skip locked
  )
  update public.campaign_recipients as r
     set status = 'sent',
         sent_at = now(),
         updated_at = now()
    from due
   where r.id = due.id
  returning r.*;
end;
$$;

comment on function public.claim_campaign_recipients(integer) is
  'Reserves the next batch of campaign messages for one sending worker.';

-- Records what the mail provider said about one message.
create or replace function public.record_campaign_outcome(
  p_recipient_id uuid,
  p_outcome text,
  p_reason text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_recipient public.campaign_recipients%rowtype;
begin
  if p_outcome not in ('delivered', 'opened', 'clicked', 'bounced',
                       'unsubscribed', 'failed') then
    raise exception 'That is not an outcome a message can have'
      using errcode = '22023';
  end if;

  select * into v_recipient
    from public.campaign_recipients
   where id = p_recipient_id
     for update;

  if not found then
    return false;
  end if;

  update public.campaign_recipients
     set status = case
           when p_outcome in ('delivered') then 'delivered'
           when p_outcome = 'bounced' then 'bounced'
           when p_outcome = 'failed' then 'failed'
           when p_outcome = 'unsubscribed' then 'unsubscribed'
           else status
         end,
         delivered_at = case
           when p_outcome = 'delivered' then coalesce(delivered_at, now())
           else delivered_at
         end,
         opened_at = case
           when p_outcome = 'opened' then coalesce(opened_at, now())
           else opened_at
         end,
         first_clicked_at = case
           when p_outcome = 'clicked' then coalesce(first_clicked_at, now())
           else first_clicked_at
         end,
         bounced_at = case
           when p_outcome = 'bounced' then now() else bounced_at
         end,
         unsubscribed_at = case
           when p_outcome = 'unsubscribed' then now() else unsubscribed_at
         end,
         failure_reason = coalesce(p_reason, failure_reason),
         updated_at = now()
   where id = p_recipient_id;

  update public.marketing_campaigns
     set status = case when status = 'scheduled' then 'sending' else status end,
         sent_count = sent_count
           + case when p_outcome = 'delivered'
                   and v_recipient.sent_at is null then 1 else 0 end,
         delivered_count = delivered_count
           + case when p_outcome = 'delivered'
                   and v_recipient.delivered_at is null then 1 else 0 end,
         opened_count = opened_count
           + case when p_outcome = 'opened'
                   and v_recipient.opened_at is null then 1 else 0 end,
         clicked_count = clicked_count
           + case when p_outcome = 'clicked'
                   and v_recipient.first_clicked_at is null then 1 else 0 end,
         bounced_count = bounced_count
           + case when p_outcome = 'bounced'
                   and v_recipient.bounced_at is null then 1 else 0 end,
         unsubscribed_count = unsubscribed_count
           + case when p_outcome = 'unsubscribed'
                   and v_recipient.unsubscribed_at is null then 1 else 0 end,
         updated_at = now()
   where id = v_recipient.campaign_id;

  -- Somebody who clicks the unsubscribe link means it everywhere.
  if p_outcome = 'unsubscribed' then
    perform public.unsubscribe_from_marketing(
      v_recipient.company_id, v_recipient.email_address::text,
      'Unsubscribed from a campaign message'
    );
  end if;

  return true;
end;
$$;

comment on function public.record_campaign_outcome(uuid, text, text) is
  'Records delivery, opening, clicking or bouncing of one campaign message.';

-- Queues the next step of a sequence for everybody who is due it.
create or replace function public.advance_campaign_sequences()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_queued integer := 0;
  v_step record;
begin
  for v_step in
    select s.*, c.company_id
      from public.campaign_steps as s
      join public.marketing_campaigns as c on c.id = s.campaign_id
     where s.is_active
       and c.campaign_type = 'sequence'
       and c.status in ('scheduled', 'sending')
       and c.deleted_at is null
     order by s.campaign_id, s.step_number
  loop
    with queued as (
      insert into public.campaign_recipients (
        campaign_id, company_id, step_id, client_id, email_address,
        scheduled_for
      )
      select v_step.campaign_id,
             v_step.company_id,
             v_step.id,
             previous.client_id,
             previous.email_address,
             previous.sent_at + make_interval(hours => v_step.delay_hours)
        from public.campaign_recipients as previous
       where previous.campaign_id = v_step.campaign_id
         and previous.step_id is distinct from v_step.id
         and previous.status in ('sent', 'delivered', 'opened')
         and previous.sent_at is not null
         and previous.sent_at + make_interval(hours => v_step.delay_hours) <= now()
      on conflict do nothing
      returning 1
    )
    select v_queued + count(*)::int into v_queued from queued;
  end loop;

  return v_queued;
end;
$$;

comment on function public.advance_campaign_sequences() is
  'Queues the next message of each sequence for everybody whose wait is over.';

-- How a campaign actually did.
create or replace function public.campaign_performance(p_campaign_id uuid)
returns table (
  recipients integer,
  delivered integer,
  opened integer,
  clicked integer,
  bounced integer,
  unsubscribed integer,
  open_rate numeric,
  click_rate numeric,
  bounce_rate numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.recipient_count,
         c.delivered_count,
         c.opened_count,
         c.clicked_count,
         c.bounced_count,
         c.unsubscribed_count,
         case when c.delivered_count > 0
              then round(c.opened_count * 100.0 / c.delivered_count, 1)
              else 0 end,
         case when c.delivered_count > 0
              then round(c.clicked_count * 100.0 / c.delivered_count, 1)
              else 0 end,
         case when c.recipient_count > 0
              then round(c.bounced_count * 100.0 / c.recipient_count, 1)
              else 0 end
    from public.marketing_campaigns as c
   where c.id = p_campaign_id;
$$;

comment on function public.campaign_performance(uuid) is
  'Reports the delivery, opening and clicking of one campaign.';

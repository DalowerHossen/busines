-- supabase/migrations/00084_create_message_functions.sql
-- Rendering, queueing and settling messages.
--
-- The application never inserts into public.messages directly. It calls
-- public.queue_message, which resolves the wording, refuses a suppressed
-- address, enforces the rule that only an owner writes to a client, and keeps
-- the send idempotent.

-- Replaces every {{variable}} in a piece of text.
create or replace function public.render_template_text(
  p_text text,
  p_variables jsonb
)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_result text := coalesce(p_text, '');
  v_entry record;
begin
  if p_variables is null or jsonb_typeof(p_variables) <> 'object' then
    return v_result;
  end if;

  for v_entry in select key, value from jsonb_each_text(p_variables) loop
    v_result := replace(v_result, '{{' || v_entry.key || '}}',
                        coalesce(v_entry.value, ''));
  end loop;

  return v_result;
end;
$$;

comment on function public.render_template_text(text, jsonb) is
  'Substitutes the supplied values into the placeholders of a template.';

-- Returns the template a tenant should use, preferring its own wording.
create or replace function public.resolve_email_template(
  p_template_key text,
  p_company_id uuid default null,
  p_channel public.message_channel default 'email'
)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_company_id is not null then
    select id into v_id
      from public.email_templates
     where company_id = p_company_id
       and template_key = p_template_key
       and channel = p_channel
       and is_active
       and deleted_at is null;
  end if;

  if v_id is not null then
    return v_id;
  end if;

  select id into v_id
    from public.email_templates
   where company_id is null
     and template_key = p_template_key
     and channel = p_channel
     and is_active
     and deleted_at is null;

  return v_id;
end;
$$;

comment on function public.resolve_email_template(
  text, uuid, public.message_channel
) is 'Returns the wording a tenant uses, falling back to the platform text.';

-- Queues one message. Returns the existing row when the key was used before.
create or replace function public.queue_message(
  p_company_id uuid,
  p_template_key text,
  p_to_email text,
  p_variables jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_to_name text default null,
  p_related_entity_type text default null,
  p_related_entity_id uuid default null,
  p_client_id uuid default null,
  p_scheduled_for timestamptz default null,
  p_channel public.message_channel default 'email'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_template public.email_templates%rowtype;
  v_identity public.sender_identities%rowtype;
  v_key text;
  v_email citext;
  v_message_id uuid;
begin
  if p_to_email is null or not public.is_valid_email(p_to_email) then
    raise exception 'A valid recipient address is required' using errcode = '22023';
  end if;

  v_email := public.normalize_email(p_to_email)::citext;

  select * into v_template
    from public.email_templates
   where id = public.resolve_email_template(p_template_key, p_company_id, p_channel);

  if not found then
    raise exception 'No wording is configured for %', p_template_key
      using errcode = 'P0002';
  end if;

  -- Writing to a client is reserved for the owner of the business.
  if v_template.send_to_client
     and p_company_id is not null
     and not public.can_send_client_email(p_company_id) then
    raise exception 'Only the account owner can send a message to a client'
      using errcode = '42501';
  end if;

  if public.is_email_suppressed(v_email::text, p_company_id) then
    raise exception 'This address is on the do not contact list'
      using errcode = '42501';
  end if;

  v_key := coalesce(
    p_idempotency_key,
    p_template_key || ':' || coalesce(p_related_entity_id::text, 'none') || ':'
      || v_email::text || ':' || to_char(now(), 'YYYYMMDDHH24MISSMS')
  );

  select id into v_message_id from public.messages where idempotency_key = v_key;

  if v_message_id is not null then
    return v_message_id;
  end if;

  select * into v_identity
    from public.sender_identities
   where id = public.resolve_sender_identity(p_company_id);

  insert into public.messages (
    company_id, channel, status, template_key, sender_identity_id, from_name,
    from_email, reply_to_email, to_email, to_name, subject, body_html, body_text,
    related_entity_type, related_entity_id, client_id, idempotency_key,
    scheduled_for, requested_by
  )
  values (
    p_company_id,
    p_channel,
    case when p_scheduled_for is null then 'queued'::public.message_status
         else 'scheduled'::public.message_status
    end,
    p_template_key,
    v_identity.id,
    v_identity.from_name,
    v_identity.from_email,
    v_identity.reply_to_email,
    v_email,
    p_to_name,
    public.render_template_text(v_template.subject, p_variables),
    public.render_template_text(v_template.body_html, p_variables),
    public.render_template_text(v_template.body_text, p_variables),
    p_related_entity_type,
    p_related_entity_id,
    p_client_id,
    v_key,
    p_scheduled_for,
    public.current_user_id()
  )
  returning id into v_message_id;

  return v_message_id;
end;
$$;

comment on function public.queue_message(
  uuid, text, text, jsonb, text, text, text, uuid, uuid, timestamptz,
  public.message_channel
) is 'Renders and queues one message, once, to an address that accepts mail.';

-- Claims the messages a worker should attempt next.
create or replace function public.claim_due_messages(p_limit integer default 50)
returns setof public.messages
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  update public.messages
     set status = 'sending',
         attempt_count = attempt_count + 1,
         updated_at = now()
   where id in (
     select id
       from public.messages
      where (
              (status in ('queued', 'scheduled')
               and coalesce(scheduled_for, created_at) <= now())
              or (status = 'failed' and next_attempt_at is not null
                  and next_attempt_at <= now() and attempt_count < 5)
            )
      order by coalesce(scheduled_for, created_at)
      limit greatest(coalesce(p_limit, 50), 1)
      for update skip locked
   )
  returning *;
end;
$$;

comment on function public.claim_due_messages(integer) is
  'Reserves the next batch of messages for one worker, skipping locked rows.';

-- Records what a provider reported back about a message.
create or replace function public.record_message_event(
  p_message_id uuid,
  p_event public.message_status,
  p_provider_event_id text default null,
  p_detail jsonb default '{}'::jsonb,
  p_clicked_url text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_message public.messages%rowtype;
begin
  select * into v_message from public.messages where id = p_message_id for update;

  if not found then
    return false;
  end if;

  if p_provider_event_id is not null
     and exists (
       select 1 from public.message_events
        where provider_event_id = p_provider_event_id
     ) then
    return false;
  end if;

  insert into public.message_events (
    message_id, company_id, event_type, provider_event_id, detail, clicked_url
  )
  values (
    p_message_id, v_message.company_id, p_event, p_provider_event_id,
    coalesce(p_detail, '{}'::jsonb), p_clicked_url
  );

  update public.messages
     set status = p_event,
         sent_at = case when p_event = 'sent' then coalesce(sent_at, now()) else sent_at end,
         delivered_at = case when p_event = 'delivered' then now() else delivered_at end,
         first_opened_at = case when p_event = 'read'
                                then coalesce(first_opened_at, now())
                                else first_opened_at
                           end,
         last_opened_at = case when p_event = 'read' then now() else last_opened_at end,
         open_count = open_count + case when p_event = 'read' then 1 else 0 end,
         click_count = click_count + case when p_clicked_url is not null then 1 else 0 end,
         failed_at = case when p_event in ('failed', 'bounced', 'complained')
                          then now() else failed_at
                     end,
         failure_reason = case
                            when p_event in ('failed', 'bounced', 'complained')
                              then coalesce(p_detail ->> 'reason',
                                            'The provider rejected the message')
                            else failure_reason
                          end,
         next_attempt_at = case
                             when p_event = 'failed' and attempt_count < 5
                               then now() + make_interval(mins => power(3, attempt_count)::integer)
                             else null
                           end,
         updated_at = now()
   where id = p_message_id;

  -- A bounce or a complaint closes the address for good.
  if p_event = 'bounced' then
    perform public.suppress_email(
      v_message.to_email::text, 'hard_bounce', v_message.company_id,
      'provider_callback', p_detail ->> 'reason'
    );
  elsif p_event = 'complained' then
    perform public.suppress_email(
      v_message.to_email::text, 'spam_complaint', null, 'provider_callback',
      p_detail ->> 'reason'
    );
  end if;

  return true;
end;
$$;

comment on function public.record_message_event(
  uuid, public.message_status, text, jsonb, text
) is 'Applies a provider callback to a message and suppresses bad addresses.';

-- -----------------------------------------------------------------------------
-- Approval workflow
-- -----------------------------------------------------------------------------

-- A staff member asks the owner to send a document.
create or replace function public.request_document_send(
  p_company_id uuid,
  p_document_kind public.shared_document_type,
  p_document_id uuid,
  p_recipient_email text,
  p_recipient_name text default null,
  p_custom_message text default null,
  p_template_key text default 'invoice_sent'
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
  if not public.can_write_company_data(p_company_id) then
    raise exception 'You do not have permission to work in this account'
      using errcode = '42501';
  end if;

  insert into public.send_requests (
    company_id, document_kind, document_id, template_key, recipient_email,
    recipient_name, custom_message, requested_by
  )
  values (
    p_company_id, p_document_kind, p_document_id, p_template_key,
    public.normalize_email(p_recipient_email)::citext, p_recipient_name,
    p_custom_message, public.current_user_id()
  )
  returning id into v_id;

  perform public.notify_company(
    p_company_id,
    'invoice_sent',
    'A document is waiting to be sent',
    'A colleague prepared a document and asked you to approve the send.',
    '/app/send-requests',
    'Review the request',
    'info'
  );

  return v_id;
end;
$$;

comment on function public.request_document_send(
  uuid, public.shared_document_type, uuid, text, text, text, text
) is 'Raises a send request for the owner to approve.';

-- The owner approves or declines a request.
create or replace function public.review_send_request(
  p_request_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns public.approval_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.send_requests%rowtype;
  v_status public.approval_status;
begin
  select * into v_request
    from public.send_requests
   where id = p_request_id and status = 'pending' for update;

  if not found then
    raise exception 'This request has already been dealt with'
      using errcode = 'P0002';
  end if;

  if not public.can_send_client_email(v_request.company_id) then
    raise exception 'Only the account owner can approve a send'
      using errcode = '42501';
  end if;

  if not p_approve and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Please say why the request is being declined'
      using errcode = '22023';
  end if;

  v_status := case when p_approve then 'approved'::public.approval_status
                   else 'rejected'::public.approval_status
              end;

  update public.send_requests
     set status = v_status,
         reviewed_by = public.current_user_id(),
         reviewed_at = now(),
         decline_reason = case when p_approve then null else p_reason end,
         updated_at = now()
   where id = p_request_id;

  return v_status;
end;
$$;

comment on function public.review_send_request(uuid, boolean, text) is
  'Approves or declines a staff request to send a document to a client.';

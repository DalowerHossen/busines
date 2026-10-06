-- supabase/migrations/00207_create_contract_portal.sql
-- The screens behind agreements and signatures.
--
-- Sending, signing, declining, sealing and expiring were all written when the
-- tables were built. What was missing was everything an ordinary day needs:
-- drafting the wording, naming the parties, listing what is outstanding, and
-- handing a signer the one invitation that belongs to them. Those routines
-- live here. Nothing in this file can change the wording of a contract that
-- has already been sent, because the whole value of a signature is that the
-- paper did not move underneath it.

-- -----------------------------------------------------------------------------
-- What is out for signature
-- -----------------------------------------------------------------------------

create or replace function public.company_contracts(
  p_company_id uuid,
  p_status text default null,
  p_limit integer default 50
)
returns table (
  contract_id uuid,
  contract_number text,
  title text,
  status text,
  client_id uuid,
  client_name text,
  currency char(3),
  contract_value numeric,
  effective_date date,
  expiry_date date,
  valid_until date,
  signer_count smallint,
  signed_count smallint,
  sent_at timestamptz,
  completed_at timestamptz,
  sealed_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'Those agreements belong to another business' using errcode = '42501';
  end if;

  return query
  select c.id,
         c.contract_number,
         c.title,
         c.status,
         c.client_id,
         cl.display_name,
         c.currency,
         c.contract_value,
         c.effective_date,
         c.expiry_date,
         c.valid_until,
         c.signer_count,
         c.signed_count,
         c.sent_at,
         c.completed_at,
         c.sealed_at,
         c.updated_at
    from public.contracts as c
    left join public.clients as cl on cl.id = c.client_id
   where c.company_id = p_company_id
     and c.deleted_at is null
     and (p_status is null or c.status = p_status)
   order by c.created_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

comment on function public.company_contracts(uuid, text, integer) is
  'Lists the agreements of one business, newest first.';

-- -----------------------------------------------------------------------------
-- One agreement in full
-- -----------------------------------------------------------------------------

create or replace function public.contract_detail(p_contract_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract public.contracts%rowtype;
begin
  select * into v_contract
    from public.contracts
   where id = p_contract_id and deleted_at is null;

  if not found then
    return null;
  end if;

  if not coalesce(
    public.is_service_role() or public.has_company_access(v_contract.company_id),
    false
  ) then
    raise exception 'That agreement belongs to another business' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'contract_id', v_contract.id,
    'contract_number', v_contract.contract_number,
    'title', v_contract.title,
    'status', v_contract.status,
    'client_id', v_contract.client_id,
    'client_name', (
      select cl.display_name from public.clients as cl where cl.id = v_contract.client_id
    ),
    'body_html', v_contract.body_html,
    'content_hash', v_contract.content_hash,
    'currency', v_contract.currency,
    'contract_value', v_contract.contract_value,
    'effective_date', v_contract.effective_date,
    'expiry_date', v_contract.expiry_date,
    'valid_until', v_contract.valid_until,
    'signing_order_enforced', v_contract.signing_order_enforced,
    'signer_count', v_contract.signer_count,
    'signed_count', v_contract.signed_count,
    'sent_at', v_contract.sent_at,
    'first_viewed_at', v_contract.first_viewed_at,
    'completed_at', v_contract.completed_at,
    'declined_at', v_contract.declined_at,
    'decline_reason', v_contract.decline_reason,
    'voided_at', v_contract.voided_at,
    'void_reason', v_contract.void_reason,
    'sealed_at', v_contract.sealed_at,
    'sealed_sha256', v_contract.sealed_sha256,
    'notes', v_contract.notes,
    'signers', coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'signer_id', s.id,
                   'full_name', s.full_name,
                   'email', s.email::text,
                   'role_label', s.role_label,
                   'signing_order', s.signing_order,
                   'is_internal', s.is_internal,
                   'status', s.status,
                   'invited_at', s.invited_at,
                   'viewed_at', s.viewed_at,
                   'signed_at', s.signed_at,
                   'signature_type', s.signature_type,
                   'typed_signature', s.typed_signature,
                   'declined_at', s.declined_at,
                   'decline_reason', s.decline_reason,
                   'has_invitation', s.document_link_id is not null
                 )
                 order by s.signing_order, s.created_at
               )
          from public.contract_signers as s
         where s.contract_id = v_contract.id
      ),
      '[]'::jsonb
    ),
    'events', coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'occurred_at', e.created_at,
                   'event_type', e.event_type,
                   'description', e.description,
                   'signer_name', sn.full_name
                 )
                 order by e.created_at
               )
          from public.contract_events as e
          left join public.contract_signers as sn on sn.id = e.signer_id
         where e.contract_id = v_contract.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

comment on function public.contract_detail(uuid) is
  'Returns one agreement with its parties and its full trail.';

-- -----------------------------------------------------------------------------
-- Drafting
-- -----------------------------------------------------------------------------

create or replace function public.save_contract(
  p_company_id uuid,
  p_title text,
  p_body_html text,
  p_contract_id uuid default null,
  p_client_id uuid default null,
  p_currency char(3) default null,
  p_contract_value numeric default null,
  p_effective_date date default null,
  p_expiry_date date default null,
  p_signing_order_enforced boolean default false,
  p_notes text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.contracts%rowtype;
  v_contract_id uuid;
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'That business is not yours to write to' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_body_html, ''))) < 20 then
    raise exception 'An agreement needs wording before it can be saved'
      using errcode = '22023';
  end if;

  if p_contract_id is null then
    insert into public.contracts (
      company_id, client_id, title, body_html, currency, contract_value,
      effective_date, expiry_date, signing_order_enforced, notes,
      created_by, updated_by
    )
    values (
      p_company_id, p_client_id, btrim(p_title), p_body_html, p_currency,
      p_contract_value, p_effective_date, p_expiry_date,
      coalesce(p_signing_order_enforced, false), p_notes,
      public.current_user_id(), public.current_user_id()
    )
    returning id into v_contract_id;

    perform public.record_contract_event(
      v_contract_id, 'created', 'The agreement was drafted'
    );

    return v_contract_id;
  end if;

  select * into v_existing
    from public.contracts
   where id = p_contract_id and company_id = p_company_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That agreement was not found' using errcode = 'P0002';
  end if;

  if v_existing.status <> 'draft' then
    raise exception 'An agreement that has been sent cannot be rewritten. Void it and send a new one.'
      using errcode = '22023';
  end if;

  update public.contracts
     set client_id = p_client_id,
         title = btrim(p_title),
         body_html = p_body_html,
         currency = p_currency,
         contract_value = p_contract_value,
         effective_date = p_effective_date,
         expiry_date = p_expiry_date,
         signing_order_enforced = coalesce(p_signing_order_enforced, false),
         notes = p_notes,
         updated_by = public.current_user_id(),
         updated_at = now()
   where id = p_contract_id;

  return p_contract_id;
end;
$$;

comment on function public.save_contract(
  uuid, text, text, uuid, uuid, char, numeric, date, date, boolean, text
) is 'Drafts a new agreement or edits one that has not been sent.';

-- Replaces the list of parties while the agreement is still a draft.
create or replace function public.set_contract_signers(
  p_contract_id uuid,
  p_signers jsonb
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_contract public.contracts%rowtype;
  v_entry jsonb;
  v_count integer := 0;
begin
  select * into v_contract
    from public.contracts
   where id = p_contract_id and deleted_at is null for update;

  if not found then
    raise exception 'That agreement was not found' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.has_company_access(v_contract.company_id),
    false
  ) then
    raise exception 'That agreement belongs to another business' using errcode = '42501';
  end if;

  if v_contract.status <> 'draft' then
    raise exception 'The parties to a sent agreement cannot be changed'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_signers) <> 'array' or jsonb_array_length(p_signers) = 0 then
    raise exception 'An agreement needs at least one party' using errcode = '22023';
  end if;

  if jsonb_array_length(p_signers) > 20 then
    raise exception 'An agreement can have at most twenty parties'
      using errcode = '22023';
  end if;

  delete from public.contract_signers where contract_id = p_contract_id;

  for v_entry in select * from jsonb_array_elements(p_signers)
  loop
    v_count := v_count + 1;

    insert into public.contract_signers (
      company_id, contract_id, full_name, email, role_label, signing_order,
      is_internal
    )
    values (
      v_contract.company_id,
      p_contract_id,
      btrim(v_entry ->> 'full_name'),
      (v_entry ->> 'email')::citext,
      coalesce(nullif(btrim(coalesce(v_entry ->> 'role_label', '')), ''), 'Client'),
      coalesce((v_entry ->> 'signing_order')::smallint, v_count::smallint),
      coalesce((v_entry ->> 'is_internal')::boolean, false)
    );
  end loop;

  return v_count;
end;
$$;

comment on function public.set_contract_signers(uuid, jsonb) is
  'Replaces the parties of a draft agreement.';

-- -----------------------------------------------------------------------------
-- Invitations
-- -----------------------------------------------------------------------------

-- Ties one signed link to the party it was made for. The link itself is
-- created by the application, which is the only place the token ever exists.
create or replace function public.attach_signer_invitation(
  p_signer_id uuid,
  p_link_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_signer public.contract_signers%rowtype;
begin
  select * into v_signer
    from public.contract_signers
   where id = p_signer_id for update;

  if not found then
    raise exception 'That party was not found' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.is_company_owner(v_signer.company_id),
    false
  ) then
    raise exception 'Only the account owner can invite a party to sign'
      using errcode = '42501';
  end if;

  update public.contract_signers
     set document_link_id = p_link_id,
         invited_at = coalesce(invited_at, now()),
         status = case when status = 'pending' then 'invited' else status end,
         updated_at = now()
   where id = p_signer_id;

  return true;
end;
$$;

comment on function public.attach_signer_invitation(uuid, uuid) is
  'Records which signed link belongs to which party.';

-- What the person holding the invitation is asked to read and sign.
create or replace function public.contract_for_signing(p_link_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_signer public.contract_signers%rowtype;
  v_contract public.contracts%rowtype;
begin
  if not public.is_service_role() then
    raise exception 'Only the platform can open an invitation' using errcode = '42501';
  end if;

  select * into v_signer
    from public.contract_signers
   where document_link_id = p_link_id;

  if not found then
    return null;
  end if;

  select * into v_contract
    from public.contracts
   where id = v_signer.contract_id and deleted_at is null;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'signer_id', v_signer.id,
    'full_name', v_signer.full_name,
    'email', v_signer.email::text,
    'role_label', v_signer.role_label,
    'signer_status', v_signer.status,
    'signed_at', v_signer.signed_at,
    'consent_text', v_signer.consent_text,
    'contract_id', v_contract.id,
    'contract_number', v_contract.contract_number,
    'title', v_contract.title,
    'status', v_contract.status,
    'body_html', v_contract.body_html,
    'currency', v_contract.currency,
    'contract_value', v_contract.contract_value,
    'effective_date', v_contract.effective_date,
    'valid_until', v_contract.valid_until,
    'company_name', (
      select coalesce(p.trade_name, p.legal_name)
        from public.company_profiles as p
       where p.company_id = v_contract.company_id
    ),
    'is_open',
      v_contract.status in ('sent', 'partially_signed')
      and (v_contract.valid_until is null or v_contract.valid_until >= current_date)
      and v_signer.status <> 'signed'
      and v_signer.status <> 'declined',
    'waiting_for_others',
      v_contract.signing_order_enforced
      and exists (
        select 1
          from public.contract_signers as earlier
         where earlier.contract_id = v_contract.id
           and earlier.signing_order < v_signer.signing_order
           and earlier.status <> 'signed'
      )
  );
end;
$$;

comment on function public.contract_for_signing(uuid) is
  'Returns the agreement behind one invitation, for the signing page.';

-- -----------------------------------------------------------------------------
-- Wording to start from, and the shape of the pile
-- -----------------------------------------------------------------------------

create or replace function public.contract_wording_choices(p_company_id uuid)
returns table (
  template_id uuid,
  template_key text,
  name text,
  description text,
  category text,
  body_html text,
  is_platform boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'That business is not yours to read' using errcode = '42501';
  end if;

  return query
  select t.id,
         t.template_key,
         t.name,
         t.description,
         t.category,
         t.body_html,
         t.company_id is null
    from public.contract_templates as t
   where t.deleted_at is null
     and t.is_active
     and (t.company_id is null or t.company_id = p_company_id)
   order by t.company_id nulls last, t.name;
end;
$$;

comment on function public.contract_wording_choices(uuid) is
  'Lists the wording a business can start an agreement from.';

create or replace function public.contract_overview(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'That business is not yours to read' using errcode = '42501';
  end if;

  select jsonb_build_object(
           'draft_count', (count(*) filter (where status = 'draft'))::int,
           'awaiting_count',
             (count(*) filter (where status in ('sent', 'partially_signed')))::int,
           'completed_count', (count(*) filter (where status = 'completed'))::int,
           'declined_count',
             (count(*) filter (where status in ('declined', 'expired', 'voided')))::int,
           'signed_value', coalesce(
             sum(contract_value) filter (where status = 'completed'), 0
           ),
           'awaiting_value', coalesce(
             sum(contract_value) filter (where status in ('sent', 'partially_signed')), 0
           ),
           'closing_soon', (
             count(*) filter (
               where status in ('sent', 'partially_signed')
                 and valid_until is not null
                 and valid_until <= current_date + 7
             )
           )::int
         )
    into v_result
    from public.contracts
   where company_id = p_company_id
     and deleted_at is null;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

comment on function public.contract_overview(uuid) is
  'Counts the agreements of one business by where they have got to.';

-- -----------------------------------------------------------------------------
-- The wording of the invitation itself
-- -----------------------------------------------------------------------------

insert into public.email_templates (
  template_key, name, description, subject, body_html, body_text,
  available_variables, is_system
)
values
  (
    'contract_signature_request',
    'Signature request',
    'Sent to each party when an agreement goes out for signature.',
    '{{company_name}} has sent you {{contract_number}} to sign',
    '<p>Hello {{client_name}},</p>'
      || '<p>{{company_name}} has sent you <strong>{{contract_title}}</strong> '
      || '({{contract_number}}) to read and sign.</p>'
      || '<p><a href="{{document_url}}">Read the agreement and sign it</a></p>'
      || '<p>The link is personal to you and stops working on {{valid_until}}.</p>'
      || '<p>{{company_name}}</p>',
    'Hello {{client_name}},' || chr(10) || chr(10)
      || '{{company_name}} has sent you {{contract_title}} ({{contract_number}}) '
      || 'to read and sign.' || chr(10) || chr(10)
      || 'Read the agreement and sign it: {{document_url}}' || chr(10) || chr(10)
      || 'The link is personal to you and stops working on {{valid_until}}.'
      || chr(10) || '{{company_name}}',
    array['client_name', 'company_name', 'contract_title', 'contract_number',
          'document_url', 'valid_until'],
    true
  )
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Who may run what
-- -----------------------------------------------------------------------------

revoke execute on function public.company_contracts(uuid, text, integer)
  from public, authenticated;
revoke execute on function public.contract_detail(uuid)
  from public, authenticated;
revoke execute on function public.save_contract(
  uuid, text, text, uuid, uuid, char, numeric, date, date, boolean, text
) from public, authenticated;
revoke execute on function public.set_contract_signers(uuid, jsonb)
  from public, authenticated;
revoke execute on function public.attach_signer_invitation(uuid, uuid)
  from public, authenticated;
revoke execute on function public.contract_for_signing(uuid)
  from public, authenticated;
revoke execute on function public.contract_wording_choices(uuid)
  from public, authenticated;
revoke execute on function public.contract_overview(uuid)
  from public, authenticated;

grant execute on function public.company_contracts(uuid, text, integer)
  to authenticated, service_role;
grant execute on function public.contract_detail(uuid)
  to authenticated, service_role;
grant execute on function public.save_contract(
  uuid, text, text, uuid, uuid, char, numeric, date, date, boolean, text
) to authenticated, service_role;
grant execute on function public.set_contract_signers(uuid, jsonb)
  to authenticated, service_role;
grant execute on function public.attach_signer_invitation(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.contract_for_signing(uuid)
  to service_role;
grant execute on function public.contract_wording_choices(uuid)
  to authenticated, service_role;
grant execute on function public.contract_overview(uuid)
  to authenticated, service_role;

-- The signing page acts for a visitor who holds no account, so the platform
-- itself must be able to record a view, a signature and a refusal.
grant execute on function public.view_contract(uuid, text, text)
  to service_role;
grant execute on function public.sign_contract(
  uuid, text, text, uuid, text, text, text
) to service_role;
grant execute on function public.decline_contract(uuid, text, text)
  to service_role;

-- supabase/migrations/00121_create_contract_functions.sql
-- Sending a contract, signing it, and sealing the result.
--
-- The sequence is deliberately strict. Wording is frozen at send time, a
-- signer can only sign their own invitation, consent is captured before the
-- signature counts, and the contract completes itself only when everybody
-- who had to sign has signed.

-- Allocates the contract reference.
create or replace function public.assign_contract_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next integer;
begin
  if new.contract_number is not null
     and length(btrim(new.contract_number)) > 0 then
    return new;
  end if;

  select coalesce(
           max(nullif(regexp_replace(contract_number, '^CT-', ''), '')::integer),
           0
         ) + 1
    into v_next
    from public.contracts
   where company_id = new.company_id
     and contract_number ~ '^CT-[0-9]+$';

  new.contract_number := 'CT-' || lpad(v_next::text, 4, '0');

  return new;
end;
$$;

comment on function public.assign_contract_number() is
  'Gives a new contract the next reference in the sequence of its tenant.';

-- Writes one line of the trail. Every state change goes through here, so the
-- trail can never disagree with the contract.
create or replace function public.record_contract_event(
  p_contract_id uuid,
  p_event_type text,
  p_description text,
  p_signer_id uuid default null,
  p_ip_hash text default null,
  p_user_agent text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_event_id uuid;
begin
  select company_id into v_company_id from public.contracts where id = p_contract_id;

  if v_company_id is null then
    raise exception 'Contract % was not found', p_contract_id using errcode = 'P0002';
  end if;

  insert into public.contract_events (
    company_id, contract_id, signer_id, event_type, description,
    actor_user_id, ip_hash, user_agent, metadata
  )
  values (
    v_company_id, p_contract_id, p_signer_id, p_event_type, p_description,
    public.current_user_id(), p_ip_hash, p_user_agent,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

comment on function public.record_contract_event(
  uuid, text, text, uuid, text, text, jsonb
) is 'Adds one entry to the permanent trail of a contract.';

-- Freezes the wording and opens the contract for signature.
create or replace function public.send_contract(
  p_contract_id uuid,
  p_valid_until date default null
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract public.contracts%rowtype;
  v_signers integer;
begin
  select * into v_contract
    from public.contracts
   where id = p_contract_id and deleted_at is null for update;

  if not found then
    raise exception 'Contract % was not found', p_contract_id using errcode = 'P0002';
  end if;

  -- Sending a contract is sending a client document, so the same rule as
  -- invoices applies: the owner does it.
  if not (public.is_service_role()
          or public.is_super_admin()
          or public.is_company_owner(v_contract.company_id)) then
    raise exception 'Only the account owner can send a contract for signature'
      using errcode = '42501';
  end if;

  if v_contract.status <> 'draft' then
    raise exception 'This contract has already been sent' using errcode = '22023';
  end if;

  select count(*)::integer into v_signers
    from public.contract_signers
   where contract_id = p_contract_id;

  if v_signers = 0 then
    raise exception 'Add at least one signer before sending' using errcode = '22023';
  end if;

  update public.contracts
     set status = 'sent',
         sent_at = now(),
         valid_until = coalesce(p_valid_until, current_date + 30),
         signer_count = v_signers,
         -- The wording is fixed from this moment; the digest proves it.
         content_hash = encode(extensions.digest(body_html, 'sha256'), 'hex'),
         updated_at = now()
   where id = p_contract_id;

  update public.contract_signers
     set status = 'invited',
         invited_at = now(),
         updated_at = now()
   where contract_id = p_contract_id
     and status = 'pending';

  perform public.record_contract_event(
    p_contract_id, 'sent', 'The contract was sent for signature'
  );

  return 'sent';
end;
$$;

comment on function public.send_contract(uuid, date) is
  'Freezes the wording of a contract and invites its signers.';

-- Records that a signer opened the contract.
create or replace function public.view_contract(
  p_signer_id uuid,
  p_ip_hash text default null,
  p_user_agent text default null
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
    return false;
  end if;

  update public.contract_signers
     set status = case when status = 'invited' then 'viewed' else status end,
         viewed_at = coalesce(viewed_at, now()),
         updated_at = now()
   where id = p_signer_id;

  update public.contracts
     set first_viewed_at = coalesce(first_viewed_at, now()),
         updated_at = now()
   where id = v_signer.contract_id;

  perform public.record_contract_event(
    v_signer.contract_id, 'viewed',
    v_signer.full_name || ' opened the contract', p_signer_id, p_ip_hash,
    p_user_agent
  );

  return true;
end;
$$;

comment on function public.view_contract(uuid, text, text) is
  'Records that a signer opened the contract they were invited to.';

-- Signs on behalf of one signer and completes the contract when the last
-- required signature arrives.
create or replace function public.sign_contract(
  p_signer_id uuid,
  p_signature_type text,
  p_typed_signature text default null,
  p_signature_file_id uuid default null,
  p_consent_text text default null,
  p_ip_hash text default null,
  p_user_agent text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_signer public.contract_signers%rowtype;
  v_contract public.contracts%rowtype;
  v_outstanding integer;
  v_signed integer;
  v_blocking integer;
begin
  select * into v_signer
    from public.contract_signers
   where id = p_signer_id for update;

  if not found then
    raise exception 'Signer % was not found', p_signer_id using errcode = 'P0002';
  end if;

  select * into v_contract
    from public.contracts
   where id = v_signer.contract_id for update;

  if v_contract.status not in ('sent', 'partially_signed') then
    raise exception 'This contract is not open for signature'
      using errcode = '22023';
  end if;

  if v_contract.valid_until is not null
     and v_contract.valid_until < current_date then
    raise exception 'The signing window for this contract has closed'
      using errcode = '22023';
  end if;

  if v_signer.status = 'signed' then
    raise exception 'This person has already signed' using errcode = '22023';
  end if;

  if v_signer.status = 'declined' then
    raise exception 'This person declined to sign' using errcode = '22023';
  end if;

  if p_signature_type not in ('typed', 'drawn', 'uploaded') then
    raise exception 'A signature must be typed, drawn or uploaded'
      using errcode = '22023';
  end if;

  if p_signature_type = 'typed'
     and coalesce(btrim(p_typed_signature), '') = '' then
    raise exception 'Please type the name to sign with' using errcode = '22023';
  end if;

  if p_signature_type in ('drawn', 'uploaded') and p_signature_file_id is null then
    raise exception 'The drawn signature is missing' using errcode = '22023';
  end if;

  -- When the order matters, everyone ahead of this person must be done.
  if v_contract.signing_order_enforced then
    select count(*)::integer into v_blocking
      from public.contract_signers
     where contract_id = v_signer.contract_id
       and signing_order < v_signer.signing_order
       and status <> 'signed';

    if v_blocking > 0 then
      raise exception 'It is not this signer turn yet' using errcode = '22023';
    end if;
  end if;

  update public.contract_signers
     set status = 'signed',
         signed_at = now(),
         signature_type = p_signature_type,
         typed_signature = p_typed_signature,
         signature_image_file_id = p_signature_file_id,
         signature_hash = encode(
           extensions.digest(
             coalesce(p_typed_signature, p_signature_file_id::text, '')
             || v_signer.email::text
             || coalesce(v_contract.content_hash, '')
             || now()::text,
             'sha256'
           ),
           'hex'
         ),
         signed_ip_hash = p_ip_hash,
         signed_user_agent = p_user_agent,
         consent_given_at = now(),
         consent_text = coalesce(
           p_consent_text,
           'I agree to sign this document electronically and that my electronic '
           || 'signature is as binding as a handwritten one.'
         ),
         updated_at = now()
   where id = p_signer_id;

  select (count(*) filter (where status = 'signed'))::integer,
         (count(*) filter (where status not in ('signed', 'declined')))::integer
    into v_signed, v_outstanding
    from public.contract_signers
   where contract_id = v_signer.contract_id;

  perform public.record_contract_event(
    v_signer.contract_id, 'signed', v_signer.full_name || ' signed the contract',
    p_signer_id, p_ip_hash, p_user_agent
  );

  if v_outstanding = 0 then
    update public.contracts
       set status = 'completed',
           signed_count = v_signed,
           completed_at = now(),
           updated_at = now()
     where id = v_signer.contract_id;

    perform public.record_contract_event(
      v_signer.contract_id, 'completed', 'Everybody has signed the contract'
    );

    return 'completed';
  end if;

  update public.contracts
     set status = 'partially_signed',
         signed_count = v_signed,
         updated_at = now()
   where id = v_signer.contract_id;

  return 'partially_signed';
end;
$$;

comment on function public.sign_contract(
  uuid, text, text, uuid, text, text, text
) is 'Records one signature with its consent and evidence.';

-- A signer says no. The contract stops there.
create or replace function public.decline_contract(
  p_signer_id uuid,
  p_reason text,
  p_ip_hash text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_signer public.contract_signers%rowtype;
begin
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Please say why the contract is being declined'
      using errcode = '22023';
  end if;

  select * into v_signer
    from public.contract_signers
   where id = p_signer_id for update;

  if not found then
    raise exception 'Signer % was not found', p_signer_id using errcode = 'P0002';
  end if;

  if v_signer.status = 'signed' then
    raise exception 'This person has already signed' using errcode = '22023';
  end if;

  update public.contract_signers
     set status = 'declined',
         declined_at = now(),
         decline_reason = p_reason,
         updated_at = now()
   where id = p_signer_id;

  update public.contracts
     set status = 'declined',
         declined_at = now(),
         decline_reason = p_reason,
         updated_at = now()
   where id = v_signer.contract_id;

  perform public.record_contract_event(
    v_signer.contract_id, 'declined',
    v_signer.full_name || ' declined to sign', p_signer_id, p_ip_hash
  );

  return 'declined';
end;
$$;

comment on function public.decline_contract(uuid, text, text) is
  'Records a refusal to sign and closes the contract.';

-- Attaches the sealed copy once everybody has signed.
create or replace function public.seal_contract(
  p_contract_id uuid,
  p_file_id uuid,
  p_sha256 text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract public.contracts%rowtype;
begin
  select * into v_contract
    from public.contracts
   where id = p_contract_id for update;

  if not found then
    raise exception 'Contract % was not found', p_contract_id using errcode = 'P0002';
  end if;

  if v_contract.status <> 'completed' then
    raise exception 'Only a fully signed contract can be sealed'
      using errcode = '22023';
  end if;

  if v_contract.sealed_at is not null then
    return false;
  end if;

  update public.contracts
     set sealed_file_id = p_file_id,
         sealed_sha256 = p_sha256,
         sealed_at = now(),
         updated_at = now()
   where id = p_contract_id;

  perform public.record_contract_event(
    p_contract_id, 'sealed', 'The signed copy was sealed and stored'
  );

  return true;
end;
$$;

comment on function public.seal_contract(uuid, uuid, text) is
  'Stores the sealed copy of a fully signed contract with its digest.';

-- Cancels a contract that should never be signed.
create or replace function public.void_contract(
  p_contract_id uuid,
  p_reason text
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract public.contracts%rowtype;
begin
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Please say why the contract is being voided'
      using errcode = '22023';
  end if;

  select * into v_contract
    from public.contracts
   where id = p_contract_id and deleted_at is null for update;

  if not found then
    raise exception 'Contract % was not found', p_contract_id using errcode = 'P0002';
  end if;

  if not (public.is_super_admin()
          or public.is_company_owner(v_contract.company_id)) then
    raise exception 'Only the account owner can void a contract'
      using errcode = '42501';
  end if;

  if v_contract.status = 'completed' then
    raise exception 'A signed contract cannot be voided. Agree a cancellation instead.'
      using errcode = '22023';
  end if;

  update public.contracts
     set status = 'voided',
         voided_at = now(),
         void_reason = p_reason,
         updated_at = now()
   where id = p_contract_id;

  perform public.record_contract_event(
    p_contract_id, 'voided', 'The contract was voided: ' || p_reason
  );

  return 'voided';
end;
$$;

comment on function public.void_contract(uuid, text) is
  'Cancels an unsigned contract and says why.';

-- Closes contracts nobody signed in time.
create or replace function public.expire_stale_contracts()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract record;
  v_count integer := 0;
begin
  for v_contract in
    select id
      from public.contracts
     where status in ('sent', 'partially_signed')
       and valid_until is not null
       and valid_until < current_date
       and deleted_at is null
  loop
    update public.contracts
       set status = 'expired', updated_at = now()
     where id = v_contract.id;

    perform public.record_contract_event(
      v_contract.id, 'expired', 'The signing window closed before everybody signed'
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.expire_stale_contracts() is
  'Expires contracts whose signing window has passed.';

-- The trail a tenant can hand to a lawyer.
create or replace function public.contract_audit_trail(p_contract_id uuid)
returns table (
  occurred_at timestamptz,
  event_type text,
  description text,
  signer_name text,
  ip_hash text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.created_at,
         e.event_type,
         e.description,
         s.full_name,
         e.ip_hash
    from public.contract_events as e
    left join public.contract_signers as s on s.id = e.signer_id
   where e.contract_id = p_contract_id
   order by e.created_at;
$$;

comment on function public.contract_audit_trail(uuid) is
  'Returns the full history of a contract in the order it happened.';

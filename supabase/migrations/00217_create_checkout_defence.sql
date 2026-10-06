-- supabase/migrations/00217_create_checkout_defence.sql
-- Controlling how money is taken, and winning the argument afterwards.
--
-- Two jobs in one file.
--
-- The first is control. A seller decides whether card payments are offered
-- at all, and on what conditions, because a card payment is the only kind
-- the payer can reverse unilaterally months later. Turning cards off and
-- taking bank transfer instead is a legitimate business decision and the
-- product should allow it in one switch.
--
-- The second is proof. A card dispute is decided on documents, not on who
-- is telling the truth, and the party with a complete file almost always
-- wins. So at the moment of payment the platform freezes everything a card
-- scheme asks for: who agreed, from which address and device, to what text,
-- at what time, against which invoice, with what delivered work attached.
-- The record is written once and never edited.

-- -----------------------------------------------------------------------------
-- How a seller wants to be paid
-- -----------------------------------------------------------------------------

create table public.checkout_preferences (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  -- The switch. Off means no card option is shown anywhere, on any invoice.
  accept_card_payments boolean not null default true,
  accept_bank_transfer boolean not null default true,
  accept_local_methods boolean not null default true,

  -- Conditions that make a card payment safe to accept.
  require_terms_acceptance boolean not null default true,
  require_delivery_confirmation boolean not null default false,
  require_billing_address boolean not null default true,
  block_mismatched_country boolean not null default false,

  -- Amount bands. A card payment above the ceiling is simply not offered,
  -- because the largest invoices carry the largest reversal risk.
  card_minimum_amount numeric(18, 4) not null default 0,
  card_maximum_amount numeric(18, 4),

  -- Text the payer must agree to before the pay button does anything.
  consent_statement text not null default
    'I confirm I ordered this work, that it has been delivered to my satisfaction, and I authorise this payment.',
  refund_window_days smallint not null default 14,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,

  constraint checkout_preferences_amount_check
    check (
      card_minimum_amount >= 0
      and (card_maximum_amount is null or card_maximum_amount > card_minimum_amount)
    ),
  constraint checkout_preferences_statement_check
    check (length(btrim(consent_statement)) between 20 and 600),
  constraint checkout_preferences_window_check
    check (refund_window_days between 0 and 180)
);

comment on table public.checkout_preferences is
  'How one seller is willing to be paid, including whether cards are offered at all.';

comment on column public.checkout_preferences.accept_card_payments is
  'The single switch that removes every card option from every invoice of this seller.';

create unique index checkout_preferences_company_unique
  on public.checkout_preferences (company_id);

-- -----------------------------------------------------------------------------
-- What the payer agreed to, frozen at the moment they agreed
-- -----------------------------------------------------------------------------

create table public.checkout_consents (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  invoice_id uuid,
  payment_intent_id uuid,
  document_link_id uuid,

  -- The exact words shown, and a digest of them, so nobody can argue later
  -- about what the page said.
  consent_statement text not null,
  statement_hash text not null,
  terms_version text,
  terms_hash text,

  -- Who agreed, and from where.
  agreed_at timestamptz not null default now(),
  ip_address inet,
  ip_hash text,
  user_agent text,
  accept_language text,
  time_zone text,
  screen_fingerprint text,

  -- What they were looking at when they agreed.
  invoice_number text,
  amount numeric(18, 4),
  currency char(3),
  evidence_item_count integer not null default 0,
  viewed_seconds integer,

  created_at timestamptz not null default now(),

  constraint checkout_consents_statement_check
    check (length(btrim(consent_statement)) between 20 and 600),
  constraint checkout_consents_hash_check
    check (statement_hash ~ '^[0-9a-f]{64}$'),
  constraint checkout_consents_terms_hash_check
    check (terms_hash is null or terms_hash ~ '^[0-9a-f]{64}$'),
  constraint checkout_consents_amount_check
    check (amount is null or amount > 0)
);

comment on table public.checkout_consents is
  'The agreement a payer gave before paying, captured as it was and never edited.';

create index checkout_consents_invoice_idx
  on public.checkout_consents (invoice_id, agreed_at desc);

create index checkout_consents_company_idx
  on public.checkout_consents (company_id, agreed_at desc);

-- An agreement is a legal record. It is written once.
create trigger checkout_consents_append_only
  before update or delete on public.checkout_consents
  for each row execute function public.block_audit_mutation();

-- -----------------------------------------------------------------------------
-- What was turned away at the door
-- -----------------------------------------------------------------------------

create table public.bot_defence_events (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,

  path text not null,
  reason text not null,
  user_agent text,
  ip_hash text,
  occurred_at timestamptz not null default now(),

  constraint bot_defence_events_reason_check
    check (reason in ('known_crawler', 'no_user_agent', 'automation_tool',
                      'rate_limited', 'honeypot', 'bad_origin'))
);

comment on table public.bot_defence_events is
  'Requests refused before they reached a client link or a payment page.';

create index bot_defence_events_time_idx
  on public.bot_defence_events (occurred_at desc);

create or replace function public.record_bot_defence_event(
  p_path text,
  p_reason text,
  p_user_agent text default null,
  p_ip_hash text default null,
  p_company_id uuid default null
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
  if not public.is_service_role() then
    raise exception 'Only the server records refused requests' using errcode = '42501';
  end if;

  insert into public.bot_defence_events (
    company_id, path, reason, user_agent, ip_hash
  )
  values (
    p_company_id, left(p_path, 300), p_reason, left(p_user_agent, 400), p_ip_hash
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.record_bot_defence_event(text, text, text, text, uuid) is
  'Writes down one request that was refused before it could read anything.';

-- -----------------------------------------------------------------------------
-- Reading and setting the preferences
-- -----------------------------------------------------------------------------

create or replace function public.company_checkout_preferences(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.checkout_preferences%rowtype;
begin
  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You do not have permission to read this setting'
      using errcode = '42501';
  end if;

  select * into v_row
    from public.checkout_preferences
   where company_id = p_company_id;

  if not found then
    return jsonb_build_object(
      'accept_card_payments', true,
      'accept_bank_transfer', true,
      'accept_local_methods', true,
      'require_terms_acceptance', true,
      'require_delivery_confirmation', false,
      'require_billing_address', true,
      'block_mismatched_country', false,
      'card_minimum_amount', 0,
      'card_maximum_amount', null,
      'consent_statement',
        'I confirm I ordered this work, that it has been delivered to my satisfaction, and I authorise this payment.',
      'refund_window_days', 14,
      'is_default', true
    );
  end if;

  return jsonb_build_object(
    'accept_card_payments', v_row.accept_card_payments,
    'accept_bank_transfer', v_row.accept_bank_transfer,
    'accept_local_methods', v_row.accept_local_methods,
    'require_terms_acceptance', v_row.require_terms_acceptance,
    'require_delivery_confirmation', v_row.require_delivery_confirmation,
    'require_billing_address', v_row.require_billing_address,
    'block_mismatched_country', v_row.block_mismatched_country,
    'card_minimum_amount', v_row.card_minimum_amount,
    'card_maximum_amount', v_row.card_maximum_amount,
    'consent_statement', v_row.consent_statement,
    'refund_window_days', v_row.refund_window_days,
    'is_default', false
  );
end;
$$;

comment on function public.company_checkout_preferences(uuid) is
  'How one seller wants to be paid, with the platform defaults when they have not said.';

create or replace function public.save_checkout_preferences(
  p_company_id uuid,
  p_accept_card_payments boolean,
  p_accept_bank_transfer boolean default true,
  p_accept_local_methods boolean default true,
  p_require_terms_acceptance boolean default true,
  p_require_delivery_confirmation boolean default false,
  p_require_billing_address boolean default true,
  p_block_mismatched_country boolean default false,
  p_card_minimum_amount numeric default 0,
  p_card_maximum_amount numeric default null,
  p_consent_statement text default null,
  p_refund_window_days integer default 14
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_statement text;
begin
  if not (public.is_service_role() or public.is_company_owner(p_company_id)) then
    raise exception 'Only the account owner may change how payments are taken'
      using errcode = '42501';
  end if;

  v_statement := coalesce(
    nullif(btrim(coalesce(p_consent_statement, '')), ''),
    'I confirm I ordered this work, that it has been delivered to my satisfaction, and I authorise this payment.'
  );

  insert into public.checkout_preferences (
    company_id, accept_card_payments, accept_bank_transfer, accept_local_methods,
    require_terms_acceptance, require_delivery_confirmation, require_billing_address,
    block_mismatched_country, card_minimum_amount, card_maximum_amount,
    consent_statement, refund_window_days, updated_by
  )
  values (
    p_company_id, p_accept_card_payments, coalesce(p_accept_bank_transfer, true),
    coalesce(p_accept_local_methods, true), coalesce(p_require_terms_acceptance, true),
    coalesce(p_require_delivery_confirmation, false),
    coalesce(p_require_billing_address, true),
    coalesce(p_block_mismatched_country, false), coalesce(p_card_minimum_amount, 0),
    p_card_maximum_amount, v_statement, coalesce(p_refund_window_days, 14)::smallint,
    public.current_user_id()
  )
  on conflict (company_id) do update
     set accept_card_payments = excluded.accept_card_payments,
         accept_bank_transfer = excluded.accept_bank_transfer,
         accept_local_methods = excluded.accept_local_methods,
         require_terms_acceptance = excluded.require_terms_acceptance,
         require_delivery_confirmation = excluded.require_delivery_confirmation,
         require_billing_address = excluded.require_billing_address,
         block_mismatched_country = excluded.block_mismatched_country,
         card_minimum_amount = excluded.card_minimum_amount,
         card_maximum_amount = excluded.card_maximum_amount,
         consent_statement = excluded.consent_statement,
         refund_window_days = excluded.refund_window_days,
         updated_at = now(),
         updated_by = public.current_user_id()
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.save_checkout_preferences(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  numeric, numeric, text, integer
) is 'Sets how one seller is willing to be paid, cards included or excluded.';

-- Whether a card may be offered for one invoice, which is the preference and
-- the amount bands taken together.
create or replace function public.card_payment_allowed(p_invoice_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_preferences jsonb;
  v_maximum numeric;
begin
  select * into v_invoice
    from public.invoices
   where id = p_invoice_id
     and deleted_at is null;

  if not found then
    raise exception 'That invoice was not found' using errcode = 'P0002';
  end if;

  v_preferences := public.company_checkout_preferences(v_invoice.company_id);

  if not (v_preferences ->> 'accept_card_payments')::boolean then
    return jsonb_build_object(
      'is_allowed', false,
      'reason', 'This business does not take card payments.'
    );
  end if;

  if v_invoice.balance_due < (v_preferences ->> 'card_minimum_amount')::numeric then
    return jsonb_build_object(
      'is_allowed', false,
      'reason', 'This amount is below the card minimum for this business.'
    );
  end if;

  v_maximum := (v_preferences ->> 'card_maximum_amount')::numeric;

  if v_maximum is not null and v_invoice.balance_due > v_maximum then
    return jsonb_build_object(
      'is_allowed', false,
      'reason', 'This amount is above the card ceiling for this business.'
    );
  end if;

  return jsonb_build_object(
    'is_allowed', true,
    'reason', null,
    'consent_statement', v_preferences -> 'consent_statement',
    'require_terms_acceptance', v_preferences -> 'require_terms_acceptance',
    'require_billing_address', v_preferences -> 'require_billing_address'
  );
end;
$$;

comment on function public.card_payment_allowed(uuid) is
  'Says whether a card may be offered on one invoice, and on what conditions.';

-- -----------------------------------------------------------------------------
-- Capturing the agreement
-- -----------------------------------------------------------------------------

create or replace function public.record_checkout_consent(
  p_invoice_id uuid,
  p_consent_statement text,
  p_ip_address inet default null,
  p_ip_hash text default null,
  p_user_agent text default null,
  p_accept_language text default null,
  p_time_zone text default null,
  p_screen_fingerprint text default null,
  p_document_link_id uuid default null,
  p_payment_intent_id uuid default null,
  p_viewed_seconds integer default null,
  p_terms_version text default null,
  p_terms_hash text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_id uuid;
  v_evidence integer;
begin
  if not public.is_service_role() then
    raise exception 'An agreement is recorded by the server only' using errcode = '42501';
  end if;

  select * into v_invoice
    from public.invoices
   where id = p_invoice_id
     and deleted_at is null;

  if not found then
    raise exception 'That invoice was not found' using errcode = 'P0002';
  end if;

  select count(*)::int into v_evidence
    from public.invoice_work_evidence
   where invoice_id = p_invoice_id
     and deleted_at is null;

  insert into public.checkout_consents (
    company_id, invoice_id, payment_intent_id, document_link_id, consent_statement,
    statement_hash, terms_version, terms_hash, ip_address, ip_hash, user_agent,
    accept_language, time_zone, screen_fingerprint, invoice_number, amount,
    currency, evidence_item_count, viewed_seconds
  )
  values (
    v_invoice.company_id, p_invoice_id, p_payment_intent_id, p_document_link_id,
    btrim(p_consent_statement),
    encode(extensions.digest(btrim(p_consent_statement), 'sha256'), 'hex'),
    p_terms_version, p_terms_hash, p_ip_address, p_ip_hash, left(p_user_agent, 400),
    left(p_accept_language, 60), left(p_time_zone, 60), left(p_screen_fingerprint, 120),
    v_invoice.invoice_number, v_invoice.balance_due, v_invoice.currency,
    coalesce(v_evidence, 0), p_viewed_seconds
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.record_checkout_consent(
  uuid, text, inet, text, text, text, text, text, uuid, uuid, integer, text, text
) is 'Freezes what the payer agreed to at the moment they agreed to it.';

-- -----------------------------------------------------------------------------
-- How strong the file is, before anybody disputes anything
-- -----------------------------------------------------------------------------

-- A dispute is won on documents. This scores the file the seller would be
-- able to submit today and names what is missing, so the gap is closed while
-- the client is still friendly rather than after the money is taken back.
create or replace function public.dispute_readiness(p_invoice_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_score integer := 0;
  v_missing text[] := array[]::text[];
  v_has_evidence boolean;
  v_has_consent boolean;
  v_has_delivery boolean;
  v_has_view boolean;
  v_has_terms boolean;
  v_has_profile boolean;
  v_has_payment boolean;
begin
  select * into v_invoice
    from public.invoices
   where id = p_invoice_id
     and deleted_at is null;

  if not found then
    raise exception 'That invoice was not found' using errcode = 'P0002';
  end if;

  if not (public.is_service_role() or public.has_company_access(v_invoice.company_id)) then
    raise exception 'You do not have permission to read this invoice'
      using errcode = '42501';
  end if;

  select exists (
    select 1 from public.invoice_work_evidence
     where invoice_id = p_invoice_id and deleted_at is null and is_client_visible
  ) into v_has_evidence;

  select exists (
    select 1 from public.checkout_consents where invoice_id = p_invoice_id
  ) into v_has_consent;

  select exists (
    select 1 from public.document_events
     where document_kind = 'invoice'
       and document_id = p_invoice_id
       and event_type in ('sent', 'delivered')
  ) into v_has_delivery;

  select exists (
    select 1 from public.document_events
     where document_kind = 'invoice'
       and document_id = p_invoice_id
       and event_type in ('viewed', 'opened')
  ) into v_has_view;

  v_has_terms := coalesce(btrim(v_invoice.terms_and_conditions), '') <> '';
  v_has_profile := v_invoice.company_profile_snapshot_id is not null;

  select exists (
    select 1 from public.payments as p
      join public.payment_allocations as a on a.payment_id = p.id
     where a.invoice_id = p_invoice_id
       and p.status = 'succeeded'
       and p.deleted_at is null
  ) into v_has_payment;

  if v_has_evidence then
    v_score := v_score + 30;
  else
    v_missing := array_append(v_missing, 'Attach proof of the delivered work');
  end if;

  if v_has_consent then
    v_score := v_score + 25;
  elsif v_has_payment then
    v_missing := array_append(v_missing, 'No record of the payer agreeing before paying');
  end if;

  if v_has_delivery then
    v_score := v_score + 15;
  else
    v_missing := array_append(v_missing, 'Send the invoice from the platform so delivery is recorded');
  end if;

  if v_has_view then
    v_score := v_score + 10;
  else
    v_missing := array_append(v_missing, 'The client has not opened the invoice link yet');
  end if;

  if v_has_terms then
    v_score := v_score + 10;
  else
    v_missing := array_append(v_missing, 'Add terms and conditions to this invoice');
  end if;

  if v_has_profile then
    v_score := v_score + 10;
  else
    v_missing := array_append(v_missing, 'Issue the invoice so your business details are frozen on it');
  end if;

  return jsonb_build_object(
    'invoice_id', p_invoice_id,
    'score', v_score,
    'band', case
              when v_score >= 90 then 'strong'
              when v_score >= 60 then 'workable'
              else 'weak'
            end,
    'has_work_evidence', v_has_evidence,
    'has_consent_record', v_has_consent,
    'has_delivery_proof', v_has_delivery,
    'has_view_proof', v_has_view,
    'has_terms', v_has_terms,
    'has_frozen_profile', v_has_profile,
    'missing', to_jsonb(v_missing)
  );
end;
$$;

comment on function public.dispute_readiness(uuid) is
  'Scores the file a seller could submit if this invoice were disputed today.';

-- The agreement, added to the evidence package the platform submits.
create or replace function public.attach_consent_to_dispute(p_dispute_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_dispute public.disputes%rowtype;
  v_count integer := 0;
  v_row record;
begin
  select * into v_dispute from public.disputes where id = p_dispute_id;

  if not found then
    raise exception 'That dispute was not found' using errcode = 'P0002';
  end if;

  if not (public.is_service_role()
          or public.can_write_company_data(v_dispute.company_id)) then
    raise exception 'You are not allowed to work on disputes in this company'
      using errcode = '42501';
  end if;

  if v_dispute.invoice_id is null then
    return 0;
  end if;

  for v_row in
    select * from public.checkout_consents
     where invoice_id = v_dispute.invoice_id
     order by agreed_at
  loop
    insert into public.dispute_evidence_items (
      company_id, dispute_id, evidence_type, title, description, payload, collected_by
    )
    values (
      v_dispute.company_id, p_dispute_id, 'client_consent',
      'Authorisation given by the payer',
      v_row.consent_statement,
      jsonb_build_object(
        'agreed_at', v_row.agreed_at,
        'ip_address', host(v_row.ip_address),
        'user_agent', v_row.user_agent,
        'accept_language', v_row.accept_language,
        'time_zone', v_row.time_zone,
        'device_fingerprint', v_row.screen_fingerprint,
        'statement_hash', v_row.statement_hash,
        'terms_version', v_row.terms_version,
        'invoice_number', v_row.invoice_number,
        'amount', v_row.amount,
        'currency', v_row.currency,
        'work_items_shown', v_row.evidence_item_count,
        'seconds_on_page', v_row.viewed_seconds
      ),
      public.current_user_id()
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.attach_consent_to_dispute(uuid) is
  'Adds the payer authorisation to the evidence package answering a chargeback.';

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.checkout_preferences enable row level security;
alter table public.checkout_consents enable row level security;
alter table public.bot_defence_events enable row level security;
alter table public.checkout_preferences force row level security;
alter table public.checkout_consents force row level security;
alter table public.bot_defence_events force row level security;

create policy checkout_preferences_select on public.checkout_preferences
  for select to authenticated
  using (public.has_company_access(company_id));

create policy checkout_consents_select on public.checkout_consents
  for select to authenticated
  using (public.has_company_access(company_id));

create policy bot_defence_events_select on public.bot_defence_events
  for select to authenticated
  using (public.is_super_admin());

comment on policy checkout_consents_select on public.checkout_consents is
  'A seller reads the authorisations given on their own invoices and no other.';

grant select on public.checkout_preferences to authenticated;
grant select on public.checkout_consents to authenticated;
grant select on public.bot_defence_events to authenticated;

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.record_bot_defence_event(text, text, text, text, uuid)
  from public, authenticated;
revoke execute on function public.company_checkout_preferences(uuid)
  from public, authenticated;
revoke execute on function public.save_checkout_preferences(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  numeric, numeric, text, integer
) from public, authenticated;
revoke execute on function public.card_payment_allowed(uuid)
  from public, authenticated;
revoke execute on function public.record_checkout_consent(
  uuid, text, inet, text, text, text, text, text, uuid, uuid, integer, text, text
) from public, authenticated;
revoke execute on function public.dispute_readiness(uuid)
  from public, authenticated;
revoke execute on function public.attach_consent_to_dispute(uuid)
  from public, authenticated;

grant execute on function public.record_bot_defence_event(text, text, text, text, uuid)
  to service_role;
grant execute on function public.company_checkout_preferences(uuid)
  to authenticated, service_role;
grant execute on function public.save_checkout_preferences(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  numeric, numeric, text, integer
) to authenticated, service_role;
grant execute on function public.card_payment_allowed(uuid) to service_role;
grant execute on function public.record_checkout_consent(
  uuid, text, inet, text, text, text, text, text, uuid, uuid, integer, text, text
) to service_role;
grant execute on function public.dispute_readiness(uuid)
  to authenticated, service_role;
grant execute on function public.attach_consent_to_dispute(uuid)
  to authenticated, service_role;

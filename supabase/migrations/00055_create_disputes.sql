-- supabase/migrations/00055_create_disputes.sql
-- Chargebacks and the evidence assembled to answer them.
--
-- Because the platform runs without 3D Secure by default, the defence against
-- a chargeback is the evidence chain: what was agreed, what was sent, when the
-- client opened it, what they consented to and when the work was delivered.
-- Everything needed for that answer is gathered here.

create table public.disputes (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  payment_id uuid not null,
  invoice_id uuid,
  client_id uuid,

  provider public.gateway_provider not null,
  provider_dispute_reference text,
  case_number text,

  status public.dispute_status not null default 'open',
  reason_code text,
  reason_description text,

  disputed_amount numeric(18, 4) not null,
  currency char(3) not null,
  fee_amount numeric(18, 4) not null default 0,

  opened_at timestamptz not null default now(),
  evidence_due_at timestamptz,
  evidence_submitted_at timestamptz,
  resolved_at timestamptz,
  outcome_note text,

  -- Snapshot of the evidence package that was sent to the provider.
  evidence_summary jsonb not null default '{}'::jsonb,
  submitted_by uuid,

  is_recoverable boolean not null default true,
  recovered_amount numeric(18, 4) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint disputes_amount_check
    check (disputed_amount > 0 and fee_amount >= 0 and recovered_amount >= 0),
  constraint disputes_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint disputes_evidence_check
    check (jsonb_typeof(evidence_summary) = 'object'),
  constraint disputes_resolution_check
    check (status not in ('won', 'lost', 'withdrawn') or resolved_at is not null)
);

comment on table public.disputes is
  'Chargebacks raised by a card holder, with their deadlines and outcome.';

create unique index disputes_provider_reference_unique
  on public.disputes (provider, provider_dispute_reference)
  where provider_dispute_reference is not null and deleted_at is null;

create index disputes_company_idx
  on public.disputes (company_id, status, opened_at desc)
  where deleted_at is null;

create index disputes_payment_idx
  on public.disputes (payment_id)
  where deleted_at is null;

create index disputes_deadline_idx
  on public.disputes (evidence_due_at)
  where deleted_at is null and status in ('open', 'evidence_required');

-- -----------------------------------------------------------------------------
-- Evidence items
-- -----------------------------------------------------------------------------

create table public.dispute_evidence_items (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  dispute_id uuid not null,

  -- For example invoice_pdf, delivery_proof, client_consent, email_log,
  -- view_log, terms_accepted, communication_thread.
  evidence_type text not null,
  title text not null,
  description text,

  -- Either a stored file or a structured extract from the platform data.
  storage_key text,
  file_name text,
  file_size_bytes bigint,
  content_sha256 text,
  payload jsonb,

  collected_at timestamptz not null default now(),
  collected_by uuid,
  included_in_submission boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dispute_evidence_type_check
    check (length(btrim(evidence_type)) between 2 and 60),
  constraint dispute_evidence_title_check
    check (length(btrim(title)) between 2 and 160),
  constraint dispute_evidence_source_check
    check (storage_key is not null or payload is not null),
  constraint dispute_evidence_hash_check
    check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint dispute_evidence_size_check
    check (file_size_bytes is null or file_size_bytes >= 0)
);

comment on table public.dispute_evidence_items is
  'Individual documents and records gathered to answer a chargeback.';

create index dispute_evidence_dispute_idx
  on public.dispute_evidence_items (dispute_id, collected_at);

create index dispute_evidence_company_idx
  on public.dispute_evidence_items (company_id);

-- Evidence is a legal record and is never rewritten once collected.
create trigger dispute_evidence_append_only
  before update or delete on public.dispute_evidence_items
  for each row execute function public.block_audit_mutation();

-- Builds the standard evidence package for a dispute from the data the
-- platform already holds, so the owner starts with a complete answer rather
-- than a blank form.
create or replace function public.assemble_dispute_evidence(p_dispute_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_dispute public.disputes%rowtype;
  v_invoice public.invoices%rowtype;
  v_count integer := 0;
begin
  select * into v_dispute from public.disputes where id = p_dispute_id;

  if not found then
    raise exception 'Dispute % was not found', p_dispute_id using errcode = 'P0002';
  end if;

  if not public.can_write_company_data(v_dispute.company_id) then
    raise exception 'You are not allowed to work on disputes in this company'
      using errcode = '42501';
  end if;

  if v_dispute.invoice_id is null then
    return 0;
  end if;

  select * into v_invoice from public.invoices where id = v_dispute.invoice_id;

  -- The invoice as it was issued.
  insert into public.dispute_evidence_items (
    company_id, dispute_id, evidence_type, title, storage_key, payload, collected_by
  )
  values (
    v_dispute.company_id, p_dispute_id, 'invoice_document',
    'Issued invoice ' || coalesce(v_invoice.invoice_number, ''),
    v_invoice.pdf_storage_key,
    jsonb_build_object(
      'invoice_number', v_invoice.invoice_number,
      'issue_date', v_invoice.issue_date,
      'total_amount', v_invoice.total_amount,
      'currency', v_invoice.currency,
      'bill_to', v_invoice.bill_to
    ),
    public.current_user_id()
  );
  v_count := v_count + 1;

  -- Delivery and viewing history.
  insert into public.dispute_evidence_items (
    company_id, dispute_id, evidence_type, title, payload, collected_by
  )
  select v_dispute.company_id, p_dispute_id, 'delivery_history',
         'Delivery and viewing history',
         jsonb_agg(
           jsonb_build_object(
             'event', e.event_type,
             'occurred_at', e.occurred_at,
             'ip_address', host(e.ip_address),
             'recipient', e.recipient_email
           )
           order by e.occurred_at
         ),
         public.current_user_id()
    from public.document_events as e
   where e.document_kind = 'invoice'
     and e.document_id = v_dispute.invoice_id
  having count(*) > 0;

  if found then
    v_count := v_count + 1;
  end if;

  -- The payment itself.
  insert into public.dispute_evidence_items (
    company_id, dispute_id, evidence_type, title, payload, collected_by
  )
  select v_dispute.company_id, p_dispute_id, 'payment_record',
         'Payment record',
         jsonb_build_object(
           'amount', p.amount,
           'currency', p.currency,
           'received_at', p.received_at,
           'provider', p.provider,
           'provider_reference', p.provider_payment_reference,
           'payer_email', p.payer_email,
           'method_type', p.method_type
         ),
         public.current_user_id()
    from public.payments as p
   where p.id = v_dispute.payment_id;
  v_count := v_count + 1;

  update public.disputes
     set evidence_summary = jsonb_build_object(
           'item_count', v_count,
           'assembled_at', now()
         ),
         updated_at = now()
   where id = p_dispute_id;

  return v_count;
end;
$$;

comment on function public.assemble_dispute_evidence(uuid) is
  'Collects the invoice, delivery history and payment record into the evidence file.';

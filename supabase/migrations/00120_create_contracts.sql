-- supabase/migrations/00120_create_contracts.sql
-- Contracts and the people who have to sign them.
--
-- A signature is only worth anything if you can show what was signed, by
-- whom, from where and when. So the contract freezes its own content when it
-- is sent, and every signer carries their own evidence.

create table public.contracts (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  client_id uuid,
  project_id uuid,

  contract_number text not null,
  title text not null,
  status text not null default 'draft',

  -- The wording as it will be signed. Frozen the moment the contract is sent.
  body_html text not null,
  body_text text,
  content_hash text,
  variables jsonb not null default '{}'::jsonb,

  currency char(3),
  contract_value numeric(18, 4),
  effective_date date,
  expiry_date date,
  -- Signing deadline, after which the invitation stops working.
  valid_until date,

  requires_all_signers boolean not null default true,
  signing_order_enforced boolean not null default false,
  signer_count smallint not null default 0,
  signed_count smallint not null default 0,

  sent_at timestamptz,
  first_viewed_at timestamptz,
  completed_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  voided_at timestamptz,
  void_reason text,

  -- The sealed copy produced once everybody has signed.
  sealed_file_id uuid,
  sealed_sha256 text,
  sealed_at timestamptz,

  template_id uuid,
  invoice_id uuid,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint contracts_number_check
    check (contract_number ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{1,31}$'),
  constraint contracts_title_check
    check (length(btrim(title)) between 2 and 200),
  constraint contracts_status_check
    check (status in ('draft', 'sent', 'partially_signed', 'completed',
                      'declined', 'expired', 'voided')),
  constraint contracts_body_check
    check (length(btrim(body_html)) >= 20),
  constraint contracts_hash_check
    check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),
  constraint contracts_sealed_hash_check
    check (sealed_sha256 is null or sealed_sha256 ~ '^[0-9a-f]{64}$'),
  constraint contracts_currency_check
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint contracts_value_check
    check (contract_value is null or contract_value >= 0),
  constraint contracts_dates_check
    check (expiry_date is null or effective_date is null
           or expiry_date >= effective_date),
  constraint contracts_counts_check
    check (signer_count >= 0 and signed_count >= 0
           and signed_count <= signer_count),
  constraint contracts_sent_check
    check (status = 'draft' or sent_at is not null),
  constraint contracts_declined_check
    check (status <> 'declined' or decline_reason is not null),
  constraint contracts_voided_check
    check (status <> 'voided' or void_reason is not null),
  constraint contracts_completed_check
    check (status <> 'completed' or completed_at is not null)
);

comment on table public.contracts is
  'An agreement sent for signature, with the wording that was actually signed.';

comment on column public.contracts.content_hash is
  'Digest of the wording at the moment of sending, so a change can be proved.';

create unique index contracts_number_key
  on public.contracts (company_id, contract_number)
  where deleted_at is null;

create index contracts_company_status_idx
  on public.contracts (company_id, status, created_at desc)
  where deleted_at is null;

create index contracts_client_idx
  on public.contracts (client_id)
  where client_id is not null and deleted_at is null;

create index contracts_awaiting_idx
  on public.contracts (company_id, valid_until)
  where status in ('sent', 'partially_signed') and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Reusable wording
-- -----------------------------------------------------------------------------

create table public.contract_templates (
  id uuid primary key default public.generate_uuid_v7(),
  -- Null for the wording the platform ships with.
  company_id uuid,

  template_key text not null,
  name text not null,
  description text,
  category text not null default 'general',

  body_html text not null,
  body_text text,
  -- The merge fields this wording expects, so the editor can offer them.
  variables jsonb not null default '[]'::jsonb,

  is_active boolean not null default true,
  usage_count integer not null default 0,
  version smallint not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint contract_templates_key_check
    check (template_key ~ '^[a-z][a-z0-9_]{2,40}$'),
  constraint contract_templates_name_check
    check (length(btrim(name)) between 2 and 120),
  constraint contract_templates_category_check
    check (category in ('general', 'services', 'retainer', 'nda',
                        'statement_of_work', 'quote_acceptance')),
  constraint contract_templates_body_check
    check (length(btrim(body_html)) >= 20),
  constraint contract_templates_variables_check
    check (jsonb_typeof(variables) = 'array')
);

comment on table public.contract_templates is
  'Reusable contract wording, shipped by the platform or written by a tenant.';

create unique index contract_templates_key_unique
  on public.contract_templates (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
                                template_key)
  where deleted_at is null;

create index contract_templates_company_idx
  on public.contract_templates (company_id)
  where deleted_at is null;

-- Wording every new tenant can use on its first day.
insert into public.contract_templates (
  company_id, template_key, name, description, category, body_html, body_text,
  variables
)
values
  (
    null,
    'service_agreement',
    'Service agreement',
    'A plain English agreement for ongoing professional services.',
    'services',
    '<h1>Service agreement</h1>'
    || '<p>This agreement is made between {{company_name}} and {{client_name}} '
    || 'on {{effective_date}}.</p>'
    || '<h2>The work</h2><p>{{scope_of_work}}</p>'
    || '<h2>Fees</h2><p>The fee for this work is {{contract_value}}. '
    || 'Invoices are payable within {{payment_terms_days}} days of the invoice date.</p>'
    || '<h2>Ending the agreement</h2><p>Either party may end this agreement with '
    || '{{notice_period_days}} days written notice. Work completed up to that date remains payable.</p>'
    || '<h2>Confidentiality</h2><p>Both parties will keep the information of the other confidential.</p>'
    || '<p>Signed by the parties below.</p>',
    'Service agreement between {{company_name}} and {{client_name}}.',
    '["company_name", "client_name", "effective_date", "scope_of_work", "contract_value", "payment_terms_days", "notice_period_days"]'::jsonb
  ),
  (
    null,
    'statement_of_work',
    'Statement of work',
    'A scoped piece of project work with deliverables and milestones.',
    'statement_of_work',
    '<h1>Statement of work</h1>'
    || '<p>Project: {{project_name}}, prepared for {{client_name}} by {{company_name}}.</p>'
    || '<h2>Deliverables</h2><p>{{deliverables}}</p>'
    || '<h2>Timeline</h2><p>Work starts on {{start_date}} and is expected to finish by {{end_date}}.</p>'
    || '<h2>Price</h2><p>The agreed price is {{contract_value}}, invoiced against the milestones listed above.</p>'
    || '<h2>Changes</h2><p>Anything outside the deliverables above is quoted separately before it begins.</p>',
    'Statement of work for {{project_name}}.',
    '["project_name", "client_name", "company_name", "deliverables", "start_date", "end_date", "contract_value"]'::jsonb
  ),
  (
    null,
    'mutual_nda',
    'Mutual non disclosure agreement',
    'A two way confidentiality agreement to use before sharing detail.',
    'nda',
    '<h1>Mutual non disclosure agreement</h1>'
    || '<p>Between {{company_name}} and {{client_name}}, effective {{effective_date}}.</p>'
    || '<h2>Confidential information</h2><p>Each party may share information that is not public. '
    || 'The receiving party will use it only to work together and will not pass it on.</p>'
    || '<h2>How long this lasts</h2><p>These obligations continue for {{confidentiality_years}} years '
    || 'from the effective date.</p>'
    || '<h2>Returning information</h2><p>On request, each party will return or destroy the information it holds.</p>',
    'Mutual non disclosure agreement between {{company_name}} and {{client_name}}.',
    '["company_name", "client_name", "effective_date", "confidentiality_years"]'::jsonb
  );

-- -----------------------------------------------------------------------------
-- The signers
-- -----------------------------------------------------------------------------

create table public.contract_signers (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  contract_id uuid not null,

  full_name text not null,
  email citext not null,
  role_label text not null default 'Client',
  signing_order smallint not null default 1,
  is_internal boolean not null default false,

  status text not null default 'pending',

  -- The invitation. Clients hold no account, so this is a signed link like
  -- every other client facing document.
  document_link_id uuid,
  invited_at timestamptz,
  reminded_at timestamptz,
  reminder_count smallint not null default 0,
  viewed_at timestamptz,

  -- The signature itself and the evidence around it.
  signed_at timestamptz,
  signature_type text,
  signature_image_file_id uuid,
  typed_signature text,
  signature_hash text,
  signed_ip_hash text,
  signed_user_agent text,
  -- Consent to sign electronically, captured separately and deliberately.
  consent_given_at timestamptz,
  consent_text text,

  declined_at timestamptz,
  decline_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint contract_signers_name_check
    check (length(btrim(full_name)) between 2 and 120),
  constraint contract_signers_email_check
    check (public.is_valid_email(email::text)),
  constraint contract_signers_order_check
    check (signing_order between 1 and 20),
  constraint contract_signers_status_check
    check (status in ('pending', 'invited', 'viewed', 'signed', 'declined')),
  constraint contract_signers_type_check
    check (signature_type is null
           or signature_type in ('typed', 'drawn', 'uploaded')),
  constraint contract_signers_hash_check
    check (signature_hash is null or signature_hash ~ '^[0-9a-f]{64}$'),
  constraint contract_signers_ip_check
    check (signed_ip_hash is null or signed_ip_hash ~ '^[0-9a-f]{64}$'),
  constraint contract_signers_signed_check
    check (status <> 'signed'
           or (signed_at is not null and consent_given_at is not null)),
  constraint contract_signers_declined_check
    check (status <> 'declined' or decline_reason is not null)
);

comment on table public.contract_signers is
  'One party to a contract, with the evidence of their signature.';

create unique index contract_signers_email_unique
  on public.contract_signers (contract_id, email);

create index contract_signers_contract_idx
  on public.contract_signers (contract_id, signing_order);

create index contract_signers_pending_idx
  on public.contract_signers (company_id, status)
  where status in ('invited', 'viewed');

-- -----------------------------------------------------------------------------
-- The audit trail
-- -----------------------------------------------------------------------------

create table public.contract_events (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  contract_id uuid not null,
  signer_id uuid,

  event_type text not null,
  description text not null,
  actor_user_id uuid,
  actor_email citext,
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint contract_events_type_check
    check (event_type in ('created', 'sent', 'viewed', 'signed', 'declined',
                          'reminded', 'completed', 'voided', 'expired',
                          'downloaded', 'sealed')),
  constraint contract_events_description_check
    check (length(btrim(description)) between 2 and 300),
  constraint contract_events_ip_check
    check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$')
);

comment on table public.contract_events is
  'The permanent trail of everything that happened to a contract.';

create index contract_events_contract_idx
  on public.contract_events (contract_id, created_at);

create index contract_events_company_idx
  on public.contract_events (company_id, created_at desc);

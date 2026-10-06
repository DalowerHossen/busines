-- supabase/migrations/00197_create_kyc_verification.sql
-- Knowing who we are collecting money for.
--
-- The platform acts as merchant of record, so before a business may be paid
-- out somebody has to prove the business exists and that the person asking
-- is entitled to act for it. The record below is deliberately append heavy:
-- a submission is kept even after it is refused, because that history is
-- what an acquirer asks for.

create type public.kyc_document_type as enum (
  'national_id',
  'passport',
  'driving_licence',
  'business_registration',
  'tax_certificate',
  'bank_statement',
  'utility_bill',
  'board_resolution',
  'other'
);

create type public.kyc_document_side as enum (
  'front',
  'back',
  'single'
);

create table public.kyc_verifications (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  status public.kyc_status not null default 'in_progress',

  -- Who the business is, in its own words, to be checked against the papers.
  legal_entity_type text not null default 'company',
  legal_name text not null,
  registration_number text,
  tax_identification_number text,
  incorporation_country char(2) not null default 'US',
  incorporation_date date,

  -- The person answering for the business.
  representative_name text not null,
  representative_role text,
  representative_email citext not null,
  representative_phone text,
  representative_date_of_birth date,

  registered_address_line1 text,
  registered_address_line2 text,
  registered_city text,
  registered_region text,
  registered_postal_code text,
  registered_country char(2) not null default 'US',

  -- What the business says it sells, which is what the acquirer underwrites.
  business_description text,
  expected_monthly_volume numeric(18, 4),
  website text,

  submitted_at timestamptz,
  submitted_by uuid,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_note text,
  rejection_reason text,
  expires_on date,

  risk_level public.risk_level not null default 'low',
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint kyc_verifications_entity_check
    check (legal_entity_type in ('sole_trader', 'partnership', 'company', 'non_profit')),
  constraint kyc_verifications_legal_name_check
    check (length(btrim(legal_name)) between 2 and 200),
  constraint kyc_verifications_representative_check
    check (length(btrim(representative_name)) between 2 and 160),
  constraint kyc_verifications_country_check
    check (incorporation_country ~ '^[A-Z]{2}$' and registered_country ~ '^[A-Z]{2}$'),
  constraint kyc_verifications_volume_check
    check (expected_monthly_volume is null or expected_monthly_volume >= 0),
  constraint kyc_verifications_submitted_check
    check (status not in ('submitted', 'under_review', 'verified') or submitted_at is not null),
  constraint kyc_verifications_rejected_check
    check (status <> 'rejected' or rejection_reason is not null),
  constraint kyc_verifications_metadata_check
    check (jsonb_typeof(metadata) = 'object')
);

comment on table public.kyc_verifications is
  'What a business told us about itself so the platform may collect on its behalf.';
comment on column public.kyc_verifications.expires_on is
  'When the approved check lapses and the papers have to be seen again.';

-- One live submission per business; refused ones stay for the history.
create unique index kyc_verifications_live_unique
  on public.kyc_verifications (company_id)
  where deleted_at is null and status <> 'rejected' and status <> 'expired';

create index kyc_verifications_company_idx
  on public.kyc_verifications (company_id, created_at desc)
  where deleted_at is null;

create index kyc_verifications_queue_idx
  on public.kyc_verifications (submitted_at)
  where deleted_at is null and status in ('submitted', 'under_review');

-- -----------------------------------------------------------------------------
-- Documents
-- -----------------------------------------------------------------------------

-- Identity papers are photographed on both sides, so the side is part of the
-- record rather than something guessed from a file name.
create table public.kyc_documents (
  id uuid primary key default public.generate_uuid_v7(),
  verification_id uuid not null,
  company_id uuid not null,

  document_type public.kyc_document_type not null,
  document_side public.kyc_document_side not null default 'single',

  file_id uuid,
  storage_key text not null,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  byte_size bigint not null default 0,

  document_number text,
  issuing_country char(2),
  issued_on date,
  expires_on date,

  review_note text,
  is_accepted boolean,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint kyc_documents_file_name_check
    check (length(btrim(file_name)) between 1 and 200),
  constraint kyc_documents_size_check
    check (byte_size between 0 and 10485760),
  constraint kyc_documents_country_check
    check (issuing_country is null or issuing_country ~ '^[A-Z]{2}$'),
  constraint kyc_documents_dates_check
    check (expires_on is null or issued_on is null or expires_on > issued_on)
);

comment on table public.kyc_documents is
  'The papers uploaded for one identity check, one row per side of a document.';

create unique index kyc_documents_side_unique
  on public.kyc_documents (verification_id, document_type, document_side)
  where deleted_at is null;

create index kyc_documents_verification_idx
  on public.kyc_documents (verification_id)
  where deleted_at is null;

alter table public.kyc_verifications
  add constraint kyc_verifications_company_fk
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.kyc_documents
  add constraint kyc_documents_verification_fk
  foreign key (verification_id) references public.kyc_verifications (id) on delete cascade;

alter table public.kyc_documents
  add constraint kyc_documents_company_fk
  foreign key (company_id) references public.companies (id) on delete cascade;

select public.install_standard_triggers('kyc_verifications');
select public.install_standard_triggers('kyc_documents');
select public.install_audit_trigger('kyc_verifications');

-- -----------------------------------------------------------------------------
-- Submitting and reviewing
-- -----------------------------------------------------------------------------

-- Hands a completed check to the platform team.
--
-- An identity document has to be present on both sides, because a single
-- photograph of the front proves nothing about the back of the card.
create or replace function public.submit_kyc_verification(p_verification_id uuid)
returns public.kyc_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_verification public.kyc_verifications%rowtype;
  v_identity_sides integer;
  v_business_papers integer;
begin
  select * into v_verification
    from public.kyc_verifications
   where id = p_verification_id
     and deleted_at is null
     for update;

  if not found then
    raise exception 'Identity check % was not found', p_verification_id using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_company_owner(v_verification.company_id)) then
    raise exception 'Only the account owner can submit the identity check'
      using errcode = '42501';
  end if;

  if v_verification.status in ('submitted', 'under_review', 'verified') then
    raise exception 'This check has already been sent to us' using errcode = '22023';
  end if;

  select count(*)
    into v_identity_sides
    from public.kyc_documents
   where verification_id = p_verification_id
     and deleted_at is null
     and document_type in ('national_id', 'passport', 'driving_licence');

  if v_identity_sides < 2 then
    raise exception 'Upload the front and the back of the identity document'
      using errcode = '22023';
  end if;

  select count(*)
    into v_business_papers
    from public.kyc_documents
   where verification_id = p_verification_id
     and deleted_at is null
     and document_type in ('business_registration', 'tax_certificate');

  if v_verification.legal_entity_type <> 'sole_trader' and v_business_papers < 1 then
    raise exception 'Upload the registration certificate of the business'
      using errcode = '22023';
  end if;

  update public.kyc_verifications
     set status = 'submitted',
         submitted_at = now(),
         submitted_by = public.current_user_id(),
         rejection_reason = null,
         updated_at = now()
   where id = p_verification_id;

  update public.companies
     set kyc_status = 'submitted',
         updated_at = now()
   where id = v_verification.company_id;

  return 'submitted'::public.kyc_status;
end;
$$;

comment on function public.submit_kyc_verification(uuid) is
  'Sends a completed identity check to the platform team for review.';

-- Approves or refuses a check and moves the business with it.
create or replace function public.review_kyc_verification(
  p_verification_id uuid,
  p_approve boolean,
  p_note text default null,
  p_valid_months smallint default 24
)
returns public.kyc_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_verification public.kyc_verifications%rowtype;
  v_status public.kyc_status;
begin
  if not public.is_super_admin() then
    raise exception 'Only the platform team can decide an identity check'
      using errcode = '42501';
  end if;

  select * into v_verification
    from public.kyc_verifications
   where id = p_verification_id
     and deleted_at is null
     for update;

  if not found then
    raise exception 'Identity check % was not found', p_verification_id using errcode = 'P0002';
  end if;

  if v_verification.status not in ('submitted', 'under_review') then
    raise exception 'That check is not waiting for a decision' using errcode = '22023';
  end if;

  if not p_approve and coalesce(length(btrim(p_note)), 0) < 3 then
    raise exception 'Say what is missing before refusing a check' using errcode = '22023';
  end if;

  v_status := case when p_approve then 'verified' else 'rejected' end::public.kyc_status;

  update public.kyc_verifications
     set status = v_status,
         reviewed_at = now(),
         reviewed_by = public.current_user_id(),
         review_note = p_note,
         rejection_reason = case when p_approve then null else p_note end,
         expires_on = case
                        when p_approve
                        then (current_date + make_interval(months => greatest(p_valid_months, 1)))::date
                        else null
                      end,
         updated_at = now()
   where id = p_verification_id;

  update public.companies
     set kyc_status = v_status,
         mor_enabled = case when p_approve then true else mor_enabled end,
         mor_enabled_at = case
                            when p_approve then coalesce(mor_enabled_at, now())
                            else mor_enabled_at
                          end,
         updated_at = now()
   where id = v_verification.company_id;

  perform public.record_manual_audit_entry(
    case when p_approve then 'approve'::public.audit_action else 'reject'::public.audit_action end,
    'kyc_verification',
    p_verification_id,
    v_verification.company_id,
    case when p_approve then 'Identity check approved' else 'Identity check refused' end,
    jsonb_build_object('note', p_note)
  );

  return v_status;
end;
$$;

comment on function public.review_kyc_verification(uuid, boolean, text, smallint) is
  'Approves an identity check and unlocks payouts, or refuses it with a reason.';

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.kyc_verifications enable row level security;
alter table public.kyc_documents enable row level security;
alter table public.kyc_verifications force row level security;
alter table public.kyc_documents force row level security;

create policy kyc_verifications_select on public.kyc_verifications
  for select to authenticated
  using (public.is_super_admin() or public.is_company_owner(company_id));

create policy kyc_verifications_insert on public.kyc_verifications
  for insert to authenticated
  with check (public.is_super_admin() or public.is_company_owner(company_id));

create policy kyc_verifications_update on public.kyc_verifications
  for update to authenticated
  using (
    public.is_super_admin()
    or (public.is_company_owner(company_id) and status in ('in_progress', 'rejected'))
  )
  with check (public.is_super_admin() or public.is_company_owner(company_id));

comment on policy kyc_verifications_select on public.kyc_verifications is
  'Identity papers are owner business only; staff never see them.';

create policy kyc_documents_select on public.kyc_documents
  for select to authenticated
  using (public.is_super_admin() or public.is_company_owner(company_id));

create policy kyc_documents_insert on public.kyc_documents
  for insert to authenticated
  with check (public.is_super_admin() or public.is_company_owner(company_id));

create policy kyc_documents_update on public.kyc_documents
  for update to authenticated
  using (public.is_super_admin() or public.is_company_owner(company_id))
  with check (public.is_super_admin() or public.is_company_owner(company_id));

grant select, insert, update on public.kyc_verifications to authenticated;
grant select, insert, update on public.kyc_documents to authenticated;
grant execute on function public.submit_kyc_verification(uuid) to authenticated;
grant execute on function public.review_kyc_verification(uuid, boolean, text, smallint)
  to authenticated;

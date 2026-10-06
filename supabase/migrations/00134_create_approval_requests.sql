-- supabase/migrations/00134_create_approval_requests.sql
-- Four eyes approvals and the record of who looked at sensitive data.
--
-- When a tenant policy says an action is too large for one person, the action
-- is not performed. A request is raised instead, somebody else approves it,
-- and only then does the original action run. The person who asked can never
-- be the person who approves.

create table public.approval_requests (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  request_number text not null,
  -- What is waiting to happen, for example 'payout' or 'refund'.
  action_type text not null,
  -- The row the action would change, when there is one.
  entity_type text,
  entity_id uuid,

  title text not null,
  reason text,
  -- Everything the action needs in order to run once it is approved.
  payload jsonb not null default '{}'::jsonb,
  amount numeric(18, 4),
  currency_code char(3),

  status public.approval_status not null default 'pending',
  -- How many separate approvals this request needs.
  required_approvals smallint not null default 1,
  approvals_received smallint not null default 0,

  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  expires_at timestamptz,

  decided_by uuid,
  decided_at timestamptz,
  decision_note text,

  -- Set once the approved action has actually been carried out.
  executed_at timestamptz,
  execution_result jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint approval_requests_number_check
    check (request_number ~ '^AP-[0-9]{4,10}$'),
  constraint approval_requests_action_check
    check (action_type ~ '^[a-z][a-z0-9_]{2,40}$'),
  constraint approval_requests_title_check
    check (length(btrim(title)) between 3 and 160),
  constraint approval_requests_amount_check
    check (amount is null or amount >= 0),
  constraint approval_requests_currency_check
    check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),
  constraint approval_requests_required_check
    check (required_approvals between 1 and 5),
  constraint approval_requests_received_check
    check (approvals_received between 0 and required_approvals),
  constraint approval_requests_entity_check
    check ((entity_type is null) = (entity_id is null)),
  constraint approval_requests_decision_check
    check (
      (status = 'pending' and decided_at is null)
      or (status <> 'pending' and decided_at is not null)
    ),
  constraint approval_requests_execution_check
    check (executed_at is null or status = 'approved')
);

comment on table public.approval_requests is
  'Actions that are waiting for a second person to agree to them.';

create unique index approval_requests_number_key
  on public.approval_requests (company_id, request_number);

create index approval_requests_pending_idx
  on public.approval_requests (company_id, requested_at desc)
  where status = 'pending' and deleted_at is null;

create index approval_requests_entity_idx
  on public.approval_requests (entity_type, entity_id)
  where deleted_at is null;

-- Each separate yes or no, so a request needing two approvals can hold both.
create table public.approval_decisions (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  approval_request_id uuid not null,

  decided_by uuid not null,
  decision text not null,
  note text,
  decided_at timestamptz not null default now(),
  ip_hash text,

  constraint approval_decisions_decision_check
    check (decision in ('approved', 'rejected')),
  constraint approval_decisions_note_check
    check (note is null or length(btrim(note)) between 2 and 1000)
);

comment on table public.approval_decisions is
  'One recorded answer from one approver.';

create unique index approval_decisions_once_per_person
  on public.approval_decisions (approval_request_id, decided_by);

create index approval_decisions_request_idx
  on public.approval_decisions (approval_request_id, decided_at);

-- -----------------------------------------------------------------------------
-- Sensitive reads
-- -----------------------------------------------------------------------------

-- Opening somebody's identity document, bank details or full card record is
-- itself an event worth keeping. This is the register of those reads.
create table public.sensitive_access_logs (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,

  accessed_by uuid,
  access_role public.user_role,

  resource_type text not null,
  resource_id uuid,
  -- Which field was actually revealed, for example 'bank_account_number'.
  field_name text,
  purpose text,

  ip_hash text,
  user_agent text,
  accessed_at timestamptz not null default now(),

  constraint sensitive_access_resource_check
    check (resource_type ~ '^[a-z][a-z0-9_]{2,40}$'),
  constraint sensitive_access_purpose_check
    check (purpose is null or length(btrim(purpose)) between 2 and 300)
);

comment on table public.sensitive_access_logs is
  'A record of every time protected personal or financial data was read.';

create index sensitive_access_logs_company_idx
  on public.sensitive_access_logs (company_id, accessed_at desc);

create index sensitive_access_logs_user_idx
  on public.sensitive_access_logs (accessed_by, accessed_at desc);

create index sensitive_access_logs_resource_idx
  on public.sensitive_access_logs (resource_type, resource_id, accessed_at desc);

-- Both registers may only be added to. Deletes are left alone so that closing
-- a tenant account can still remove the tenant's rows in one pass.
create trigger sensitive_access_logs_10_append_only
  before update on public.sensitive_access_logs
  for each row execute function public.block_audit_mutation();

create trigger approval_decisions_10_append_only
  before update on public.approval_decisions
  for each row execute function public.block_audit_mutation();

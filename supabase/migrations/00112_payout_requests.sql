-- supabase/migrations/00112_payout_requests.sql
-- A company request to withdraw available wallet funds. Maker-checker fields
-- keep request, approval, and execution identities separate.

create table public.payout_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  wallet_account_id uuid not null references public.wallet_accounts (id),
  payout_destination_id uuid not null references public.payout_destinations (id),
  status payout_status not null default 'requested',
  currency_code text not null default 'USD',
  requested_amount numeric(18, 4) not null,
  platform_fee_amount numeric(18, 4) not null default 0,
  net_payout_amount numeric(18, 4) not null,
  requested_by_user_id uuid not null references public.users (id),
  reviewed_by_user_id uuid null references public.users (id),
  processed_by_user_id uuid null references public.users (id),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  processed_at timestamptz null,
  external_payout_id text null,
  idempotency_key text not null,
  rejection_reason text null,
  failure_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint payout_requests_requested_amount_positive check (requested_amount > 0),
  constraint payout_requests_fees_non_negative check (
    platform_fee_amount >= 0 and net_payout_amount >= 0
  ),
  constraint payout_requests_net_amount_valid check (
    net_payout_amount = requested_amount - platform_fee_amount
  ),
  constraint payout_requests_idempotency_not_blank check (length(btrim(idempotency_key)) > 0),
  constraint payout_requests_review_fields_valid check (
    (status in ('approved', 'rejected', 'processing', 'paid', 'failed', 'cancelled')
      and reviewed_by_user_id is not null and reviewed_at is not null)
    or status in ('requested', 'under_review')
  ),
  constraint payout_requests_processed_fields_valid check (
    (status in ('paid', 'failed') and processed_by_user_id is not null and processed_at is not null)
    or status not in ('paid', 'failed')
  )
);

create unique index payout_requests_company_idempotency_key
  on public.payout_requests (company_id, idempotency_key)
  where deleted_at is null;
create unique index payout_requests_external_id_key
  on public.payout_requests (external_payout_id)
  where external_payout_id is not null;
create index payout_requests_company_status_idx
  on public.payout_requests (company_id, status, requested_at desc)
  where deleted_at is null;
create index payout_requests_review_queue_idx
  on public.payout_requests (requested_at)
  where status in ('requested', 'under_review') and deleted_at is null;

comment on table public.payout_requests is
  'A maker-checker wallet payout request with encrypted destination linkage and idempotent execution metadata.';

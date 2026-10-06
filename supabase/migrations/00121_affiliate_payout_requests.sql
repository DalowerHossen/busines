-- supabase/migrations/00121_affiliate_payout_requests.sql
-- Affiliate commission payout request. Destination details are encrypted;
-- only the platform payout processor can decrypt them.

create table public.affiliate_payout_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  affiliate_profile_id uuid not null references public.affiliate_profiles (id),
  status affiliate_payout_status not null default 'requested',
  currency_code text not null default 'USD',
  requested_amount numeric(18, 4) not null,
  destination_type text not null,
  destination_details_encrypted text not null,
  requested_at timestamptz not null default now(),
  reviewed_by_user_id uuid null references public.users (id),
  reviewed_at timestamptz null,
  processed_by_user_id uuid null references public.users (id),
  processed_at timestamptz null,
  external_payout_id text null,
  idempotency_key text not null,
  rejection_reason text null,
  failure_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint affiliate_payout_requests_amount_positive check (requested_amount > 0),
  constraint affiliate_payout_requests_destination_type_not_blank check (
    length(btrim(destination_type)) > 0
  ),
  constraint affiliate_payout_requests_destination_not_blank check (
    length(btrim(destination_details_encrypted)) > 0
  ),
  constraint affiliate_payout_requests_idempotency_not_blank check (length(btrim(idempotency_key)) > 0),
  constraint affiliate_payout_requests_review_fields_valid check (
    (status in ('paid', 'rejected', 'failed', 'cancelled') and reviewed_by_user_id is not null and reviewed_at is not null)
    or status in ('requested', 'under_review')
  ),
  constraint affiliate_payout_requests_processed_fields_valid check (
    (status in ('paid', 'failed') and processed_by_user_id is not null and processed_at is not null)
    or status not in ('paid', 'failed')
  )
);

create unique index affiliate_payout_requests_idempotency_key
  on public.affiliate_payout_requests (affiliate_profile_id, idempotency_key)
  where deleted_at is null;
create unique index affiliate_payout_requests_external_id_key
  on public.affiliate_payout_requests (external_payout_id)
  where external_payout_id is not null;
create index affiliate_payout_requests_review_queue_idx
  on public.affiliate_payout_requests (status, requested_at)
  where status in ('requested', 'under_review') and deleted_at is null;
create index affiliate_payout_requests_affiliate_idx
  on public.affiliate_payout_requests (affiliate_profile_id, status)
  where deleted_at is null;

comment on table public.affiliate_payout_requests is
  'An affiliate payout request with maker-checker review and encrypted payout destination.';

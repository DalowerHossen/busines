-- supabase/migrations/00157_review_requests.sql
-- Post-payment review request automation with a signed, expiring token hash.

create table public.review_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  client_id uuid not null references public.clients (id),
  invoice_id uuid null references public.invoices (id),
  payment_id uuid null references public.payments (id),
  channel communication_channel not null default 'email',
  status review_request_status not null default 'queued',
  token_hash text not null,
  token_expires_at timestamptz null,
  sent_at timestamptz null,
  clicked_at timestamptz null,
  completed_at timestamptz null,
  rating smallint null,
  feedback text null,
  external_review_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint review_requests_channel_valid check (channel <> 'in_app'),
  constraint review_requests_token_not_blank check (length(btrim(token_hash)) > 0),
  constraint review_requests_rating_valid check (rating is null or rating between 1 and 5),
  constraint review_requests_completed_fields_valid check (
    (status = 'completed' and completed_at is not null and rating is not null)
    or status <> 'completed'
  )
);

create unique index review_requests_token_hash_key
  on public.review_requests (token_hash);
create index review_requests_company_status_idx
  on public.review_requests (company_id, status, created_at desc)
  where deleted_at is null;
create index review_requests_client_idx
  on public.review_requests (client_id, created_at desc)
  where deleted_at is null;

comment on table public.review_requests is
  'A post-payment review request and tokenized response record for one client.';

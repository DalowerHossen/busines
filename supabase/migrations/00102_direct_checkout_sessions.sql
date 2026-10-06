-- supabase/migrations/00102_direct_checkout_sessions.sql
-- Hosted checkout sessions used by Shopify, WooCommerce, and custom-site
-- integrations. Card data never enters this table or the platform servers.

create table public.direct_checkout_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  api_key_pair_id uuid not null references public.direct_checkout_api_key_pairs (id),
  ecommerce_connection_id uuid null references public.ecommerce_connections (id),
  ecommerce_order_id uuid null references public.ecommerce_orders (id),
  invoice_id uuid null references public.invoices (id),
  payment_id uuid null references public.payments (id),
  session_token_hash text not null,
  idempotency_key text null,
  status direct_checkout_session_status not null default 'created',
  currency_code text not null default 'USD',
  amount numeric(18, 4) not null,
  line_items jsonb not null default '[]'::jsonb,
  customer_email citext null,
  success_url text not null,
  cancel_url text not null,
  expires_at timestamptz not null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint direct_checkout_sessions_token_hash_not_blank check (length(btrim(session_token_hash)) > 0),
  constraint direct_checkout_sessions_idempotency_not_blank check (
    idempotency_key is null or length(btrim(idempotency_key)) > 0
  ),
  constraint direct_checkout_sessions_amount_non_negative check (amount >= 0),
  constraint direct_checkout_sessions_line_items_array check (jsonb_typeof(line_items) = 'array'),
  constraint direct_checkout_sessions_success_url_not_blank check (length(btrim(success_url)) > 0),
  constraint direct_checkout_sessions_cancel_url_not_blank check (length(btrim(cancel_url)) > 0)
);

create unique index direct_checkout_sessions_token_hash_key
  on public.direct_checkout_sessions (session_token_hash);
create unique index direct_checkout_sessions_company_idempotency_key
  on public.direct_checkout_sessions (company_id, idempotency_key)
  where idempotency_key is not null;
create index direct_checkout_sessions_active_idx
  on public.direct_checkout_sessions (company_id, status, expires_at)
  where status in ('created', 'pending_payment');
create index direct_checkout_sessions_order_idx
  on public.direct_checkout_sessions (ecommerce_order_id)
  where ecommerce_order_id is not null;
create index direct_checkout_sessions_invoice_idx
  on public.direct_checkout_sessions (invoice_id)
  where invoice_id is not null;

comment on table public.direct_checkout_sessions is
  'A token-hashed hosted checkout session; raw card data is never accepted or stored by the platform.';

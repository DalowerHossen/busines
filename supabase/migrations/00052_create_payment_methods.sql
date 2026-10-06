-- supabase/migrations/00052_create_payment_methods.sql
-- Saved payment methods and the mandates behind them.
--
-- No card data ever touches this database. The provider holds the instrument
-- and returns a token; only that token, the last four digits and the brand are
-- stored, which keeps the platform inside the lightest PCI scope.

create table public.client_payment_methods (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  client_id uuid not null,

  provider public.gateway_provider not null,
  gateway_id uuid,
  method_type public.payment_method_type not null default 'card',

  -- Token issued by the provider. It is useless without the provider account.
  provider_customer_reference text,
  provider_method_reference text not null,

  -- Display details only.
  brand text,
  last_four char(4),
  expiry_month smallint,
  expiry_year smallint,
  holder_name text,
  bank_name text,
  wallet_handle text,

  is_default boolean not null default false,
  is_active boolean not null default true,

  -- Authorisation the client gave for future charges, which is also the
  -- evidence used if a recurring charge is ever disputed.
  mandate_accepted_at timestamptz,
  mandate_reference text,
  mandate_ip_address inet,
  mandate_user_agent text,
  mandate_text_version text,

  last_used_at timestamptz,
  failure_count smallint not null default 0,
  last_failure_message text,
  deactivated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint client_payment_methods_reference_check
    check (length(btrim(provider_method_reference)) between 1 and 200),
  constraint client_payment_methods_last_four_check
    check (last_four is null or last_four ~ '^[0-9]{4}$'),
  constraint client_payment_methods_expiry_month_check
    check (expiry_month is null or expiry_month between 1 and 12),
  constraint client_payment_methods_expiry_year_check
    check (expiry_year is null or expiry_year between 2000 and 2100),
  constraint client_payment_methods_failure_count_check
    check (failure_count >= 0)
);

comment on table public.client_payment_methods is
  'Tokenised payment instruments saved for a client, with their mandate record.';
comment on column public.client_payment_methods.provider_method_reference is
  'Provider token. No card number is ever stored on the platform.';

create unique index client_payment_methods_reference_unique
  on public.client_payment_methods (provider, provider_method_reference)
  where deleted_at is null;

create unique index client_payment_methods_default_unique
  on public.client_payment_methods (client_id)
  where is_default and is_active and deleted_at is null;

create index client_payment_methods_client_idx
  on public.client_payment_methods (client_id, is_active)
  where deleted_at is null;

create index client_payment_methods_company_idx
  on public.client_payment_methods (company_id)
  where deleted_at is null;

create or replace function public.demote_other_default_payment_methods()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.is_default and new.is_active and new.deleted_at is null then
    update public.client_payment_methods
       set is_default = false,
           updated_at = now()
     where client_id = new.client_id
       and id <> new.id
       and is_default
       and deleted_at is null;
  end if;

  return new;
end;
$$;

comment on function public.demote_other_default_payment_methods() is
  'Keeps a single default payment method per client.';

create trigger client_payment_methods_single_default
  before insert or update of is_default on public.client_payment_methods
  for each row execute function public.demote_other_default_payment_methods();

-- -----------------------------------------------------------------------------
-- Payment intents
-- -----------------------------------------------------------------------------

-- A payment intent is the bridge between a document and a provider session.
-- It is created before the client is redirected and reconciled afterwards by
-- the webhook, so a lost browser never loses a payment.
create table public.payment_intents (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  client_id uuid,
  invoice_id uuid,

  provider public.gateway_provider not null,
  gateway_id uuid,
  mode public.gateway_mode not null default 'live',

  provider_intent_reference text,
  checkout_url text,
  return_url text,

  amount numeric(18, 4) not null,
  amount_minor bigint not null,
  currency char(3) not null,
  currency_exponent smallint not null default 2,

  status public.payment_status not null default 'pending',
  failure_code text,
  failure_message text,

  -- Supplied by the caller so a retried request never creates a second charge.
  idempotency_key text not null,

  client_ip inet,
  client_user_agent text,
  expires_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,

  constraint payment_intents_amount_check
    check (amount > 0 and amount_minor > 0),
  constraint payment_intents_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint payment_intents_metadata_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint payment_intents_idempotency_check
    check (length(btrim(idempotency_key)) between 8 and 120)
);

comment on table public.payment_intents is
  'A payment attempt that has been started with a provider but not yet settled.';

create unique index payment_intents_idempotency_unique
  on public.payment_intents (company_id, idempotency_key);

create unique index payment_intents_provider_reference_unique
  on public.payment_intents (provider, provider_intent_reference)
  where provider_intent_reference is not null;

create index payment_intents_invoice_idx
  on public.payment_intents (invoice_id)
  where invoice_id is not null;

create index payment_intents_company_idx
  on public.payment_intents (company_id, status, created_at desc);

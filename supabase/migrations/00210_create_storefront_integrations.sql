-- supabase/migrations/00210_create_storefront_integrations.sql
-- Taking payment for an online shop.
--
-- A shop built on WooCommerce, Shopify or anything else hands us an order and
-- we hand back a hosted payment address. The shopper leaves the shop, pays on
-- a page served by the payment provider, and comes back. Card numbers never
-- reach this application, never travel through our API and are never written
-- to any table here: that redirect is what keeps the whole platform inside the
-- simplest scope of the card industry rules rather than the hardest one.
--
-- A shop can only go live once the business behind it has been verified by
-- hand, so the switch that makes a connection active checks the verification
-- state of the tenant rather than trusting the person pressing it.

-- -----------------------------------------------------------------------------
-- The shops themselves
-- -----------------------------------------------------------------------------

create table public.storefront_connections (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  platform text not null default 'custom',
  store_name text not null,
  store_domain text not null,

  status text not null default 'pending_verification',
  status_reason text,

  -- The shop proves who it is with a key. Only the hash is kept, so a leak of
  -- this table cannot be replayed against the API.
  key_hash text,
  key_masked_hint text,
  key_issued_at timestamptz,
  previous_key_hash text,
  previous_key_expires_at timestamptz,

  -- Used to verify the notifications the shop platform sends us.
  webhook_secret_encrypted text,
  -- Where we tell the shop that an order has been paid.
  notify_url text,

  default_currency char(3) not null default 'USD',
  auto_issue_invoice boolean not null default true,

  order_count integer not null default 0,
  paid_count integer not null default 0,
  last_order_at timestamptz,
  last_error text,
  last_error_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint storefront_connections_platform_check
    check (platform in ('woocommerce', 'shopify', 'custom')),
  constraint storefront_connections_name_check
    check (length(btrim(store_name)) between 2 and 80),
  constraint storefront_connections_domain_check
    check (store_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  constraint storefront_connections_status_check
    check (status in ('pending_verification', 'active', 'suspended', 'disconnected')),
  constraint storefront_connections_key_check
    check (key_hash is null or length(key_hash) = 64),
  constraint storefront_connections_previous_key_check
    check (previous_key_hash is null or length(previous_key_hash) = 64),
  constraint storefront_connections_hint_check
    check (key_masked_hint is null or length(key_masked_hint) between 4 and 12),
  constraint storefront_connections_notify_check
    check (notify_url is null or notify_url ~ '^https://'),
  constraint storefront_connections_currency_check
    check (default_currency ~ '^[A-Z]{3}$'),
  constraint storefront_connections_counts_check
    check (order_count >= 0 and paid_count >= 0),
  constraint storefront_connections_live_check
    check (status <> 'active' or key_hash is not null)
);

comment on table public.storefront_connections is
  'One online shop wired to this account. No card data is ever held here.';
comment on column public.storefront_connections.key_hash is
  'Hash of the key the shop sends. The key itself is shown once and never stored.';

create unique index storefront_connections_store_unique
  on public.storefront_connections (company_id, platform, lower(store_domain))
  where deleted_at is null;

create unique index storefront_connections_key_unique
  on public.storefront_connections (key_hash)
  where key_hash is not null;

create index storefront_connections_company_idx
  on public.storefront_connections (company_id, status)
  where deleted_at is null;

alter table public.storefront_connections
  add constraint storefront_connections_company_fk
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.storefront_connections
  add constraint storefront_connections_created_by_fk
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.storefront_connections
  add constraint storefront_connections_updated_by_fk
  foreign key (updated_by) references public.users (id) on delete set null;

select public.install_standard_triggers('storefront_connections');

-- -----------------------------------------------------------------------------
-- The orders they send
-- -----------------------------------------------------------------------------

create table public.storefront_orders (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  connection_id uuid not null,

  external_order_id text not null,
  external_order_number text,

  customer_email citext,
  customer_name text,

  currency char(3) not null default 'USD',
  total_amount numeric(18, 4) not null,

  status text not null default 'received',
  invoice_id uuid,
  document_link_id uuid,
  checkout_expires_at timestamptz,

  payload jsonb not null default '{}'::jsonb,

  paid_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint storefront_orders_external_check
    check (length(btrim(external_order_id)) between 1 and 80),
  constraint storefront_orders_email_check
    check (customer_email is null or public.is_valid_email(customer_email::text)),
  constraint storefront_orders_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint storefront_orders_total_check
    check (total_amount > 0),
  constraint storefront_orders_status_check
    check (status in ('received', 'awaiting_payment', 'paid', 'cancelled', 'refunded', 'failed')),
  constraint storefront_orders_paid_check
    check (status <> 'paid' or paid_at is not null),
  constraint storefront_orders_cancelled_check
    check (status <> 'cancelled' or cancellation_reason is not null),
  constraint storefront_orders_payload_check
    check (jsonb_typeof(payload) = 'object')
);

comment on table public.storefront_orders is
  'An order a shop asked us to collect payment for, and what became of it.';

create unique index storefront_orders_external_unique
  on public.storefront_orders (connection_id, external_order_id);

create index storefront_orders_company_idx
  on public.storefront_orders (company_id, created_at desc);

create index storefront_orders_status_idx
  on public.storefront_orders (status, created_at desc)
  where status in ('received', 'awaiting_payment');

alter table public.storefront_orders
  add constraint storefront_orders_company_fk
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.storefront_orders
  add constraint storefront_orders_connection_fk
  foreign key (connection_id) references public.storefront_connections (id) on delete cascade;

alter table public.storefront_orders
  add constraint storefront_orders_invoice_fk
  foreign key (invoice_id) references public.invoices (id) on delete set null;

alter table public.storefront_orders
  add constraint storefront_orders_link_fk
  foreign key (document_link_id) references public.document_links (id) on delete set null;

create table public.storefront_events (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  connection_id uuid not null,
  order_id uuid,

  event_type text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint storefront_events_type_check
    check (event_type in ('connected', 'key_issued', 'activated', 'suspended',
                          'order_received', 'checkout_issued', 'order_paid',
                          'order_cancelled', 'order_refunded', 'error')),
  constraint storefront_events_detail_check
    check (jsonb_typeof(detail) = 'object')
);

comment on table public.storefront_events is
  'An append only record of what each shop connection did, for support and audit.';

create index storefront_events_connection_idx
  on public.storefront_events (connection_id, created_at desc);

alter table public.storefront_events
  add constraint storefront_events_company_fk
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.storefront_events
  add constraint storefront_events_connection_fk
  foreign key (connection_id) references public.storefront_connections (id) on delete cascade;

create or replace function public.reject_storefront_event_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'The shop log is never edited or deleted' using errcode = '42501';
end;
$$;

comment on function public.reject_storefront_event_change() is
  'Keeps the shop log append only.';

create trigger storefront_events_no_update
  before update or delete on public.storefront_events
  for each row execute function public.reject_storefront_event_change();

-- -----------------------------------------------------------------------------
-- Setting a shop up
-- -----------------------------------------------------------------------------

create or replace function public.save_storefront_connection(
  p_company_id uuid,
  p_platform text,
  p_store_name text,
  p_store_domain text,
  p_connection_id uuid default null,
  p_notify_url text default null,
  p_default_currency char(3) default 'USD',
  p_auto_issue_invoice boolean default true
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
  if not coalesce(
    public.is_service_role() or public.is_company_owner(p_company_id),
    false
  ) then
    raise exception 'Only the account owner can connect a shop' using errcode = '42501';
  end if;

  if p_platform not in ('woocommerce', 'shopify', 'custom') then
    raise exception 'That is not a shop platform we support yet' using errcode = '22023';
  end if;

  if p_connection_id is not null then
    select id into v_id
      from public.storefront_connections
     where id = p_connection_id
       and company_id = p_company_id
       and deleted_at is null;

    if v_id is null then
      raise exception 'That shop is not connected here' using errcode = 'P0002';
    end if;

    update public.storefront_connections
       set store_name = btrim(p_store_name),
           store_domain = lower(btrim(p_store_domain)),
           notify_url = p_notify_url,
           default_currency = coalesce(p_default_currency, 'USD'),
           auto_issue_invoice = coalesce(p_auto_issue_invoice, true),
           updated_by = public.current_user_id(),
           updated_at = now()
     where id = v_id;

    return v_id;
  end if;

  insert into public.storefront_connections (
    company_id, platform, store_name, store_domain, notify_url,
    default_currency, auto_issue_invoice, created_by
  )
  values (
    p_company_id, p_platform, btrim(p_store_name), lower(btrim(p_store_domain)),
    p_notify_url, coalesce(p_default_currency, 'USD'),
    coalesce(p_auto_issue_invoice, true), public.current_user_id()
  )
  returning id into v_id;

  insert into public.storefront_events (company_id, connection_id, event_type, detail)
  values (
    p_company_id, v_id, 'connected',
    jsonb_build_object('platform', p_platform, 'domain', lower(btrim(p_store_domain)))
  );

  return v_id;
end;
$$;

comment on function public.save_storefront_connection(
  uuid, text, text, text, uuid, text, char, boolean
) is
  'Connects a shop, or changes how an existing connection is described.';

-- Issues a key for a shop. The previous key keeps working for five minutes so
-- a running shop is never cut off in the middle of a checkout.
create or replace function public.issue_storefront_key(
  p_connection_id uuid,
  p_key_hash text,
  p_masked_hint text,
  p_webhook_secret_encrypted text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_connection public.storefront_connections%rowtype;
begin
  select * into v_connection
    from public.storefront_connections
   where id = p_connection_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That shop is not connected here' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.is_company_owner(v_connection.company_id),
    false
  ) then
    raise exception 'Only the account owner can issue a shop key' using errcode = '42501';
  end if;

  if p_key_hash is null or length(p_key_hash) <> 64 then
    raise exception 'That is not a key we can store' using errcode = '22023';
  end if;

  update public.storefront_connections
     set previous_key_hash = key_hash,
         previous_key_expires_at = case
           when key_hash is null then null
           else now() + interval '5 minutes'
         end,
         key_hash = p_key_hash,
         key_masked_hint = p_masked_hint,
         key_issued_at = now(),
         webhook_secret_encrypted = coalesce(
           p_webhook_secret_encrypted, webhook_secret_encrypted
         ),
         updated_by = public.current_user_id(),
         updated_at = now()
   where id = p_connection_id;

  insert into public.storefront_events (company_id, connection_id, event_type, detail)
  values (
    v_connection.company_id, p_connection_id, 'key_issued',
    jsonb_build_object('hint', p_masked_hint)
  );

  return true;
end;
$$;

comment on function public.issue_storefront_key(uuid, text, text, text) is
  'Stores the hash of a new shop key and keeps the old one alive briefly.';

-- Turns a shop on or off. Going live is gated on the business having been
-- verified by the platform team, which is done by hand.
create or replace function public.set_storefront_status(
  p_connection_id uuid,
  p_status text,
  p_reason text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_connection public.storefront_connections%rowtype;
  v_kyc public.kyc_status;
begin
  select * into v_connection
    from public.storefront_connections
   where id = p_connection_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That shop is not connected here' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.is_company_owner(v_connection.company_id),
    false
  ) then
    raise exception 'Only the account owner can change a shop connection'
      using errcode = '42501';
  end if;

  if p_status not in ('pending_verification', 'active', 'suspended', 'disconnected') then
    raise exception 'That is not a state a shop can be in' using errcode = '22023';
  end if;

  if p_status = 'active' then
    select kyc_status into v_kyc from public.companies where id = v_connection.company_id;

    if v_kyc is distinct from 'verified' then
      raise exception
        'This business has to be verified before a shop can take payment'
        using errcode = '42501';
    end if;

    if v_connection.key_hash is null then
      raise exception 'Issue a key before taking the shop live' using errcode = '22023';
    end if;
  end if;

  update public.storefront_connections
     set status = p_status,
         status_reason = p_reason,
         updated_by = public.current_user_id(),
         updated_at = now()
   where id = p_connection_id;

  insert into public.storefront_events (company_id, connection_id, event_type, detail)
  values (
    v_connection.company_id, p_connection_id,
    case when p_status = 'active' then 'activated' else 'suspended' end,
    jsonb_build_object('status', p_status, 'reason', p_reason)
  );

  return true;
end;
$$;

comment on function public.set_storefront_status(uuid, text, text) is
  'Takes a shop live, or stops it, once the business behind it is verified.';

-- -----------------------------------------------------------------------------
-- What the shop calls
-- -----------------------------------------------------------------------------

create or replace function public.authenticate_storefront_key(p_key_hash text)
returns table (
  connection_id uuid,
  company_id uuid,
  platform text,
  status text,
  default_currency char(3),
  auto_issue_invoice boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_service_role(), false) then
    raise exception 'Only the platform can check a shop key' using errcode = '42501';
  end if;

  return query
  select c.id,
         c.company_id,
         c.platform,
         c.status,
         c.default_currency,
         c.auto_issue_invoice
    from public.storefront_connections as c
   where c.deleted_at is null
     and (
       c.key_hash = p_key_hash
       or (
         c.previous_key_hash = p_key_hash
         and c.previous_key_expires_at is not null
         and c.previous_key_expires_at > now()
       )
     );
end;
$$;

comment on function public.authenticate_storefront_key(text) is
  'Turns the key a shop sent into the connection behind it.';

-- Takes an order and turns it into an invoice that can be paid online. The
-- call is idempotent on the order reference, because a shop that times out
-- will send the same order again and must not be charged twice.
create or replace function public.register_storefront_order(
  p_connection_id uuid,
  p_external_order_id text,
  p_total_amount numeric,
  p_currency char(3) default null,
  p_customer_email text default null,
  p_customer_name text default null,
  p_external_order_number text default null,
  p_description text default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_connection public.storefront_connections%rowtype;
  v_order_id uuid;
  v_client_id uuid;
  v_invoice_id uuid;
  v_currency char(3);
  v_email citext;
  v_owner_id uuid;
  v_previous_subject text;
begin
  if not coalesce(public.is_service_role(), false) then
    raise exception 'Only the platform can register a shop order' using errcode = '42501';
  end if;

  select * into v_connection
    from public.storefront_connections
   where id = p_connection_id and deleted_at is null;

  if not found then
    raise exception 'That shop is not connected here' using errcode = 'P0002';
  end if;

  if v_connection.status <> 'active' then
    raise exception 'That shop is not live yet' using errcode = '42501';
  end if;

  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'An order has to be worth something' using errcode = '22023';
  end if;

  select id into v_order_id
    from public.storefront_orders
   where connection_id = p_connection_id
     and external_order_id = btrim(p_external_order_id);

  if v_order_id is not null then
    return v_order_id;
  end if;

  v_currency := coalesce(p_currency, v_connection.default_currency);
  v_email := nullif(lower(btrim(coalesce(p_customer_email, ''))), '')::citext;

  if v_email is not null then
    select id into v_client_id
      from public.clients
     where company_id = v_connection.company_id
       and normalized_email = v_email
       and deleted_at is null
     limit 1;
  end if;

  if v_client_id is null then
    insert into public.clients (
      company_id, client_type, display_name, email, billing_currency
    )
    values (
      v_connection.company_id,
      'individual',
      coalesce(nullif(btrim(coalesce(p_customer_name, '')), ''), v_email::text, 'Online shopper'),
      v_email,
      v_currency
    )
    returning id into v_client_id;
  end if;

  insert into public.invoices (company_id, client_id, currency, base_currency, issue_date)
  values (
    v_connection.company_id, v_client_id, v_currency,
    (select base_currency from public.companies where id = v_connection.company_id),
    current_date
  )
  returning id into v_invoice_id;

  insert into public.invoice_items (
    company_id, invoice_id, line_number, description, quantity, unit_price
  )
  values (
    v_connection.company_id, v_invoice_id, 1,
    coalesce(
      nullif(btrim(coalesce(p_description, '')), ''),
      'Online order ' || coalesce(p_external_order_number, btrim(p_external_order_id))
    ),
    1,
    p_total_amount
  );

  -- Issuing an invoice is a decision of the business, so the number is taken
  -- in the name of the owner of the shop rather than in the name of the
  -- platform. The impersonation lasts for this statement only and is put back
  -- immediately afterwards.
  if v_connection.auto_issue_invoice then
    select id into v_owner_id
      from public.users
     where company_id = v_connection.company_id
       and role = 'owner'
       and deleted_at is null
     order by created_at
     limit 1;

    if v_owner_id is null then
      raise exception 'That business has no owner to issue the invoice'
        using errcode = '22023';
    end if;

    v_previous_subject := current_setting('request.jwt.claim.sub', true);
    perform set_config('request.jwt.claim.sub', v_owner_id::text, true);
    perform public.issue_invoice(v_invoice_id);
    perform set_config('request.jwt.claim.sub', coalesce(v_previous_subject, ''), true);
  end if;

  insert into public.storefront_orders (
    company_id, connection_id, external_order_id, external_order_number,
    customer_email, customer_name, currency, total_amount, status, invoice_id, payload
  )
  values (
    v_connection.company_id, p_connection_id, btrim(p_external_order_id),
    p_external_order_number, v_email, nullif(btrim(coalesce(p_customer_name, '')), ''),
    v_currency, p_total_amount, 'received', v_invoice_id,
    coalesce(p_payload, '{}'::jsonb)
  )
  returning id into v_order_id;

  update public.storefront_connections
     set order_count = order_count + 1,
         last_order_at = now(),
         updated_at = now()
   where id = p_connection_id;

  insert into public.storefront_events (
    company_id, connection_id, order_id, event_type, detail
  )
  values (
    v_connection.company_id, p_connection_id, v_order_id, 'order_received',
    jsonb_build_object('reference', btrim(p_external_order_id), 'amount', p_total_amount)
  );

  return v_order_id;
end;
$$;

comment on function public.register_storefront_order(
  uuid, text, numeric, char, text, text, text, text, jsonb
) is
  'Turns a shop order into an invoice, once per order reference.';

create or replace function public.attach_storefront_checkout(
  p_order_id uuid,
  p_link_id uuid,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.storefront_orders%rowtype;
begin
  if not coalesce(public.is_service_role(), false) then
    raise exception 'Only the platform can attach a payment address' using errcode = '42501';
  end if;

  select * into v_order
    from public.storefront_orders
   where id = p_order_id
     for update;

  if not found then
    raise exception 'That order does not exist' using errcode = 'P0002';
  end if;

  update public.storefront_orders
     set document_link_id = p_link_id,
         checkout_expires_at = p_expires_at,
         status = case when status = 'received' then 'awaiting_payment' else status end,
         updated_at = now()
   where id = p_order_id;

  insert into public.storefront_events (
    company_id, connection_id, order_id, event_type, detail
  )
  values (
    v_order.company_id, v_order.connection_id, p_order_id, 'checkout_issued',
    jsonb_build_object('expires_at', p_expires_at)
  );

  return true;
end;
$$;

comment on function public.attach_storefront_checkout(uuid, uuid, timestamptz) is
  'Records the hosted payment address issued for one shop order.';

-- Marks an order as paid, but only when the invoice behind it really is.
create or replace function public.settle_storefront_order(p_order_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.storefront_orders%rowtype;
  v_balance numeric;
begin
  if not coalesce(public.is_service_role(), false) then
    raise exception 'Only the platform can settle a shop order' using errcode = '42501';
  end if;

  select * into v_order
    from public.storefront_orders
   where id = p_order_id
     for update;

  if not found then
    raise exception 'That order does not exist' using errcode = 'P0002';
  end if;

  if v_order.status = 'paid' then
    return false;
  end if;

  select balance_due into v_balance
    from public.invoices
   where id = v_order.invoice_id;

  if v_balance is null or v_balance > 0 then
    return false;
  end if;

  update public.storefront_orders
     set status = 'paid',
         paid_at = now(),
         updated_at = now()
   where id = p_order_id;

  update public.storefront_connections
     set paid_count = paid_count + 1,
         updated_at = now()
   where id = v_order.connection_id;

  insert into public.storefront_events (
    company_id, connection_id, order_id, event_type, detail
  )
  values (
    v_order.company_id, v_order.connection_id, p_order_id, 'order_paid',
    jsonb_build_object('amount', v_order.total_amount)
  );

  return true;
end;
$$;

comment on function public.settle_storefront_order(uuid) is
  'Marks a shop order paid once its invoice has nothing left owing.';

create or replace function public.cancel_storefront_order(
  p_order_id uuid,
  p_reason text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.storefront_orders%rowtype;
begin
  select * into v_order
    from public.storefront_orders
   where id = p_order_id
     for update;

  if not found then
    raise exception 'That order does not exist' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.can_write_company_data(v_order.company_id),
    false
  ) then
    raise exception 'That order is not yours to cancel' using errcode = '42501';
  end if;

  if v_order.status = 'paid' then
    raise exception 'An order that has been paid is refunded rather than cancelled'
      using errcode = '22023';
  end if;

  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'Say why the order is being cancelled' using errcode = '22023';
  end if;

  update public.storefront_orders
     set status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = btrim(p_reason),
         updated_at = now()
   where id = p_order_id;

  insert into public.storefront_events (
    company_id, connection_id, order_id, event_type, detail
  )
  values (
    v_order.company_id, v_order.connection_id, p_order_id, 'order_cancelled',
    jsonb_build_object('reason', btrim(p_reason))
  );

  return true;
end;
$$;

comment on function public.cancel_storefront_order(uuid, text) is
  'Stops an order that has not been paid, with a reason the shop can read.';

create or replace function public.record_storefront_error(
  p_connection_id uuid,
  p_message text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_connection public.storefront_connections%rowtype;
begin
  if not coalesce(public.is_service_role(), false) then
    raise exception 'Only the platform records shop failures' using errcode = '42501';
  end if;

  select * into v_connection
    from public.storefront_connections
   where id = p_connection_id and deleted_at is null;

  if not found then
    return false;
  end if;

  update public.storefront_connections
     set last_error = left(coalesce(p_message, 'Unknown failure'), 300),
         last_error_at = now(),
         updated_at = now()
   where id = p_connection_id;

  insert into public.storefront_events (company_id, connection_id, event_type, detail)
  values (
    v_connection.company_id, p_connection_id, 'error',
    jsonb_build_object('message', left(coalesce(p_message, 'Unknown failure'), 300))
  );

  return true;
end;
$$;

comment on function public.record_storefront_error(uuid, text) is
  'Keeps the last refusal where the owner of the shop can read it.';

-- -----------------------------------------------------------------------------
-- What the office sees
-- -----------------------------------------------------------------------------

create or replace function public.company_storefront_connections(p_company_id uuid)
returns table (
  connection_id uuid,
  platform text,
  store_name text,
  store_domain text,
  status text,
  status_reason text,
  key_masked_hint text,
  key_issued_at timestamptz,
  notify_url text,
  default_currency char(3),
  auto_issue_invoice boolean,
  order_count integer,
  paid_count integer,
  last_order_at timestamptz,
  last_error text,
  last_error_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'Those shops belong to another business' using errcode = '42501';
  end if;

  return query
  select c.id,
         c.platform,
         c.store_name,
         c.store_domain,
         c.status,
         c.status_reason,
         c.key_masked_hint,
         c.key_issued_at,
         c.notify_url,
         c.default_currency,
         c.auto_issue_invoice,
         c.order_count,
         c.paid_count,
         c.last_order_at,
         c.last_error,
         c.last_error_at
    from public.storefront_connections as c
   where c.company_id = p_company_id
     and c.deleted_at is null
   order by c.created_at;
end;
$$;

comment on function public.company_storefront_connections(uuid) is
  'Lists the shops wired to one business, without any of the secrets.';

create or replace function public.company_storefront_orders(
  p_company_id uuid,
  p_connection_id uuid default null,
  p_limit integer default 50
)
returns table (
  order_id uuid,
  connection_id uuid,
  store_name text,
  external_order_id text,
  external_order_number text,
  customer_email text,
  customer_name text,
  currency char(3),
  total_amount numeric,
  status text,
  invoice_id uuid,
  invoice_number text,
  balance_due numeric,
  paid_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'Those orders belong to another business' using errcode = '42501';
  end if;

  return query
  select o.id,
         o.connection_id,
         c.store_name,
         o.external_order_id,
         o.external_order_number,
         o.customer_email::text,
         o.customer_name,
         o.currency,
         o.total_amount,
         o.status,
         o.invoice_id,
         i.invoice_number,
         i.balance_due,
         o.paid_at,
         o.created_at
    from public.storefront_orders as o
    join public.storefront_connections as c on c.id = o.connection_id
    left join public.invoices as i on i.id = o.invoice_id
   where o.company_id = p_company_id
     and (p_connection_id is null or o.connection_id = p_connection_id)
   order by o.created_at desc
   limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

comment on function public.company_storefront_orders(uuid, uuid, integer) is
  'Lists the shop orders of one business, newest first.';

create or replace function public.storefront_overview(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'Those shops belong to another business' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'connection_count', (
      select count(*)::int from public.storefront_connections
       where company_id = p_company_id and deleted_at is null
    ),
    'live_count', (
      select count(*)::int from public.storefront_connections
       where company_id = p_company_id and deleted_at is null and status = 'active'
    ),
    'order_count', (
      select count(*)::int from public.storefront_orders
       where company_id = p_company_id
    ),
    'awaiting_payment', (
      select count(*)::int from public.storefront_orders
       where company_id = p_company_id and status in ('received', 'awaiting_payment')
    ),
    'collected_amount', (
      select coalesce(sum(total_amount), 0)::numeric
        from public.storefront_orders
       where company_id = p_company_id and status = 'paid'
    ),
    'is_verified', (
      select (kyc_status = 'verified') from public.companies where id = p_company_id
    )
  );
end;
$$;

comment on function public.storefront_overview(uuid) is
  'Counts the shops, the orders and the money they have brought in.';

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.storefront_connections enable row level security;
alter table public.storefront_connections force row level security;

create policy storefront_connections_select on public.storefront_connections
  for select to authenticated
  using (
    public.is_super_admin()
    or (deleted_at is null and public.has_company_access(company_id))
  );

alter table public.storefront_orders enable row level security;
alter table public.storefront_orders force row level security;

create policy storefront_orders_select on public.storefront_orders
  for select to authenticated
  using (
    public.is_super_admin()
    or public.has_company_access(company_id)
  );

alter table public.storefront_events enable row level security;
alter table public.storefront_events force row level security;

create policy storefront_events_select on public.storefront_events
  for select to authenticated
  using (
    public.is_super_admin()
    or public.has_company_access(company_id)
  );

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on public.storefront_connections from public, authenticated;
grant select (
  id, company_id, platform, store_name, store_domain, status, status_reason,
  key_masked_hint, key_issued_at, notify_url, default_currency,
  auto_issue_invoice, order_count, paid_count, last_order_at, last_error,
  last_error_at, created_at, updated_at, deleted_at
) on public.storefront_connections to authenticated;

revoke all on public.storefront_orders from public, authenticated;
grant select on public.storefront_orders to authenticated;

revoke all on public.storefront_events from public, authenticated;
grant select on public.storefront_events to authenticated;

revoke execute on function public.save_storefront_connection(
  uuid, text, text, text, uuid, text, char, boolean
) from public, authenticated;
revoke execute on function public.issue_storefront_key(uuid, text, text, text)
  from public, authenticated;
revoke execute on function public.set_storefront_status(uuid, text, text)
  from public, authenticated;
revoke execute on function public.authenticate_storefront_key(text)
  from public, authenticated;
revoke execute on function public.register_storefront_order(
  uuid, text, numeric, char, text, text, text, text, jsonb
) from public, authenticated;
revoke execute on function public.attach_storefront_checkout(uuid, uuid, timestamptz)
  from public, authenticated;
revoke execute on function public.settle_storefront_order(uuid)
  from public, authenticated;
revoke execute on function public.cancel_storefront_order(uuid, text)
  from public, authenticated;
revoke execute on function public.record_storefront_error(uuid, text)
  from public, authenticated;
revoke execute on function public.company_storefront_connections(uuid)
  from public, authenticated;
revoke execute on function public.company_storefront_orders(uuid, uuid, integer)
  from public, authenticated;
revoke execute on function public.storefront_overview(uuid)
  from public, authenticated;

grant execute on function public.save_storefront_connection(
  uuid, text, text, text, uuid, text, char, boolean
) to authenticated, service_role;
grant execute on function public.issue_storefront_key(uuid, text, text, text)
  to authenticated, service_role;
grant execute on function public.set_storefront_status(uuid, text, text)
  to authenticated, service_role;
grant execute on function public.authenticate_storefront_key(text)
  to service_role;
grant execute on function public.register_storefront_order(
  uuid, text, numeric, char, text, text, text, text, jsonb
) to service_role;
grant execute on function public.attach_storefront_checkout(uuid, uuid, timestamptz)
  to service_role;
grant execute on function public.settle_storefront_order(uuid)
  to service_role;
grant execute on function public.cancel_storefront_order(uuid, text)
  to authenticated, service_role;
grant execute on function public.record_storefront_error(uuid, text)
  to service_role;
grant execute on function public.company_storefront_connections(uuid)
  to authenticated, service_role;
grant execute on function public.company_storefront_orders(uuid, uuid, integer)
  to authenticated, service_role;
grant execute on function public.storefront_overview(uuid)
  to authenticated, service_role;

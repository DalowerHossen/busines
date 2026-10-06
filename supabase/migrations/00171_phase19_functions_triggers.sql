-- supabase/migrations/00171_phase19_functions_triggers.sql
-- Phase 19 database hardening: concurrency-safe business functions,
-- database-maintained timestamps and audit records, idempotent scheduled-job
-- state, and the server-side work used by Supabase Edge cron functions.
-- All comments, function names, and error messages in this migration are
-- intentionally English-only.

alter table public.invoices
  add column if not exists late_fee_amount numeric(14, 2) not null default 0,
  add column if not exists late_fee_applied_at timestamptz null;

alter table public.invoices
  add constraint invoices_late_fee_non_negative
  check (late_fee_amount >= 0);

create unique index if not exists warehouse_stock_levels_company_warehouse_product_key
  on public.warehouse_stock_levels (company_id, warehouse_id, product_id)
  where deleted_at is null;

create table if not exists public.scheduled_job_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  job_name text not null,
  idempotency_key text not null,
  status text not null default 'running',
  result jsonb not null default '{}'::jsonb,
  error_message text null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint scheduled_job_runs_name_not_blank check (length(btrim(job_name)) > 0),
  constraint scheduled_job_runs_key_not_blank check (length(btrim(idempotency_key)) > 0),
  constraint scheduled_job_runs_status_valid check (status in ('running', 'succeeded', 'failed')),
  constraint scheduled_job_runs_result_object check (jsonb_typeof(result) = 'object')
);

create unique index if not exists scheduled_job_runs_name_key
  on public.scheduled_job_runs (job_name, idempotency_key);
create index if not exists scheduled_job_runs_status_idx
  on public.scheduled_job_runs (status, started_at);

alter table public.scheduled_job_runs enable row level security;
alter table public.scheduled_job_runs force row level security;
revoke all privileges on table public.scheduled_job_runs from public, anon, authenticated;

-- Generic updated_at maintenance. This trigger is installed below on every
-- public table that has an updated_at column, including tables introduced by
-- future migrations only when those migrations explicitly install their own
-- trigger. Immutable append-only tables intentionally have no updated_at.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Invoice numbering is a trigger-safe, transaction-scoped sequence. The
-- advisory lock is keyed by company, while the locked company_profiles row is
-- the authoritative counter and prefix.
create or replace function public.generate_next_invoice_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_prefix text;
  v_sequence integer;
begin
  if p_company_id is null then
    raise exception 'generate_next_invoice_number: company_id is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_company_id::text, 190619));

  update public.company_profiles
  set next_invoice_sequence = next_invoice_sequence + 1
  where company_id = p_company_id
  returning invoice_prefix, next_invoice_sequence - 1
    into v_prefix, v_sequence;

  if not found then
    raise exception 'generate_next_invoice_number: no company profile exists for company_id %', p_company_id;
  end if;

  return v_prefix || '-' || lpad(v_sequence::text, 6, '0');
end;
$$;

create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.company_id is null then
    raise exception 'assign_invoice_number: company_id is required';
  end if;

  if new.invoice_number is null or length(btrim(new.invoice_number)) = 0 then
    new.invoice_number := public.generate_next_invoice_number(new.company_id);
  end if;

  return new;
end;
$$;

-- Stock movements are the immutable source of truth. The after-insert
-- trigger locks the one stock row before comparing quantity_before, making
-- concurrent movements deterministic and preventing a stale writer from
-- silently overwriting inventory.
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_current numeric(18, 4);
  v_stock_id uuid;
  v_warehouse_company uuid;
  v_product_company uuid;
begin
  select company_id into v_warehouse_company
  from public.warehouses
  where id = new.warehouse_id;
  if v_warehouse_company is distinct from new.company_id then
    raise exception 'apply_stock_movement: warehouse and movement must belong to the same company';
  end if;

  select company_id into v_product_company
  from public.products
  where id = new.product_id;
  if v_product_company is distinct from new.company_id then
    raise exception 'apply_stock_movement: product and movement must belong to the same company';
  end if;

  select id, quantity_on_hand
    into v_stock_id, v_current
  from public.warehouse_stock_levels
  where company_id = new.company_id
    and warehouse_id = new.warehouse_id
    and product_id = new.product_id
    and deleted_at is null
  for update;

  if not found then
    if new.quantity_before <> 0 then
      raise exception 'apply_stock_movement: first movement must start at zero';
    end if;

    insert into public.warehouse_stock_levels (
      company_id,
      warehouse_id,
      product_id,
      quantity_on_hand,
      currency_code
    ) values (
      new.company_id,
      new.warehouse_id,
      new.product_id,
      new.quantity_after,
      new.currency_code
    );
  else
    if v_current <> new.quantity_before then
      raise exception 'apply_stock_movement: stale quantity_before for stock row % (expected %, received %)',
        v_stock_id, v_current, new.quantity_before;
    end if;

    update public.warehouse_stock_levels
    set quantity_on_hand = new.quantity_after,
        currency_code = new.currency_code
    where id = v_stock_id;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_stock_movement_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'stock_movements are append-only; post a compensating movement instead';
end;
$$;

-- The ledger remains authoritative; these functions deliberately calculate
-- on demand instead of maintaining a mutable balance counter.
create or replace function public.calculate_client_credit_balance(
  p_company_id uuid,
  p_client_id uuid,
  p_currency_code text default 'USD'
)
returns numeric(14, 2)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_company uuid;
  v_balance numeric(14, 2);
begin
  select company_id into v_client_company
  from public.clients
  where id = p_client_id and deleted_at is null;

  if v_client_company is null or v_client_company is distinct from p_company_id then
    raise exception 'calculate_client_credit_balance: client is not in the requested company';
  end if;

  select coalesce(sum(amount), 0)::numeric(14, 2)
    into v_balance
  from public.client_credit_balance_entries
  where company_id = p_company_id
    and client_id = p_client_id
    and currency_code = p_currency_code
    and deleted_at is null;

  return v_balance;
end;
$$;

create or replace function public.calculate_client_credit_balance(p_client_id uuid)
returns numeric(14, 2)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_currency_code text;
begin
  select company_id, default_currency_code into v_company_id, v_currency_code
  from public.clients
  where id = p_client_id and deleted_at is null;
  if not found then
    raise exception 'calculate_client_credit_balance: client does not exist';
  end if;
  return public.calculate_client_credit_balance(v_company_id, p_client_id, v_currency_code);
end;
$$;

create or replace function public.lookup_platform_setting(
  p_company_id uuid,
  p_key text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select value_plain
      from public.system_settings
      where scope = 'company' and company_id = p_company_id and key = p_key
    ),
    (
      select value_plain
      from public.system_settings
      where scope = 'platform' and company_id is null and key = p_key
    )
  );
$$;

create or replace function public.apply_invoice_late_fee(p_invoice_id uuid)
returns numeric(14, 2)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_setting jsonb;
  v_fee_type text;
  v_rate numeric;
  v_fixed numeric;
  v_fee numeric(14, 2);
begin
  select * into v_invoice
  from public.invoices
  where id = p_invoice_id and deleted_at is null
  for update;

  if not found or v_invoice.status in ('paid', 'void')
    or v_invoice.amount_due <= 0
    or v_invoice.due_date >= current_date
    or v_invoice.late_fee_applied_at is not null then
    return 0;
  end if;

  v_setting := public.lookup_platform_setting(v_invoice.company_id, 'invoice_late_fee_policy');
  if v_setting is null or coalesce((v_setting ->> 'enabled')::boolean, false) = false then
    return 0;
  end if;

  v_fee_type := lower(coalesce(v_setting ->> 'type', 'percent'));
  v_rate := coalesce((v_setting ->> 'rate_percent')::numeric, 0);
  v_fixed := coalesce((v_setting ->> 'fixed_amount')::numeric, 0);

  if v_rate < 0 or v_rate > 100 or v_fixed < 0 then
    raise exception 'apply_invoice_late_fee: invalid versioned late-fee policy';
  end if;

  if v_fee_type not in ('percent', 'fixed') then
    raise exception 'apply_invoice_late_fee: unsupported late-fee policy type %', v_fee_type;
  end if;

  if v_fee_type = 'percent' then
    v_fee := round((v_invoice.amount_due * v_rate / 100)::numeric, 2);
  else
    v_fee := round(v_fixed::numeric, 2);
  end if;

  if v_fee <= 0 then
    return 0;
  end if;

  update public.invoices
  set late_fee_amount = v_fee,
      late_fee_applied_at = now(),
      total_amount = total_amount + v_fee,
      amount_due = amount_due + v_fee,
      status = 'overdue'
  where id = p_invoice_id;

  return v_fee;
end;
$$;

create or replace function public.enqueue_overdue_invoice_reminder(p_invoice_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_owner_id uuid;
  v_template public.email_templates%rowtype;
  v_notification_id uuid;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id;
  if not found then
    return false;
  end if;

  select owner_user_id into v_owner_id
  from public.companies
  where id = v_invoice.company_id and deleted_at is null;

  select * into v_template
  from public.email_templates
  where company_id = v_invoice.company_id
    and template_key = 'invoice_overdue'
    and is_active and deleted_at is null
  order by version desc
  limit 1;

  if v_template.id is null then
    select * into v_template
    from public.email_templates
    where company_id is null
      and template_key = 'invoice_overdue'
      and is_active and deleted_at is null
    order by version desc
    limit 1;
  end if;

  insert into public.notifications (
    company_id, recipient_user_id, type, title, body, link_path
  ) values (
    v_invoice.company_id,
    v_owner_id,
    'invoice_overdue',
    'Invoice overdue',
    format('Invoice %s is overdue. The outstanding amount is %s %s.',
      v_invoice.invoice_number,
      to_char(v_invoice.amount_due, 'FM999999999990.00'),
      v_invoice.currency_code),
    '/invoices/' || v_invoice.id::text
  )
  returning id into v_notification_id;

  if v_template.id is not null then
    insert into public.message_deliveries (
      company_id,
      channel,
      direction,
      status,
      notification_id,
      client_id,
      email_template_id,
      recipient_address,
      subject_snapshot,
      content_snapshot,
      idempotency_key
    )
    select
      v_invoice.company_id,
      'email',
      'outbound',
      'queued',
      v_notification_id,
      v_invoice.client_id,
      v_template.id,
      v_invoice.client_snapshot_email,
      format('Payment reminder for invoice %s', v_invoice.invoice_number),
      format('Invoice %s is overdue. The outstanding amount is %s %s.',
        v_invoice.invoice_number,
        to_char(v_invoice.amount_due, 'FM999999999990.00'),
        v_invoice.currency_code),
      'invoice-overdue:' || v_invoice.id::text || ':' || v_invoice.due_date::text
    on conflict (company_id, idempotency_key)
      where idempotency_key is not null and deleted_at is null
      do nothing;
  end if;

  return true;
end;
$$;

create or replace function public.mark_overdue_invoices(p_as_of date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_count integer := 0;
begin
  for v_invoice_id in
    select id
    from public.invoices
    where deleted_at is null
      and due_date < p_as_of
      and status in ('sent', 'viewed', 'partially_paid')
    order by due_date, id
    for update skip locked
  loop
    update public.invoices
    set status = 'overdue'
    where id = v_invoice_id;
    perform public.apply_invoice_late_fee(v_invoice_id);
    perform public.enqueue_overdue_invoice_reminder(v_invoice_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.advance_recurring_date(
  p_run_date date,
  p_frequency recurring_invoice_frequency
)
returns date
language sql
immutable
as $$
  select case p_frequency
    when 'weekly' then p_run_date + interval '7 days'
    when 'biweekly' then p_run_date + interval '14 days'
    when 'monthly' then p_run_date + interval '1 month'
    when 'quarterly' then p_run_date + interval '3 months'
    when 'yearly' then p_run_date + interval '1 year'
  end::date;
$$;

create or replace function public.process_recurring_schedules(p_as_of date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invoice_template record;
  v_expense_template record;
  v_client record;
  v_profile record;
  v_snapshot_id uuid;
  v_invoice_id uuid;
  v_expense_id uuid;
  v_run_date date;
  v_due_days integer;
  v_subtotal numeric(14, 2);
  v_discount numeric(14, 2);
  v_tax numeric(14, 2);
  v_total numeric(14, 2);
  v_line record;
  v_invoice_count integer := 0;
  v_expense_count integer := 0;
  v_invoice_error_count integer := 0;
  v_expense_error_count integer := 0;
begin
  v_due_days := coalesce(
    (public.lookup_platform_setting(null, 'recurring_invoice_due_days') ->> 'days')::integer,
    30
  );
  if v_due_days < 0 or v_due_days > 3650 then
    raise exception 'process_recurring_schedules: invalid recurring invoice due-day setting';
  end if;

  for v_invoice_template in
    select *
    from public.recurring_invoice_templates
    where is_active and deleted_at is null and next_run_date <= p_as_of
    order by next_run_date, id
    for update skip locked
  loop
    begin
      v_run_date := v_invoice_template.next_run_date;
      select * into v_client
      from public.clients
      where id = v_invoice_template.client_id
        and company_id = v_invoice_template.company_id
        and deleted_at is null;
      if not found then
        raise exception 'recurring invoice client is missing or belongs to another company';
      end if;

      select c.name as company_name, cp.*
        into v_profile
      from public.companies c
      join public.company_profiles cp on cp.company_id = c.id
      where c.id = v_invoice_template.company_id
        and c.deleted_at is null;
      if not found then
        raise exception 'recurring invoice company profile is missing';
      end if;

      insert into public.company_profile_snapshots (
        company_id, company_name, logo_provider_file_id, address_line1,
        address_line2, city, state, postal_code, country_code, tax_id,
        contact_email, contact_phone
      ) values (
        v_invoice_template.company_id, v_profile.company_name,
        v_profile.logo_provider_file_id, v_profile.address_line1,
        v_profile.address_line2, v_profile.city, v_profile.state,
        v_profile.postal_code, v_profile.country_code, v_profile.tax_id,
        v_profile.contact_email, v_profile.contact_phone
      ) returning id into v_snapshot_id;

      select
        coalesce(sum(quantity * unit_price_amount), 0)::numeric(14, 2),
        coalesce(sum(quantity * unit_price_amount * coalesce(discount_percent, 0) / 100), 0)::numeric(14, 2),
        coalesce(sum((quantity * unit_price_amount) * (1 - coalesce(discount_percent, 0) / 100)
          * coalesce(tax_rate_percent, 0) / 100), 0)::numeric(14, 2)
      into v_subtotal, v_discount, v_tax
      from public.recurring_invoice_template_line_items
      where recurring_invoice_template_id = v_invoice_template.id
        and company_id = v_invoice_template.company_id
        and deleted_at is null;
      v_total := v_subtotal - v_discount + v_tax;

      insert into public.invoices (
        company_id, client_id, invoice_number, status,
        company_profile_snapshot_id, client_snapshot_display_name,
        client_snapshot_email, client_snapshot_billing_address_line1,
        client_snapshot_billing_address_line2, client_snapshot_billing_city,
        client_snapshot_billing_state, client_snapshot_billing_postal_code,
        client_snapshot_billing_country_code, issue_date, due_date,
        currency_code, subtotal_amount, tax_total_amount, discount_total_amount,
        total_amount, amount_paid, amount_due, notes, created_by_user_id
      ) values (
        v_invoice_template.company_id, v_invoice_template.client_id, null,
        'draft', v_snapshot_id, v_client.display_name, v_client.email,
        v_client.billing_address_line1, v_client.billing_address_line2,
        v_client.billing_city, v_client.billing_state,
        v_client.billing_postal_code, v_client.billing_country_code,
        v_run_date, v_run_date + v_due_days, v_invoice_template.currency_code,
        v_subtotal, v_tax, v_discount, v_total, 0, v_total,
        v_invoice_template.notes, v_invoice_template.created_by_user_id
      ) returning id into v_invoice_id;

      for v_line in
        select *
        from public.recurring_invoice_template_line_items
        where recurring_invoice_template_id = v_invoice_template.id
          and company_id = v_invoice_template.company_id
          and deleted_at is null
        order by sort_order, id
      loop
        insert into public.invoice_line_items (
          company_id, invoice_id, product_id, description, quantity,
          unit_price_amount, tax_rate_percent, discount_percent, line_total_amount,
          sort_order
        ) values (
          v_invoice_template.company_id, v_invoice_id, v_line.product_id,
          v_line.description, v_line.quantity, v_line.unit_price_amount,
          v_line.tax_rate_percent, v_line.discount_percent,
          round((v_line.quantity * v_line.unit_price_amount)
            * (1 - coalesce(v_line.discount_percent, 0) / 100), 2),
          v_line.sort_order
        );
      end loop;

      update public.recurring_invoice_templates
      set last_generated_invoice_id = v_invoice_id,
          next_run_date = public.advance_recurring_date(v_run_date, frequency),
          is_active = case
            when end_date is not null
              and public.advance_recurring_date(v_run_date, frequency) > end_date then false
            else is_active
          end
      where id = v_invoice_template.id;
      v_invoice_count := v_invoice_count + 1;
    exception when others then
      v_invoice_error_count := v_invoice_error_count + 1;
      insert into public.scheduled_job_runs (
        job_name, idempotency_key, status, error_message, completed_at
      ) values (
        'recurring-invoice-item', v_invoice_template.id::text || ':' || v_run_date::text,
        'failed', sqlerrm, now()
      ) on conflict (job_name, idempotency_key) do update
        set status = 'failed', error_message = excluded.error_message, completed_at = now();
    end;
  end loop;

  for v_expense_template in
    select *
    from public.recurring_expenses
    where is_active and deleted_at is null and next_run_date <= p_as_of
    order by next_run_date, id
    for update skip locked
  loop
    begin
      v_run_date := v_expense_template.next_run_date;
      insert into public.expenses (
        company_id, category_id, description, currency_code, amount,
        expense_date, submitted_by_user_id
      ) values (
        v_expense_template.company_id, v_expense_template.category_id,
        v_expense_template.description, v_expense_template.currency_code,
        v_expense_template.amount, v_run_date, v_expense_template.created_by_user_id
      ) returning id into v_expense_id;

      update public.recurring_expenses
      set last_generated_expense_id = v_expense_id,
          next_run_date = public.advance_recurring_date(v_run_date, frequency),
          is_active = case
            when end_date is not null
              and public.advance_recurring_date(v_run_date, frequency) > end_date then false
            else is_active
          end
      where id = v_expense_template.id;
      v_expense_count := v_expense_count + 1;
    exception when others then
      v_expense_error_count := v_expense_error_count + 1;
      insert into public.scheduled_job_runs (
        job_name, idempotency_key, status, error_message, completed_at
      ) values (
        'recurring-expense-item', v_expense_template.id::text || ':' || v_run_date::text,
        'failed', sqlerrm, now()
      ) on conflict (job_name, idempotency_key) do update
        set status = 'failed', error_message = excluded.error_message, completed_at = now();
    end;
  end loop;

  return jsonb_build_object(
    'invoices_created', v_invoice_count,
    'expenses_created', v_expense_count,
    'invoice_errors', v_invoice_error_count,
    'expense_errors', v_expense_error_count
  );
end;
$$;

create or replace function public.expire_estimates(p_as_of date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.estimates
  set status = 'expired'
  where deleted_at is null
    and expiry_date is not null
    and expiry_date < p_as_of
    and status in ('sent', 'viewed');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.release_due_payment_holds(p_as_of timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hold record;
  v_wallet record;
  v_count integer := 0;
  v_idempotency_key text;
begin
  for v_hold in
    select *
    from public.payment_holds
    where status = 'held' and hold_until <= p_as_of and deleted_at is null
    order by hold_until, id
    for update skip locked
  loop
    select * into v_wallet
    from public.wallet_accounts
    where id = v_hold.wallet_account_id
      and company_id = v_hold.company_id
      and currency_code = v_hold.currency_code
      and deleted_at is null
    for update;
    if not found then
      raise exception 'release_due_payment_holds: wallet account is missing or crosses a tenant boundary';
    end if;

    if v_wallet.held_balance < v_hold.held_amount then
      raise exception 'release_due_payment_holds: wallet held balance is smaller than the payment hold';
    end if;

    v_idempotency_key := 'payment-hold-release:' || v_hold.id::text;
    insert into public.wallet_transactions (
      company_id, wallet_account_id, transaction_type, status,
      currency_code, amount, balance_before, balance_after,
      available_balance_before, available_balance_after,
      reference_type, reference_id, payment_hold_id, idempotency_key,
      description, posted_at
    ) values (
      v_hold.company_id, v_wallet.id, 'hold_released', 'posted',
      v_wallet.currency_code, 0, v_wallet.available_balance + v_wallet.held_balance,
      v_wallet.available_balance + v_wallet.held_balance,
      v_wallet.available_balance, v_wallet.available_balance + v_hold.held_amount,
      'payment_hold', v_hold.id, v_hold.id, v_idempotency_key,
      'Payment hold released after the configured hold period', now()
    ) on conflict (company_id, idempotency_key)
      where idempotency_key is not null
      do nothing;

    update public.wallet_accounts
    set held_balance = held_balance - v_hold.held_amount,
        available_balance = available_balance + v_hold.held_amount,
        version = version + 1
    where id = v_wallet.id;

    update public.payment_holds
    set status = 'released',
        released_amount = held_amount,
        released_at = now(),
        release_reference = v_idempotency_key
    where id = v_hold.id and status = 'held';
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.cleanup_expired_sessions(p_as_of timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_days integer;
  v_session_count integer;
  v_otp_count integer;
  v_token_count integer;
  v_checkout_count integer;
begin
  v_session_days := coalesce(
    (public.lookup_platform_setting(null, 'session_retention_days') ->> 'days')::integer,
    90
  );
  if v_session_days < 1 or v_session_days > 3650 then
    raise exception 'cleanup_expired_sessions: invalid session retention setting';
  end if;

  delete from public.user_sessions
  where revoked_at is not null
     or last_active_at < p_as_of - make_interval(days => v_session_days);
  get diagnostics v_session_count = row_count;

  delete from public.client_access_otp_codes
  where expires_at < p_as_of - interval '1 day';
  get diagnostics v_otp_count = row_count;

  update public.client_access_tokens
  set revoked_at = coalesce(revoked_at, p_as_of)
  where expires_at is not null
    and expires_at < p_as_of
    and revoked_at is null
    and deleted_at is null;
  get diagnostics v_token_count = row_count;

  update public.direct_checkout_sessions
  set status = 'expired'
  where expires_at < p_as_of
    and status in ('created', 'pending_payment');
  get diagnostics v_checkout_count = row_count;

  return jsonb_build_object(
    'sessions_deleted', v_session_count,
    'otp_codes_deleted', v_otp_count,
    'access_tokens_revoked', v_token_count,
    'checkout_sessions_expired', v_checkout_count
  );
end;
$$;

create or replace function public.expire_backup_metadata(p_as_of timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.backups
  set status = 'expired'
  where status = 'completed'
    and expires_at is not null
    and expires_at < p_as_of;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.process_gdpr_request_queue(p_as_of timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
  v_count integer := 0;
begin
  -- Account deletion keeps the minimum financial/audit references required
  -- by foreign keys, anonymizes the profile, revokes sessions and membership,
  -- and suspends owned tenants. Auth identity deletion is intentionally not
  -- attempted here because durable financial/audit rows still reference the
  -- application user; the anonymized profile is the retained legal record.
  for v_request in
    select *
    from public.gdpr_requests
    where status = 'requested'
      and (due_at is null or due_at <= p_as_of)
    order by requested_at, id
    for update skip locked
  loop
    if v_request.request_type = 'account_deletion' then
      delete from public.two_factor_backup_codes where user_id = v_request.user_id;
      delete from public.user_sessions where user_id = v_request.user_id;

      update public.company_memberships
      set is_active = false, deleted_at = p_as_of
      where user_id = v_request.user_id and deleted_at is null;

      update public.companies
      set is_suspended = true,
          suspended_reason = 'Account deletion requested'
      where owner_user_id = v_request.user_id and deleted_at is null;

      update public.users
      set email = 'deleted+' || v_request.user_id::text || '@invalid.local',
          full_name = 'Deleted user',
          avatar_provider_file_id = null,
          platform_role = null,
          is_email_verified = false,
          is_two_factor_enabled = false,
          preferred_two_factor_method = null,
          deleted_at = p_as_of
      where id = v_request.user_id and deleted_at is null;

      update public.gdpr_requests
      set status = 'completed',
          started_at = coalesce(started_at, p_as_of),
          completed_at = p_as_of,
          processing_error = null
      where id = v_request.id;
    else
      -- Export files require the configured encrypted storage adapter. The
      -- request remains visible as in_progress until that adapter records its
      -- provider_file_id; no export is falsely marked complete.
      update public.gdpr_requests
      set status = 'in_progress',
          started_at = coalesce(started_at, p_as_of),
          processing_error = 'Awaiting the configured encrypted export adapter'
      where id = v_request.id;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.queue_backup_job(p_as_of timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retention_days integer;
  v_encryption_version text;
  v_inserted integer;
begin
  v_retention_days := coalesce(
    (public.lookup_platform_setting(null, 'backup_retention_days') ->> 'days')::integer,
    30
  );
  if v_retention_days < 1 or v_retention_days > 3650 then
    raise exception 'queue_backup_job: invalid backup retention setting';
  end if;

  v_encryption_version := public.lookup_platform_setting(null, 'backup_encryption_key_version') ->> 'version';
  insert into public.backups (
    company_id, backup_type, status, encryption_key_version,
    expires_at, created_at
  )
  select null, 'platform_database', 'queued', v_encryption_version,
         p_as_of + make_interval(days => v_retention_days), p_as_of
  where not exists (
    select 1 from public.backups
    where company_id is null
      and backup_type = 'platform_database'
      and status in ('queued', 'running')
      and created_at >= p_as_of - interval '1 day'
  );
  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create or replace function public.run_recurring_billing(
  p_idempotency_key text,
  p_as_of date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.scheduled_job_runs%rowtype;
  v_result jsonb;
begin
  insert into public.scheduled_job_runs (job_name, idempotency_key)
  values ('recurring-billing', p_idempotency_key)
  on conflict (job_name, idempotency_key) do nothing;

  select * into v_existing
  from public.scheduled_job_runs
  where job_name = 'recurring-billing' and idempotency_key = p_idempotency_key;
  if v_existing.status in ('succeeded', 'failed') and v_existing.completed_at is not null then
    return v_existing.result || jsonb_build_object('status', v_existing.status, 'idempotent_replay', true);
  end if;

  begin
    v_result := public.process_recurring_schedules(p_as_of) || jsonb_build_object('status', 'succeeded');
    update public.scheduled_job_runs
    set status = 'succeeded', result = v_result, completed_at = now(), error_message = null
    where job_name = 'recurring-billing' and idempotency_key = p_idempotency_key;
    return v_result;
  exception when others then
    update public.scheduled_job_runs
    set status = 'failed', error_message = sqlerrm, completed_at = now(),
        result = jsonb_build_object('status', 'failed')
    where job_name = 'recurring-billing' and idempotency_key = p_idempotency_key;
    return jsonb_build_object('status', 'failed', 'error', sqlerrm);
  end;
end;
$$;

create or replace function public.run_data_retention_jobs(
  p_idempotency_key text,
  p_as_of timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.scheduled_job_runs%rowtype;
  v_expired_backups integer;
  v_backup_jobs integer;
  v_gdpr_count integer;
  v_result jsonb;
begin
  insert into public.scheduled_job_runs (job_name, idempotency_key)
  values ('data-retention', p_idempotency_key)
  on conflict (job_name, idempotency_key) do nothing;

  select * into v_existing
  from public.scheduled_job_runs
  where job_name = 'data-retention' and idempotency_key = p_idempotency_key;
  if v_existing.status in ('succeeded', 'failed') and v_existing.completed_at is not null then
    return v_existing.result || jsonb_build_object('status', v_existing.status, 'idempotent_replay', true);
  end if;

  begin
    v_expired_backups := public.expire_backup_metadata(p_as_of);
    v_backup_jobs := public.queue_backup_job(p_as_of);
    v_gdpr_count := public.process_gdpr_request_queue(p_as_of);
    v_result := jsonb_build_object(
      'status', 'succeeded',
      'expired_backups', v_expired_backups,
      'backup_jobs_queued', v_backup_jobs,
      'gdpr_requests_processed', v_gdpr_count
    );
    update public.scheduled_job_runs
    set status = 'succeeded', result = v_result, completed_at = now(), error_message = null
    where job_name = 'data-retention' and idempotency_key = p_idempotency_key;
    return v_result;
  exception when others then
    update public.scheduled_job_runs
    set status = 'failed', error_message = sqlerrm, completed_at = now(),
        result = jsonb_build_object('status', 'failed')
    where job_name = 'data-retention' and idempotency_key = p_idempotency_key;
    return jsonb_build_object('status', 'failed', 'error', sqlerrm);
  end;
end;
$$;

create or replace function public.run_scheduled_maintenance(
  p_idempotency_key text,
  p_as_of date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.scheduled_job_runs%rowtype;
  v_result jsonb;
  v_recurring jsonb;
  v_cleanup jsonb;
  v_overdue integer;
  v_expired_estimates integer;
  v_released_holds integer;
  v_data_retention jsonb;
begin
  insert into public.scheduled_job_runs (job_name, idempotency_key)
  values ('scheduled-maintenance', p_idempotency_key)
  on conflict (job_name, idempotency_key) do nothing;

  select * into v_existing
  from public.scheduled_job_runs
  where job_name = 'scheduled-maintenance' and idempotency_key = p_idempotency_key;
  if v_existing.status in ('succeeded', 'failed') and v_existing.completed_at is not null then
    return v_existing.result || jsonb_build_object('status', v_existing.status, 'idempotent_replay', true);
  end if;

  begin
    v_recurring := public.process_recurring_schedules(p_as_of);
    v_overdue := public.mark_overdue_invoices(p_as_of);
    v_expired_estimates := public.expire_estimates(p_as_of);
    v_released_holds := public.release_due_payment_holds(now());
    v_cleanup := public.cleanup_expired_sessions(now());
    v_data_retention := public.run_data_retention_jobs(
      'maintenance:' || p_idempotency_key,
      now()
    );

    v_result := jsonb_build_object(
      'status', 'succeeded',
      'recurring', v_recurring,
      'overdue_invoices', v_overdue,
      'expired_estimates', v_expired_estimates,
      'released_payment_holds', v_released_holds,
      'cleanup', v_cleanup,
      'data_retention', v_data_retention
    );
    update public.scheduled_job_runs
    set status = 'succeeded', result = v_result, completed_at = now(), error_message = null
    where job_name = 'scheduled-maintenance' and idempotency_key = p_idempotency_key;
    return v_result;
  exception when others then
    update public.scheduled_job_runs
    set status = 'failed', error_message = sqlerrm, completed_at = now(),
        result = jsonb_build_object('status', 'failed')
    where job_name = 'scheduled-maintenance' and idempotency_key = p_idempotency_key;
    return jsonb_build_object('status', 'failed', 'error', sqlerrm);
  end;
end;
$$;

-- Install the timestamp triggers on every currently applicable table.
do $$
declare
  v_table record;
begin
  for v_table in
    select table_name
    from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
  loop
    execute format('drop trigger if exists %I on public.%I',
      'set_' || v_table.table_name || '_updated_at', v_table.table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      'set_' || v_table.table_name || '_updated_at', v_table.table_name
    );
  end loop;
end;
$$;

create trigger invoices_assign_number
before insert on public.invoices
for each row execute function public.assign_invoice_number();

create trigger stock_movements_apply_after_insert
after insert on public.stock_movements
for each row execute function public.apply_stock_movement();

create trigger stock_movements_are_append_only
before update or delete on public.stock_movements
for each row execute function public.prevent_stock_movement_mutation();

-- Audit every identifiable public row, including platform-scoped rows. The
-- audit table and scheduler state are excluded to avoid recursion/noise.
create or replace function public.create_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_company_id uuid;
  v_entity_id uuid;
  v_actor_id uuid;
  v_request_id text;
  v_claimed_actor uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_before := to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_after := to_jsonb(new);
  end if;

  v_company_id := coalesce((v_after ->> 'company_id')::uuid, (v_before ->> 'company_id')::uuid);
  v_entity_id := coalesce((v_after ->> 'id')::uuid, (v_before ->> 'id')::uuid);
  v_request_id := nullif(current_setting('request.id', true), '');

  begin
    v_claimed_actor := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    select id into v_actor_id from public.users where id = v_claimed_actor;
  exception when others then
    v_actor_id := null;
  end;

  insert into public.audit_logs (
    company_id, actor_user_id, action, entity_type, entity_id,
    before_data, after_data, metadata, request_id
  ) values (
    v_company_id,
    v_actor_id,
    lower(tg_op),
    tg_table_name,
    v_entity_id,
    v_before,
    v_after,
    jsonb_build_object('source', 'database_trigger', 'table_name', tg_table_name),
    v_request_id
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  v_table record;
begin
  for v_table in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'id'
      and exists (
        select 1 from information_schema.columns company_column
        where company_column.table_schema = c.table_schema
          and company_column.table_name = c.table_name
          and company_column.column_name = 'company_id'
      )
      and c.table_name not in ('audit_logs', 'scheduled_job_runs')
  loop
    execute format('drop trigger if exists %I on public.%I',
      'audit_' || v_table.table_name, v_table.table_name);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.create_audit_log()',
      'audit_' || v_table.table_name, v_table.table_name
    );
  end loop;
end;
$$;

-- Trigger functions are implementation details. Scheduled and mutating
-- functions are service-role only; browser roles never receive a bypass path.
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.generate_next_invoice_number(uuid) from public, anon, authenticated;
revoke all on function public.assign_invoice_number() from public, anon, authenticated;
revoke all on function public.apply_stock_movement() from public, anon, authenticated;
revoke all on function public.prevent_stock_movement_mutation() from public, anon, authenticated;
revoke all on function public.calculate_client_credit_balance(uuid) from public, anon, authenticated;
revoke all on function public.calculate_client_credit_balance(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.lookup_platform_setting(uuid, text) from public, anon, authenticated;
revoke all on function public.apply_invoice_late_fee(uuid) from public, anon, authenticated;
revoke all on function public.enqueue_overdue_invoice_reminder(uuid) from public, anon, authenticated;
revoke all on function public.mark_overdue_invoices(date) from public, anon, authenticated;
revoke all on function public.advance_recurring_date(date, recurring_invoice_frequency) from public, anon, authenticated;
revoke all on function public.process_recurring_schedules(date) from public, anon, authenticated;
revoke all on function public.expire_estimates(date) from public, anon, authenticated;
revoke all on function public.release_due_payment_holds(timestamptz) from public, anon, authenticated;
revoke all on function public.cleanup_expired_sessions(timestamptz) from public, anon, authenticated;
revoke all on function public.expire_backup_metadata(timestamptz) from public, anon, authenticated;
revoke all on function public.process_gdpr_request_queue(timestamptz) from public, anon, authenticated;
revoke all on function public.queue_backup_job(timestamptz) from public, anon, authenticated;
revoke all on function public.run_recurring_billing(text, date) from public, anon, authenticated;
revoke all on function public.run_data_retention_jobs(text, timestamptz) from public, anon, authenticated;
revoke all on function public.run_scheduled_maintenance(text, date) from public, anon, authenticated;
grant execute on function public.calculate_client_credit_balance(uuid) to service_role;
grant execute on function public.run_recurring_billing(text, date) to service_role;
grant execute on function public.calculate_client_credit_balance(uuid, uuid, text) to service_role;
grant execute on function public.run_data_retention_jobs(text, timestamptz) to service_role;
grant execute on function public.run_scheduled_maintenance(text, date) to service_role;

comment on function public.generate_next_invoice_number(uuid) is
  'Returns a gapless per-company invoice number under a transaction-scoped advisory lock. Invoice inserts call it automatically when invoice_number is blank.';
comment on function public.apply_stock_movement() is
  'Applies a stock movement after locking and validating the company warehouse/product stock row.';
comment on function public.calculate_client_credit_balance(uuid) is
  'Calculates a client credit balance from the non-deleted signed ledger for the client default currency.';
comment on function public.apply_invoice_late_fee(uuid) is
  'Applies one versioned, company-overridable late-fee policy at most once to an overdue invoice.';
comment on table public.scheduled_job_runs is
  'Server-only idempotency and failure log for scheduled database work.';

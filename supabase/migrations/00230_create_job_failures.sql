-- supabase/migrations/00230_create_job_failures.sql
-- Where a scheduled job writes down what it could not do.
--
-- The two jobs made resilient here move money: one raises the invoices that
-- renew a subscription, the other lets a seller's held funds out of their
-- hold window. Both walked their queue in a single transaction, so one
-- unlucky row stopped the lot. On the billing side that means nobody is
-- invoiced this month; on the settlement side it means nobody can withdraw.
--
-- Isolating each row fixes the stoppage but introduces a worse danger: a
-- failure that nobody ever hears about. So each failure is written here,
-- with the job, the row and the reason, and the platform console reads it.
-- A job that quietly skips work is not resilience, it is data loss with
-- better manners.

create table public.job_failures (
  id uuid primary key default public.generate_uuid_v7(),

  job_name text not null,
  entity_type text not null,
  entity_id uuid,
  company_id uuid,

  reason text not null,
  occurred_at timestamptz not null default now(),
  resolved_at timestamptz,

  constraint job_failures_job_check
    check (job_name ~ '^[a-z][a-z0-9_]{2,60}$'),
  constraint job_failures_entity_check
    check (length(btrim(entity_type)) between 2 and 60),
  constraint job_failures_reason_check
    check (length(btrim(reason)) between 1 and 500)
);

comment on table public.job_failures is
  'What a scheduled job could not finish, so a skipped row is never silent.';

create index job_failures_recent_idx
  on public.job_failures (occurred_at desc)
  where resolved_at is null;

create index job_failures_company_idx
  on public.job_failures (company_id, occurred_at desc)
  where company_id is not null;

create or replace function public.record_job_failure(
  p_job_name text,
  p_entity_type text,
  p_entity_id uuid,
  p_reason text,
  p_company_id uuid default null
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
  insert into public.job_failures (
    job_name, entity_type, entity_id, company_id, reason
  )
  values (
    p_job_name, p_entity_type, p_entity_id, p_company_id,
    left(coalesce(nullif(btrim(p_reason), ''), 'No reason was reported'), 500)
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.record_job_failure(text, text, uuid, text, uuid) is
  'Writes down one row a scheduled job could not finish, and why.';

create or replace function public.recent_job_failures(p_limit integer default 50)
returns table (
  failure_id uuid,
  job_name text,
  entity_type text,
  entity_id uuid,
  company_id uuid,
  company_name text,
  reason text,
  occurred_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may read the job failures'
      using errcode = '42501';
  end if;

  return query
    select f.id, f.job_name, f.entity_type, f.entity_id, f.company_id,
           c.legal_name, f.reason, f.occurred_at
      from public.job_failures as f
      left join public.companies as c on c.id = f.company_id
     where f.resolved_at is null
     order by f.occurred_at desc
     limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

comment on function public.recent_job_failures(integer) is
  'Lists the work a scheduled job skipped and has not been forgiven for.';

-- -----------------------------------------------------------------------------
-- Billing, one subscription at a time
-- -----------------------------------------------------------------------------

create or replace function public.run_subscription_renewals(p_lead_days integer default 0)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_invoice_id uuid;
  v_count integer := 0;
  v_reason text;
begin
  for v_row in
    select id, company_id
      from public.subscriptions
     where deleted_at is null
       and status in ('active', 'past_due')
       and not cancel_at_period_end
       and amount > 0
       and next_billing_date is not null
       and next_billing_date <= current_date + p_lead_days
  loop
    begin
      v_invoice_id := public.create_subscription_invoice(v_row.id);

      if v_invoice_id is not null then
        v_count := v_count + 1;
      end if;
    exception
      when others then
        get stacked diagnostics v_reason = message_text;

        -- The next run will try this one again. What must not happen is
        -- every other subscription going uninvoiced because of it.
        perform public.record_job_failure(
          'run_subscription_renewals', 'subscription', v_row.id, v_reason, v_row.company_id
        );
    end;
  end loop;

  return v_count;
end;
$$;

comment on function public.run_subscription_renewals(integer) is
  'Raises the invoices that are due. One subscription failing does not stop the rest.';

-- -----------------------------------------------------------------------------
-- Letting held money out, one settlement at a time
-- -----------------------------------------------------------------------------

create or replace function public.release_matured_settlements()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_count integer := 0;
  v_reason text;
begin
  for v_row in
    select s.id,
           s.company_id,
           s.wallet_id,
           s.wallet_transaction_id,
           t.amount,
           t.is_pending
      from public.settlements as s
      left join public.wallet_transactions as t on t.id = s.wallet_transaction_id
     where s.status = 'held'
       and s.hold_until <= current_date
     order by s.created_at
  loop
    begin
      if v_row.is_pending then
        update public.wallet_transactions
           set is_pending = false,
               released_at = now()
         where id = v_row.wallet_transaction_id;

        update public.wallets
           set pending_balance = greatest(pending_balance - v_row.amount, 0),
               available_balance = available_balance + v_row.amount,
               updated_at = now()
         where id = v_row.wallet_id;
      end if;

      update public.settlements
         set status = 'available',
             released_at = now(),
             updated_at = now()
       where id = v_row.id;

      v_count := v_count + 1;
    exception
      when others then
        get stacked diagnostics v_reason = message_text;

        -- The settlement stays held, so the money is never lost; it is
        -- simply not released until somebody looks at the reason.
        perform public.record_job_failure(
          'release_matured_settlements', 'settlement', v_row.id, v_reason, v_row.company_id
        );
    end;
  end loop;

  begin
    perform public.release_matured_wallet_funds();
  exception
    when others then
      get stacked diagnostics v_reason = message_text;

      perform public.record_job_failure(
        'release_matured_settlements', 'wallet_sweep', null, v_reason, null
      );
  end;

  return v_count;
end;
$$;

comment on function public.release_matured_settlements() is
  'Releases matured settlements. One that cannot be released stays held and is reported.';

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.job_failures enable row level security;
alter table public.job_failures force row level security;

create policy job_failures_select on public.job_failures
  for select to authenticated
  using (public.is_super_admin());

grant select on public.job_failures to authenticated;

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.record_job_failure(text, text, uuid, text, uuid)
  from public, authenticated;
revoke execute on function public.recent_job_failures(integer)
  from public, authenticated;

grant execute on function public.record_job_failure(text, text, uuid, text, uuid)
  to service_role;
grant execute on function public.recent_job_failures(integer)
  to authenticated, service_role;

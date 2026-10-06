-- supabase/migrations/00187_install_engagement_triggers.sql
-- Timestamps, audit trail and the rules that keep these features honest.

select public.install_standard_triggers('messaging_channels');
select public.install_standard_triggers('contact_channel_identities');
select public.install_standard_triggers('message_routes');
select public.install_standard_triggers('bank_feed_connections');
select public.install_timestamp_trigger('bank_feed_accounts');
select public.install_soft_delete_guard('bank_feed_accounts');
select public.install_timestamp_trigger('receipt_scans');
select public.install_soft_delete_guard('receipt_scans');
select public.install_standard_triggers('instalment_offers');
select public.install_standard_triggers('loyalty_programs');
select public.install_timestamp_trigger('loyalty_accounts');
select public.install_soft_delete_guard('loyalty_accounts');
select public.install_standard_triggers('loyalty_rewards');

select public.install_timestamp_trigger('channel_suppressions');
select public.install_timestamp_trigger('message_route_steps');
select public.install_timestamp_trigger('message_route_runs');
select public.install_timestamp_trigger('inbound_messages');
select public.install_timestamp_trigger('bank_feed_syncs');
select public.install_timestamp_trigger('bank_transaction_splits');
select public.install_timestamp_trigger('reconciliation_memory');
select public.install_timestamp_trigger('receipt_scan_lines');
select public.install_timestamp_trigger('instalment_plans');
select public.install_actor_trigger('instalment_plans');
select public.install_timestamp_trigger('instalment_schedule_items');
select public.install_timestamp_trigger('loyalty_redemptions');

-- Consent, bank access and money owed are the three things somebody will
-- later ask to see the history of.
select public.install_audit_trigger('contact_channel_identities');
select public.install_audit_trigger('bank_feed_connections');
select public.install_audit_trigger('instalment_plans');
select public.install_audit_trigger('loyalty_programs');

-- -----------------------------------------------------------------------------
-- One primary address per person per channel
-- -----------------------------------------------------------------------------

create or replace function public.enforce_single_primary_contact_channel()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.is_primary and new.deleted_at is null then
    update public.contact_channel_identities
       set is_primary = false,
           updated_at = now()
     where company_id = new.company_id
       and channel = new.channel
       and id <> new.id
       and deleted_at is null
       and (
         (new.client_id is not null and client_id = new.client_id)
         or (new.user_id is not null and user_id = new.user_id)
       );
  end if;

  return new;
end;
$$;

comment on function public.enforce_single_primary_contact_channel() is
  'Keeps one address marked as primary per person per channel.';

create trigger contact_channel_identities_20_primary
  before insert or update of is_primary on public.contact_channel_identities
  for each row execute function public.enforce_single_primary_contact_channel();

-- -----------------------------------------------------------------------------
-- An opt out is not quietly undone
-- -----------------------------------------------------------------------------

create or replace function public.guard_channel_consent()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.consent_state = 'opted_out' and new.consent_state = 'opted_in' then
    if new.consent_source is null or new.consent_recorded_at is null
       or new.consent_recorded_at <= old.opted_out_at then
      raise exception
        'Somebody who opted out can only be added again with fresh consent'
        using errcode = '22023';
    end if;

    new.opted_out_at := null;
    new.opt_out_reason := null;
  end if;

  return new;
end;
$$;

comment on function public.guard_channel_consent() is
  'Refuses to reinstate a contact who opted out without newer consent.';

create trigger contact_channel_identities_25_consent
  before update on public.contact_channel_identities
  for each row execute function public.guard_channel_consent();

-- -----------------------------------------------------------------------------
-- Feed accounts counted on their connection
-- -----------------------------------------------------------------------------

create or replace function public.sync_feed_account_count()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_connection_id uuid;
begin
  v_connection_id := coalesce(new.connection_id, old.connection_id);

  update public.bank_feed_connections
     set account_count = (
           select count(*)
             from public.bank_feed_accounts
            where connection_id = v_connection_id
              and deleted_at is null
         ),
         updated_at = now()
   where id = v_connection_id;

  return null;
end;
$$;

comment on function public.sync_feed_account_count() is
  'Keeps the account count of a bank connection in step with its accounts.';

create trigger bank_feed_accounts_30_count
  after insert or update or delete on public.bank_feed_accounts
  for each row execute function public.sync_feed_account_count();

-- -----------------------------------------------------------------------------
-- A schedule that always adds up to the plan
-- -----------------------------------------------------------------------------

create or replace function public.guard_instalment_schedule()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_plan public.instalment_plans%rowtype;
  v_scheduled numeric;
begin
  select * into v_plan
    from public.instalment_plans
   where id = coalesce(new.plan_id, old.plan_id);

  if not found then
    return coalesce(new, old);
  end if;

  select coalesce(sum(amount), 0)
    into v_scheduled
    from public.instalment_schedule_items
   where plan_id = v_plan.id
     and status <> 'cancelled';

  if round(v_scheduled, 2)
     > round(v_plan.financed_amount + v_plan.interest_amount, 2) + 0.01 then
    raise exception
      'The schedule comes to % but the plan only finances %',
      v_scheduled, v_plan.financed_amount + v_plan.interest_amount
      using errcode = '22023';
  end if;

  return null;
end;
$$;

comment on function public.guard_instalment_schedule() is
  'Refuses a schedule that asks for more than the plan finances.';

create constraint trigger instalment_schedule_items_40_total
  after insert or update on public.instalment_schedule_items
  deferrable initially deferred
  for each row execute function public.guard_instalment_schedule();

-- -----------------------------------------------------------------------------
-- A points balance that always matches its movements
-- -----------------------------------------------------------------------------

create or replace function public.guard_loyalty_balance()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_sum integer;
begin
  select coalesce(sum(points), 0)::integer
    into v_sum
    from public.loyalty_transactions
   where account_id = new.account_id;

  if v_sum <> new.balance_after then
    raise exception
      'The movements come to % but this entry says the balance is %',
      v_sum, new.balance_after
      using errcode = '22023';
  end if;

  return null;
end;
$$;

comment on function public.guard_loyalty_balance() is
  'Checks that every points entry leaves the stated balance behind it.';

create constraint trigger loyalty_transactions_40_balance
  after insert on public.loyalty_transactions
  deferrable initially deferred
  for each row execute function public.guard_loyalty_balance();

-- -----------------------------------------------------------------------------
-- A points entry is never edited
-- -----------------------------------------------------------------------------

create or replace function public.block_loyalty_amendment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Stamping the moment unused points lapsed is the one permitted amendment,
  -- and only when nothing else about the movement changes.
  if tg_op = 'UPDATE'
     and old.expired_at is null
     and new.expired_at is not null
     and new.id is not distinct from old.id
     and new.account_id is not distinct from old.account_id
     and new.entry_type is not distinct from old.entry_type
     and new.points is not distinct from old.points
     and new.balance_after is not distinct from old.balance_after
     and new.expires_on is not distinct from old.expires_on then
    return new;
  end if;

  raise exception 'A points movement is corrected with another movement'
    using errcode = '42501';
end;
$$;

comment on function public.block_loyalty_amendment() is
  'Keeps the points ledger append only.';

create trigger loyalty_transactions_10_immutable
  before update or delete on public.loyalty_transactions
  for each row execute function public.block_loyalty_amendment();

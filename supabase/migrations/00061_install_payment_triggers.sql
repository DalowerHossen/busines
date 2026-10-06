-- supabase/migrations/00061_install_payment_triggers.sql
-- Standard triggers, audit coverage and numbering for the payment module.

select public.install_standard_triggers('payment_gateways');
select public.install_standard_triggers('client_payment_methods');
select public.install_standard_triggers('payments');
select public.install_standard_triggers('payment_receipts');
select public.install_standard_triggers('refunds');
select public.install_standard_triggers('disputes');
select public.install_standard_triggers('wallets');
select public.install_standard_triggers('payout_accounts');
select public.install_standard_triggers('payouts');

select public.install_timestamp_trigger('gateway_availability');
select public.install_timestamp_trigger('payment_intents');
select public.install_timestamp_trigger('payment_allocations');
select public.install_timestamp_trigger('dispute_evidence_items');
select public.install_timestamp_trigger('webhook_events');

-- Money and credentials are fully audited. The audit helper already redacts
-- the encrypted fields, so a secret never reaches the trail in clear.
select public.install_audit_trigger('payment_gateways');
select public.install_audit_trigger('client_payment_methods');
select public.install_audit_trigger('payments');
select public.install_audit_trigger('payment_allocations');
select public.install_audit_trigger('refunds');
select public.install_audit_trigger('disputes');
select public.install_audit_trigger('payouts');
select public.install_audit_trigger('payout_accounts');

-- Assigns the receipt number from the company sequence.
create or replace function public.assign_payment_receipt_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text;
  v_padding smallint;
  v_policy text;
begin
  if new.receipt_number is not null and length(btrim(new.receipt_number)) > 0 then
    return new;
  end if;

  select coalesce(receipt_prefix, 'RCP-'),
         coalesce(number_padding, 4),
         coalesce(numbering_reset_policy, 'never')
    into v_prefix, v_padding, v_policy
    from public.company_profiles
   where company_id = new.company_id
     and deleted_at is null;

  new.receipt_number := public.next_document_number(
    new.company_id,
    'payment_receipt',
    coalesce(v_prefix, 'RCP-'),
    coalesce(v_padding, 4)::smallint,
    coalesce(v_policy, 'never'),
    null::text,
    new.issue_date
  );

  return new;
end;
$$;

comment on function public.assign_payment_receipt_number() is
  'Fills the receipt number from the company counter when none was supplied.';

create trigger payment_receipts_assign_number
  before insert on public.payment_receipts
  for each row execute function public.assign_payment_receipt_number();

-- Gives every new company a wallet in its base currency, so merchant of
-- record proceeds always have somewhere to land.
create or replace function public.create_default_company_wallet()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.wallets (company_id, currency)
  select new.id, new.base_currency
   where not exists (
     select 1
       from public.wallets
      where company_id = new.id
        and currency = new.base_currency
        and deleted_at is null
   );

  return new;
end;
$$;

comment on function public.create_default_company_wallet() is
  'Creates the wallet a company receives its collected proceeds into.';

create trigger companies_create_default_wallet
  after insert on public.companies
  for each row execute function public.create_default_company_wallet();

-- Keeps a payment honest: the sum of its live allocations must always equal
-- the allocated amount recorded on it.
create or replace function public.verify_payment_allocation_total(p_payment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select abs(
           p.allocated_amount - coalesce((
             select sum(a.amount)
               from public.payment_allocations as a
              where a.payment_id = p.id
                and a.reversed_at is null
           ), 0)
         ) < 0.0001
    from public.payments as p
   where p.id = p_payment_id;
$$;

comment on function public.verify_payment_allocation_total(uuid) is
  'Checks that the allocations of a payment add up to its allocated amount.';

-- Reports every payment whose allocations no longer add up, used by the
-- nightly integrity job.
create or replace function public.find_unbalanced_payments(p_company_id uuid default null)
returns table (payment_id uuid, recorded_allocated numeric, actual_allocated numeric)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id,
         p.allocated_amount,
         coalesce(sum(a.amount) filter (where a.reversed_at is null), 0)
    from public.payments as p
    left join public.payment_allocations as a on a.payment_id = p.id
   where p.deleted_at is null
     and (p_company_id is null or p.company_id = p_company_id)
   group by p.id, p.allocated_amount
  having abs(
           p.allocated_amount
           - coalesce(sum(a.amount) filter (where a.reversed_at is null), 0)
         ) >= 0.0001;
$$;

comment on function public.find_unbalanced_payments(uuid) is
  'Lists payments whose allocation total disagrees with their stored amount.';

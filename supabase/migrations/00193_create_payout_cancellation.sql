-- supabase/migrations/00193_create_payout_cancellation.sql
-- Calling off a payout that has not left yet.
--
-- A request that is still waiting can be withdrawn by the business that made
-- it. The reserved amount goes straight back to the available balance, so the
-- wallet never quietly holds money nobody is waiting for. A payout that has
-- already been sent to the bank cannot be called off here: that is what the
-- failure and reversal path is for.

create or replace function public.cancel_payout(
  p_payout_id uuid,
  p_reason text default null
)
returns public.payout_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_payout public.payouts%rowtype;
  v_wallet public.wallets%rowtype;
begin
  select * into v_payout from public.payouts
   where id = p_payout_id and deleted_at is null for update;

  if not found then
    raise exception 'Payout % was not found', p_payout_id using errcode = 'P0002';
  end if;

  select * into v_wallet from public.wallets where id = v_payout.wallet_id for update;

  if not found then
    raise exception 'The wallet behind this payout was not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_service_role()
    or public.is_super_admin()
    or (v_wallet.company_id is not null and public.is_company_owner(v_wallet.company_id))
    or (v_wallet.user_id is not null and v_wallet.user_id = public.current_user_id())
  ) then
    raise exception 'You are not allowed to cancel this payout' using errcode = '42501';
  end if;

  if v_payout.status not in ('requested', 'under_review') then
    raise exception 'Only a payout that has not been sent yet can be called off'
      using errcode = '42501';
  end if;

  update public.payouts
     set status = 'cancelled',
         rejection_reason = coalesce(btrim(p_reason), 'Called off by the business'),
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_payout_id;

  update public.wallets
     set reserved_balance = greatest(reserved_balance - v_payout.amount, 0),
         updated_at = now()
   where id = v_payout.wallet_id;

  perform public.post_wallet_transaction(
    v_payout.wallet_id,
    'payout_reversal',
    v_payout.amount,
    coalesce(btrim(p_reason), 'Payout called off'),
    false,
    jsonb_build_object('payout_id', p_payout_id)
  );

  return 'cancelled'::public.payout_status;
end;
$$;

comment on function public.cancel_payout(uuid, text) is
  'Calls off a payout that has not been sent and returns the money to the wallet.';

grant execute on function public.cancel_payout(uuid, text) to authenticated;

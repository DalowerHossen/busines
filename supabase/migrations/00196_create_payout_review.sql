-- supabase/migrations/00196_create_payout_review.sql
-- Releasing or refusing the money a business has asked for.
--
-- A payout sits in requested until somebody on the platform team looks at it.
-- Approving it moves it towards the provider; refusing it hands the reserved
-- amount straight back, because money must never be left in limbo.

create or replace function public.review_payout(
  p_payout_id uuid,
  p_approve boolean,
  p_note text default null
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
  v_status public.payout_status;
begin
  if not public.is_super_admin() then
    raise exception 'Only the platform team can release a payout' using errcode = '42501';
  end if;

  select * into v_payout
    from public.payouts
   where id = p_payout_id
     and deleted_at is null
     for update;

  if not found then
    raise exception 'Payout % was not found', p_payout_id using errcode = 'P0002';
  end if;

  if v_payout.status not in ('requested', 'under_review') then
    raise exception 'That payout has already been dealt with' using errcode = '22023';
  end if;

  if not p_approve and coalesce(length(btrim(p_note)), 0) < 3 then
    raise exception 'Give a reason before refusing a payout' using errcode = '22023';
  end if;

  select * into v_wallet
    from public.wallets
   where id = v_payout.wallet_id
     for update;

  if p_approve then
    v_status := 'approved';

    update public.payouts
       set status = v_status,
           approved_at = now(),
           approved_by = public.current_user_id(),
           updated_at = now(),
           updated_by = public.current_user_id()
     where id = p_payout_id;
  else
    v_status := 'rejected';

    update public.payouts
       set status = v_status,
           rejection_reason = p_note,
           updated_at = now(),
           updated_by = public.current_user_id()
     where id = p_payout_id;

    -- The amount was reserved when the payout was asked for, so refusing it
    -- has to hand that reservation back rather than leave it stranded.
    update public.wallets
       set reserved_balance = greatest(reserved_balance - v_payout.amount, 0),
           updated_at = now()
     where id = v_payout.wallet_id;

    perform public.post_wallet_transaction(
      v_payout.wallet_id,
      'payout_reversal'::public.wallet_transaction_type,
      v_payout.amount,
      coalesce(p_note, 'Payout refused by the platform team'),
      false,
      jsonb_build_object('payout_id', p_payout_id)
    );
  end if;

  perform public.record_manual_audit_entry(
    case when p_approve then 'approve'::public.audit_action else 'reject'::public.audit_action end,
    'payout',
    p_payout_id,
    v_wallet.company_id,
    case
      when p_approve then 'Payout approved for release'
      else 'Payout refused and the money returned to the wallet'
    end,
    jsonb_build_object('note', p_note, 'amount', v_payout.amount)
  );

  return v_status;
end;
$$;

comment on function public.review_payout(uuid, boolean, text) is
  'Approves a payout for release, or refuses it and returns the reservation.';

grant execute on function public.review_payout(uuid, boolean, text) to authenticated;

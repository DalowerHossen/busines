-- supabase/migrations/00192_create_refund_and_dispute_review.sql
-- Approving refunds and working a chargeback to its conclusion.
--
-- Giving money back and answering a chargeback are the two places where a
-- mistake is expensive and hard to undo, so both are routed through routines
-- that enforce who may act. A refund large enough to need approval is never
-- approved by the person who asked for it, and a dispute outcome is written
-- once with the money it recovered.

-- Approves or declines a refund that was held for a second pair of eyes.
create or replace function public.review_refund(
  p_refund_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns public.approval_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_refund public.refunds%rowtype;
  v_actor uuid := public.current_user_id();
  v_role public.user_role := public.current_user_role();
begin
  select * into v_refund from public.refunds
   where id = p_refund_id and deleted_at is null for update;

  if not found then
    raise exception 'Refund % was not found', p_refund_id using errcode = 'P0002';
  end if;

  if coalesce(v_role, 'staff'::public.user_role) not in ('owner', 'super_admin')
     or not public.can_write_company_data(v_refund.company_id) then
    raise exception 'Only the owner of this business can approve a refund'
      using errcode = '42501';
  end if;

  if v_refund.approval_status is distinct from 'pending' then
    raise exception 'This refund has already been reviewed' using errcode = '42501';
  end if;

  -- The person who asked for the money back is never the person who releases
  -- it, which is the whole point of holding it for review.
  if v_refund.requested_by is not null
     and v_refund.requested_by = v_actor
     and v_role <> 'super_admin' then
    raise exception 'A refund must be approved by somebody other than the person who asked for it'
      using errcode = '42501';
  end if;

  if not p_approve and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Say why the refund was declined' using errcode = '22023';
  end if;

  if p_approve then
    update public.refunds
       set approval_status = 'approved',
           approved_by = v_actor,
           approved_at = now(),
           status = 'processing',
           updated_at = now(),
           updated_by = v_actor
     where id = p_refund_id;

    perform public.settle_refund(p_refund_id);

    return 'approved'::public.approval_status;
  end if;

  update public.refunds
     set approval_status = 'rejected',
         rejection_reason = btrim(p_reason),
         status = 'cancelled',
         approved_by = v_actor,
         approved_at = now(),
         updated_at = now(),
         updated_by = v_actor
   where id = p_refund_id;

  return 'rejected'::public.approval_status;
end;
$$;

comment on function public.review_refund(uuid, boolean, text) is
  'Approves or declines a refund that was held for a second pair of eyes.';

-- Marks the evidence file as sent to the provider.
create or replace function public.submit_dispute_evidence(p_dispute_id uuid)
returns public.dispute_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_dispute public.disputes%rowtype;
  v_items integer;
begin
  select * into v_dispute from public.disputes
   where id = p_dispute_id and deleted_at is null for update;

  if not found then
    raise exception 'Dispute % was not found', p_dispute_id using errcode = 'P0002';
  end if;

  if not public.can_write_company_data(v_dispute.company_id) then
    raise exception 'You are not allowed to work on disputes in this company'
      using errcode = '42501';
  end if;

  if v_dispute.status in ('won', 'lost', 'withdrawn') then
    raise exception 'This dispute has already been decided' using errcode = '42501';
  end if;

  select count(*) into v_items
    from public.dispute_evidence_items
   where dispute_id = p_dispute_id
     and included_in_submission;

  if v_items = 0 then
    raise exception 'There is no evidence to send yet' using errcode = '22023';
  end if;

  update public.disputes
     set status = 'evidence_submitted',
         evidence_submitted_at = now(),
         submitted_by = public.current_user_id(),
         evidence_summary = v_dispute.evidence_summary
           || jsonb_build_object('submitted_item_count', v_items, 'submitted_at', now()),
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_dispute_id;

  return 'evidence_submitted'::public.dispute_status;
end;
$$;

comment on function public.submit_dispute_evidence(uuid) is
  'Marks the gathered evidence as sent to the provider who raised the dispute.';

-- Writes down how a dispute ended and how much of the money came back.
create or replace function public.record_dispute_outcome(
  p_dispute_id uuid,
  p_status public.dispute_status,
  p_note text default null,
  p_recovered_amount numeric default null
)
returns public.dispute_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_dispute public.disputes%rowtype;
  v_recovered numeric;
begin
  select * into v_dispute from public.disputes
   where id = p_dispute_id and deleted_at is null for update;

  if not found then
    raise exception 'Dispute % was not found', p_dispute_id using errcode = 'P0002';
  end if;

  if not public.can_write_company_data(v_dispute.company_id) then
    raise exception 'You are not allowed to work on disputes in this company'
      using errcode = '42501';
  end if;

  if p_status not in ('won', 'lost', 'withdrawn') then
    raise exception 'An outcome must be won, lost or withdrawn' using errcode = '22023';
  end if;

  if v_dispute.status in ('won', 'lost', 'withdrawn') then
    raise exception 'This dispute has already been decided' using errcode = '42501';
  end if;

  v_recovered := case
                   when p_status = 'won' then coalesce(p_recovered_amount, v_dispute.disputed_amount)
                   else coalesce(p_recovered_amount, 0)
                 end;

  if v_recovered < 0 or v_recovered > v_dispute.disputed_amount then
    raise exception 'The recovered amount must be between 0 and the amount disputed'
      using errcode = '22023';
  end if;

  update public.disputes
     set status = p_status,
         resolved_at = now(),
         outcome_note = p_note,
         recovered_amount = v_recovered,
         is_recoverable = (p_status = 'won'),
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_dispute_id;

  -- A dispute the business lost leaves the payment charged back, so the
  -- invoice stops claiming it was settled with that money.
  if p_status = 'lost' then
    update public.payments
       set status = 'charged_back',
           updated_at = now()
     where id = v_dispute.payment_id
       and deleted_at is null;
  end if;

  if p_status = 'won' then
    update public.payments
       set status = case
                      when refunded_amount > 0 then 'partially_refunded'::public.payment_status
                      else 'succeeded'::public.payment_status
                    end,
           updated_at = now()
     where id = v_dispute.payment_id
       and deleted_at is null;
  end if;

  return p_status;
end;
$$;

comment on function public.record_dispute_outcome(
  uuid, public.dispute_status, text, numeric
) is 'Records how a chargeback ended and how much of the money was recovered.';

grant execute on function public.review_refund(uuid, boolean, text) to authenticated;
grant execute on function public.submit_dispute_evidence(uuid) to authenticated;
grant execute on function public.record_dispute_outcome(
  uuid, public.dispute_status, text, numeric
) to authenticated;

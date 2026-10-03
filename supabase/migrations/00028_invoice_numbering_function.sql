-- supabase/migrations/00028_invoice_numbering_function.sql
-- Gapless, per-company, race-condition-safe invoice numbering (Y7.1/Y7.2,
-- Z3.1 in FEATURE-REGISTRY.md). This is a plain callable SQL function, not
-- a trigger: Phase 7 is explicitly scoped in PHASE-PLAN.md to include "the
-- numbering function + advisory lock" so invoice creation has a working
-- number generator from the moment the invoices table exists, while every
-- OTHER generic trigger (including a BEFORE INSERT trigger that would call
-- this function automatically) is deliberately deferred to Phase 19
-- alongside stock-update/balance/late-fee/audit/updated_at triggers. Until
-- Phase 19 wires that trigger, application code calls this function
-- explicitly when creating an invoice.

create function public.generate_next_invoice_number(p_company_id uuid)
returns text
language plpgsql
as $$
declare
  v_prefix text;
  v_sequence integer;
  v_lock_key bigint;
begin
  -- Serializes concurrent invoice creation for the SAME company so the
  -- sequence stays gapless even under concurrent requests, without
  -- blocking unrelated companies from numbering invoices at the same
  -- time. The lock is automatically released at the end of the calling
  -- transaction (pg_advisory_xact_lock), so this function must always be
  -- called from inside the same transaction that inserts the invoice row.
  v_lock_key := hashtext(p_company_id::text);
  perform pg_advisory_xact_lock(v_lock_key);

  update public.company_profiles
  set next_invoice_sequence = next_invoice_sequence + 1
  where company_id = p_company_id
  returning invoice_prefix, next_invoice_sequence - 1 into v_prefix, v_sequence;

  if v_prefix is null then
    raise exception 'generate_next_invoice_number: no company_profiles row found for company_id %', p_company_id;
  end if;

  return v_prefix || '-' || lpad(v_sequence::text, 6, '0');
end;
$$;

comment on function public.generate_next_invoice_number(uuid) is
  'Returns the next gapless invoice number for a company (e.g. INV-000123), serialized per company with a transaction-scoped advisory lock. Must be called inside the same transaction as the invoice insert it numbers.';

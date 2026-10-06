-- supabase/migrations/00206_create_receipt_review.sql
-- The human half of reading a receipt.
--
-- A reader is right most of the time and wrong often enough to matter, so
-- the person reviewing has to be able to see what was read, correct it, and
-- only then turn it into an expense. This file adds the list the review
-- screen works from, the detail behind one receipt including the lines the
-- reader found, and a way to correct the fields before anything is posted.
-- Correcting a receipt cannot touch one that has already become an expense,
-- because the books are not editable through the back door.

-- -----------------------------------------------------------------------------
-- The queue
-- -----------------------------------------------------------------------------

create or replace function public.receipts_to_review(
  p_company_id uuid,
  p_limit integer default 50
)
returns table (
  scan_id uuid,
  file_name text,
  content_type text,
  storage_key text,
  source text,
  status text,
  provider text,
  uploaded_at timestamptz,
  merchant_name text,
  receipt_date date,
  currency char(3),
  subtotal_amount numeric,
  tax_amount numeric,
  total_amount numeric,
  overall_confidence numeric,
  low_confidence_fields text[],
  line_count integer,
  error_message text,
  expense_id uuid
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
    raise exception 'Those receipts belong to another business' using errcode = '42501';
  end if;

  return query
  select s.id,
         s.file_name,
         s.content_type,
         s.storage_key,
         s.source,
         s.status,
         s.provider,
         s.uploaded_at,
         s.merchant_name,
         s.receipt_date,
         s.currency,
         s.subtotal_amount,
         s.tax_amount,
         s.total_amount,
         s.overall_confidence,
         s.low_confidence_fields,
         (
           select count(*)::int
             from public.receipt_scan_lines as l
            where l.scan_id = s.id
         ),
         s.error_message,
         s.expense_id
    from public.receipt_scans as s
   where s.company_id = p_company_id
     and s.deleted_at is null
     and s.status in ('pending', 'processing', 'needs_review', 'failed', 'duplicate')
   order by s.uploaded_at desc
   limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

comment on function public.receipts_to_review(uuid, integer) is
  'Lists the receipts that still need somebody to look at them.';

-- -----------------------------------------------------------------------------
-- One receipt in full
-- -----------------------------------------------------------------------------

create or replace function public.receipt_scan_detail(
  p_scan_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_scan public.receipt_scans%rowtype;
begin
  select * into v_scan
    from public.receipt_scans
   where id = p_scan_id
     and deleted_at is null;

  if not found then
    return null;
  end if;

  if not coalesce(
    public.is_service_role() or public.has_company_access(v_scan.company_id),
    false
  ) then
    raise exception 'That receipt belongs to another business' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'scan_id', v_scan.id,
    'file_name', v_scan.file_name,
    'content_type', v_scan.content_type,
    'storage_key', v_scan.storage_key,
    'status', v_scan.status,
    'source', v_scan.source,
    'provider', v_scan.provider,
    'uploaded_at', v_scan.uploaded_at,
    'merchant_name', v_scan.merchant_name,
    'merchant_tax_id', v_scan.merchant_tax_id,
    'receipt_date', v_scan.receipt_date,
    'receipt_number', v_scan.receipt_number,
    'currency', v_scan.currency,
    'subtotal_amount', v_scan.subtotal_amount,
    'tax_amount', v_scan.tax_amount,
    'tip_amount', v_scan.tip_amount,
    'total_amount', v_scan.total_amount,
    'payment_method_hint', v_scan.payment_method_hint,
    'card_last4', v_scan.card_last4,
    'overall_confidence', v_scan.overall_confidence,
    'field_confidence', v_scan.field_confidence,
    'low_confidence_fields', to_jsonb(v_scan.low_confidence_fields),
    'error_message', v_scan.error_message,
    'expense_id', v_scan.expense_id,
    'raw_text', v_scan.raw_text,
    'lines', coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'line_order', l.line_order,
                   'description', l.description,
                   'quantity', l.quantity,
                   'unit_price', l.unit_price,
                   'line_total', l.line_total,
                   'tax_amount', l.tax_amount,
                   'confidence', l.confidence
                 )
                 order by l.line_order
               )
          from public.receipt_scan_lines as l
         where l.scan_id = v_scan.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

comment on function public.receipt_scan_detail(uuid) is
  'Returns one receipt with every field read and every line found.';

-- -----------------------------------------------------------------------------
-- Correcting what the reader got wrong
-- -----------------------------------------------------------------------------

create or replace function public.correct_receipt_scan(
  p_scan_id uuid,
  p_fields jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_scan public.receipt_scans%rowtype;
  v_total numeric;
  v_tax numeric;
  v_subtotal numeric;
begin
  select * into v_scan
    from public.receipt_scans
   where id = p_scan_id
     and deleted_at is null
     for update;

  if not found then
    raise exception 'That receipt does not exist' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.can_write_company_data(v_scan.company_id),
    false
  ) then
    raise exception 'That receipt is not yours to correct' using errcode = '42501';
  end if;

  if v_scan.status in ('accepted', 'discarded') then
    raise exception 'A receipt that has already been dealt with cannot be corrected'
      using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_fields, 'null'::jsonb)) <> 'object' then
    raise exception 'The corrections have to be given as a set of fields'
      using errcode = '22023';
  end if;

  v_total := coalesce(nullif(p_fields ->> 'total_amount', '')::numeric,
                      v_scan.total_amount);
  v_tax := coalesce(nullif(p_fields ->> 'tax_amount', '')::numeric, v_scan.tax_amount, 0);
  v_subtotal := coalesce(nullif(p_fields ->> 'subtotal_amount', '')::numeric,
                         v_scan.subtotal_amount);

  if v_total is not null and v_total <= 0 then
    raise exception 'A receipt total has to be more than nothing' using errcode = '22023';
  end if;

  -- The parts are allowed to be left out, but when both are given they have
  -- to agree with the total, or the expense would be wrong from the start.
  if v_total is not null and v_subtotal is not null
     and round(v_subtotal + v_tax, 2) <> round(v_total, 2) then
    raise exception 'The parts add up to % but the total says %',
      round(v_subtotal + v_tax, 2), round(v_total, 2)
      using errcode = '22023';
  end if;

  update public.receipt_scans
     set merchant_name = coalesce(nullif(btrim(coalesce(p_fields ->> 'merchant_name', '')), ''),
                                  merchant_name),
         receipt_date = coalesce(nullif(p_fields ->> 'receipt_date', '')::date, receipt_date),
         receipt_number = coalesce(
           nullif(btrim(coalesce(p_fields ->> 'receipt_number', '')), ''),
           receipt_number
         ),
         currency = coalesce(nullif(p_fields ->> 'currency', '')::char(3), currency),
         subtotal_amount = v_subtotal,
         tax_amount = v_tax,
         total_amount = v_total,
         status = case when status = 'failed' then 'needs_review' else status end,
         error_message = case when status = 'failed' then null else error_message end,
         low_confidence_fields = array[]::text[],
         reviewed_at = now(),
         reviewed_by = public.current_user_id(),
         updated_at = now()
   where id = p_scan_id;

  return true;
end;
$$;

comment on function public.correct_receipt_scan(uuid, jsonb) is
  'Lets a person fix what the reader got wrong before anything is posted.';

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.receipts_to_review(uuid, integer)
  from public, authenticated;
revoke execute on function public.receipt_scan_detail(uuid)
  from public, authenticated;
revoke execute on function public.correct_receipt_scan(uuid, jsonb)
  from public, authenticated;

grant execute on function public.receipts_to_review(uuid, integer)
  to authenticated, service_role;
grant execute on function public.receipt_scan_detail(uuid)
  to authenticated, service_role;
grant execute on function public.correct_receipt_scan(uuid, jsonb)
  to authenticated, service_role;

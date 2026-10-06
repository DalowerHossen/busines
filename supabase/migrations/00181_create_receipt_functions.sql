-- supabase/migrations/00181_create_receipt_functions.sql
-- Queueing a receipt, recording what was read, and turning it into an expense.

-- Accepts an uploaded receipt and puts it in the reading queue.
create or replace function public.submit_receipt_scan(
  p_company_id uuid,
  p_storage_key text,
  p_file_name text,
  p_content_type text,
  p_byte_size bigint,
  p_content_hash text default null,
  p_source text default 'upload'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_scan_id uuid;
  v_existing_id uuid;
begin
  if not coalesce(
    public.is_service_role() or public.can_write_company_data(p_company_id),
    false
  ) then
    raise exception 'That account is not yours to write to' using errcode = '42501';
  end if;

  -- The same photograph uploaded twice is one receipt, not two.
  if p_content_hash is not null then
    select id into v_existing_id
      from public.receipt_scans
     where company_id = p_company_id
       and content_hash = p_content_hash
       and deleted_at is null
       and status <> 'duplicate'
     limit 1;
  end if;

  insert into public.receipt_scans (
    company_id, storage_key, file_name, content_type, byte_size, content_hash,
    source, uploaded_by, status, duplicate_of_scan_id
  )
  values (
    p_company_id, p_storage_key, p_file_name, p_content_type, p_byte_size,
    case when v_existing_id is null then p_content_hash else null end,
    coalesce(p_source, 'upload'), public.current_user_id(),
    case when v_existing_id is null then 'pending' else 'duplicate' end,
    v_existing_id
  )
  returning id into v_scan_id;

  return v_scan_id;
end;
$$;

comment on function public.submit_receipt_scan(
  uuid, text, text, text, bigint, text, text
) is 'Queues an uploaded receipt for reading, flagging a repeat upload.';

-- Hands the next receipts to a reader, one worker at a time.
create or replace function public.claim_receipt_scans(p_limit integer default 5)
returns setof public.receipt_scans
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Receipts are read by the platform' using errcode = '42501';
  end if;

  return query
  update public.receipt_scans
     set status = 'processing',
         started_at = now(),
         attempt_count = attempt_count + 1,
         updated_at = now()
   where id in (
     select id
       from public.receipt_scans
      where status = 'pending'
        and deleted_at is null
        and attempt_count < 5
      order by uploaded_at
      limit greatest(coalesce(p_limit, 5), 1)
      for update skip locked
   )
  returning *;
end;
$$;

comment on function public.claim_receipt_scans(integer) is
  'Reserves the next receipts for a reading worker.';

-- Stores what the reader found, and says whether a person must look.
create or replace function public.record_receipt_result(
  p_scan_id uuid,
  p_provider text,
  p_fields jsonb,
  p_lines jsonb default '[]'::jsonb,
  p_overall_confidence numeric default null,
  p_raw_text text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_scan public.receipt_scans%rowtype;
  v_low text[];
  v_line jsonb;
  v_order smallint := 0;
  v_confidence numeric;
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Reading results are written by the platform'
      using errcode = '42501';
  end if;

  select * into v_scan
    from public.receipt_scans
   where id = p_scan_id
     for update;

  if not found or v_scan.status <> 'processing' then
    return false;
  end if;

  v_confidence := coalesce(p_overall_confidence, 0);

  -- Anything the reader was unsure about is named, so the form can ask.
  select coalesce(array_agg(key order by key), array[]::text[])
    into v_low
    from jsonb_each(coalesce(p_fields -> 'confidence', '{}'::jsonb))
   where (value #>> '{}')::numeric < 80;

  update public.receipt_scans
     set status = 'needs_review',
         provider = p_provider,
         completed_at = now(),
         processing_ms = greatest(
           (extract(epoch from (now() - coalesce(started_at, now()))) * 1000)::integer,
           0
         ),
         merchant_name = p_fields ->> 'merchant_name',
         merchant_tax_id = p_fields ->> 'merchant_tax_id',
         receipt_date = nullif(p_fields ->> 'receipt_date', '')::date,
         receipt_number = p_fields ->> 'receipt_number',
         currency = nullif(p_fields ->> 'currency', '')::char(3),
         subtotal_amount = nullif(p_fields ->> 'subtotal_amount', '')::numeric,
         tax_amount = nullif(p_fields ->> 'tax_amount', '')::numeric,
         tip_amount = nullif(p_fields ->> 'tip_amount', '')::numeric,
         total_amount = nullif(p_fields ->> 'total_amount', '')::numeric,
         payment_method_hint = p_fields ->> 'payment_method_hint',
         card_last4 = nullif(p_fields ->> 'card_last4', ''),
         overall_confidence = v_confidence,
         field_confidence = coalesce(p_fields -> 'confidence', '{}'::jsonb),
         low_confidence_fields = v_low,
         raw_text = p_raw_text,
         raw_response = coalesce(p_fields, '{}'::jsonb),
         error_message = null,
         updated_at = now()
   where id = p_scan_id;

  delete from public.receipt_scan_lines where scan_id = p_scan_id;

  if jsonb_typeof(p_lines) = 'array' then
    for v_line in select * from jsonb_array_elements(p_lines)
    loop
      v_order := (v_order + 1)::smallint;

      insert into public.receipt_scan_lines (
        scan_id, line_order, description, quantity, unit_price, line_total,
        tax_amount, confidence
      )
      values (
        p_scan_id,
        v_order,
        coalesce(v_line ->> 'description', 'Item'),
        coalesce(nullif(v_line ->> 'quantity', '')::numeric, 1),
        nullif(v_line ->> 'unit_price', '')::numeric,
        coalesce(nullif(v_line ->> 'line_total', '')::numeric, 0),
        coalesce(nullif(v_line ->> 'tax_amount', '')::numeric, 0),
        nullif(v_line ->> 'confidence', '')::numeric
      );
    end loop;
  end if;

  return true;
end;
$$;

comment on function public.record_receipt_result(
  uuid, text, jsonb, jsonb, numeric, text
) is 'Stores the reading of a receipt and names the fields a person should check.';

-- Marks a reading attempt as failed, so it can be retried or given up on.
create or replace function public.fail_receipt_scan(
  p_scan_id uuid,
  p_error_message text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Reading results are written by the platform'
      using errcode = '42501';
  end if;

  update public.receipt_scans
     set status = case when attempt_count >= 5 then 'failed' else 'pending' end,
         error_message = p_error_message,
         completed_at = case when attempt_count >= 5 then now() else null end,
         updated_at = now()
   where id = p_scan_id
     and status = 'processing';

  return found;
end;
$$;

comment on function public.fail_receipt_scan(uuid, text) is
  'Records a failed reading and retries until the attempts run out.';

-- Turns a reviewed receipt into a real expense in the books.
create or replace function public.create_expense_from_receipt(
  p_scan_id uuid,
  p_category_id uuid default null,
  p_vendor_id uuid default null,
  p_description text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_scan public.receipt_scans%rowtype;
  v_expense_id uuid;
  v_total numeric;
  v_tax numeric;
begin
  select * into v_scan
    from public.receipt_scans
   where id = p_scan_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That receipt does not exist' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.can_write_company_data(v_scan.company_id),
    false
  ) then
    raise exception 'That account is not yours to write to' using errcode = '42501';
  end if;

  if v_scan.status not in ('needs_review', 'pending') then
    raise exception 'That receipt has already been dealt with'
      using errcode = '22023';
  end if;

  if v_scan.total_amount is null or v_scan.total_amount <= 0 then
    raise exception 'The receipt total has to be filled in before it is posted'
      using errcode = '22023';
  end if;

  v_total := v_scan.total_amount;
  v_tax := coalesce(v_scan.tax_amount, 0);

  -- The numbering trigger gives the expense its reference, so none is passed.
  insert into public.expenses (
    company_id, status, vendor_id, category_id, expense_date,
    description, reference, currency, subtotal_amount, tax_amount,
    receipt_storage_key, receipt_file_name, ocr_extracted,
    ocr_confidence, created_by
  )
  values (
    v_scan.company_id,
    'draft',
    p_vendor_id,
    p_category_id,
    coalesce(v_scan.receipt_date, current_date),
    coalesce(p_description, v_scan.merchant_name, 'Receipt'),
    v_scan.receipt_number,
    coalesce(v_scan.currency, 'USD'),
    coalesce(v_scan.subtotal_amount, v_total - v_tax),
    v_tax,
    v_scan.storage_key,
    v_scan.file_name,
    v_scan.raw_response,
    v_scan.overall_confidence,
    public.current_user_id()
  )
  returning id into v_expense_id;

  update public.receipt_scans
     set status = 'accepted',
         expense_id = v_expense_id,
         reviewed_at = now(),
         reviewed_by = public.current_user_id(),
         updated_at = now()
   where id = p_scan_id;

  return v_expense_id;
end;
$$;

comment on function public.create_expense_from_receipt(uuid, uuid, uuid, text) is
  'Creates a draft expense from a reviewed receipt and links the two.';

-- Throws a receipt away without losing the record that it existed.
create or replace function public.discard_receipt_scan(
  p_scan_id uuid,
  p_reason text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_scan public.receipt_scans%rowtype;
begin
  select * into v_scan
    from public.receipt_scans
   where id = p_scan_id and deleted_at is null;

  if not found then
    return false;
  end if;

  if not coalesce(
    public.is_service_role() or public.can_write_company_data(v_scan.company_id),
    false
  ) then
    raise exception 'That account is not yours to write to' using errcode = '42501';
  end if;

  if v_scan.status = 'accepted' then
    raise exception 'A receipt already posted to the books cannot be discarded'
      using errcode = '22023';
  end if;

  update public.receipt_scans
     set status = 'discarded',
         discarded_at = now(),
         discard_reason = p_reason,
         updated_at = now()
   where id = p_scan_id;

  return true;
end;
$$;

comment on function public.discard_receipt_scan(uuid, text) is
  'Discards a receipt that is not going to be posted, with the reason why.';

-- How well the reader is doing, which decides whether it is worth paying for.
create or replace function public.receipt_scan_summary(p_company_id uuid)
returns table (
  waiting_count integer,
  review_count integer,
  accepted_count integer,
  duplicate_count integer,
  failed_count integer,
  average_confidence numeric
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
    raise exception 'That account is not yours to read' using errcode = '42501';
  end if;

  return query
  select (count(*) filter (where s.status in ('pending', 'processing')))::integer,
         (count(*) filter (where s.status = 'needs_review'))::integer,
         (count(*) filter (where s.status = 'accepted'))::integer,
         (count(*) filter (where s.status = 'duplicate'))::integer,
         (count(*) filter (where s.status = 'failed'))::integer,
         round(coalesce(avg(s.overall_confidence), 0), 2)
    from public.receipt_scans as s
   where s.company_id = p_company_id
     and s.deleted_at is null;
end;
$$;

comment on function public.receipt_scan_summary(uuid) is
  'Counts receipts by state and reports how confident the reader has been.';

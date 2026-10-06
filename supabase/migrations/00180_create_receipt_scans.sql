-- supabase/migrations/00180_create_receipt_scans.sql
-- Reading a photograph of a receipt.
--
-- The reader never writes an expense on its own. It produces a draft with a
-- confidence against every field, a person glances at it, and only then does
-- it become a record in the books. Low confidence fields are listed so the
-- interface can put the cursor exactly where the human is needed.

create table public.receipt_scans (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  storage_key text not null,
  file_name text not null,
  content_type text not null,
  byte_size bigint not null,
  content_hash text,
  page_count smallint not null default 1,

  source text not null default 'upload',
  uploaded_by uuid,
  uploaded_at timestamptz not null default now(),

  status text not null default 'pending',
  provider text,
  provider_job_reference text,
  started_at timestamptz,
  completed_at timestamptz,
  processing_ms integer,
  attempt_count smallint not null default 0,
  error_message text,

  -- What the reader believes it found.
  merchant_name text,
  merchant_tax_id text,
  receipt_date date,
  receipt_number text,
  currency char(3),
  subtotal_amount numeric(18, 4),
  tax_amount numeric(18, 4),
  tip_amount numeric(18, 4),
  total_amount numeric(18, 4),
  payment_method_hint text,
  card_last4 text,

  overall_confidence numeric(5, 2),
  field_confidence jsonb not null default '{}'::jsonb,
  low_confidence_fields text[] not null default array[]::text[],
  raw_text text,
  raw_response jsonb not null default '{}'::jsonb,

  -- Review and what it became.
  reviewed_at timestamptz,
  reviewed_by uuid,
  expense_id uuid,
  duplicate_of_scan_id uuid,
  discarded_at timestamptz,
  discard_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint receipt_scans_file_name_check
    check (length(btrim(file_name)) between 1 and 255),
  constraint receipt_scans_content_type_check
    check (content_type in ('image/jpeg', 'image/png', 'image/webp',
                            'image/heic', 'application/pdf')),
  constraint receipt_scans_size_check
    check (byte_size between 1 and 26214400),
  constraint receipt_scans_hash_check
    check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),
  constraint receipt_scans_pages_check
    check (page_count between 1 and 50),
  constraint receipt_scans_source_check
    check (source in ('upload', 'mobile_camera', 'email_inbox', 'api',
                      'bank_feed_prompt')),
  constraint receipt_scans_status_check
    check (status in ('pending', 'processing', 'needs_review', 'accepted',
                      'duplicate', 'failed', 'discarded')),
  constraint receipt_scans_attempts_check
    check (attempt_count between 0 and 10),
  constraint receipt_scans_currency_check
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint receipt_scans_amounts_check
    check (coalesce(subtotal_amount, 0) >= 0 and coalesce(tax_amount, 0) >= 0
           and coalesce(tip_amount, 0) >= 0 and coalesce(total_amount, 0) >= 0),
  constraint receipt_scans_confidence_check
    check (overall_confidence is null or overall_confidence between 0 and 100),
  constraint receipt_scans_card_check
    check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  constraint receipt_scans_failure_check
    check (status <> 'failed' or error_message is not null),
  constraint receipt_scans_duplicate_check
    check (status <> 'duplicate' or duplicate_of_scan_id is not null),
  constraint receipt_scans_accepted_check
    check (status <> 'accepted' or expense_id is not null),
  constraint receipt_scans_discard_check
    check (discarded_at is null or discard_reason is not null)
);

comment on table public.receipt_scans is
  'A photographed receipt, what the reader made of it, and what it became.';

create index receipt_scans_company_idx
  on public.receipt_scans (company_id, status, uploaded_at desc)
  where deleted_at is null;

create index receipt_scans_queue_idx
  on public.receipt_scans (uploaded_at)
  where status = 'pending' and deleted_at is null;

create unique index receipt_scans_hash_unique
  on public.receipt_scans (company_id, content_hash)
  where content_hash is not null and deleted_at is null
    and status <> 'duplicate';

-- -----------------------------------------------------------------------------
-- What was on the receipt
-- -----------------------------------------------------------------------------

create table public.receipt_scan_lines (
  id uuid primary key default public.generate_uuid_v7(),
  scan_id uuid not null,

  line_order smallint not null,
  description text not null,
  quantity numeric(18, 4) not null default 1,
  unit_price numeric(18, 4),
  line_total numeric(18, 4) not null,
  tax_amount numeric(18, 4) not null default 0,
  confidence numeric(5, 2),

  -- Where it was found, so the interface can highlight it on the image.
  bounding_box jsonb,

  suggested_category_id uuid,
  is_accepted boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint receipt_scan_lines_order_check
    check (line_order between 1 and 200),
  constraint receipt_scan_lines_description_check
    check (length(btrim(description)) between 1 and 300),
  constraint receipt_scan_lines_quantity_check
    check (quantity > 0),
  constraint receipt_scan_lines_confidence_check
    check (confidence is null or confidence between 0 and 100)
);

comment on table public.receipt_scan_lines is
  'One line the reader found on a receipt, with where it sat on the image.';

create unique index receipt_scan_lines_order_unique
  on public.receipt_scan_lines (scan_id, line_order);

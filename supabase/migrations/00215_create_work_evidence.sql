-- supabase/migrations/00215_create_work_evidence.sql
-- Proof that the work was actually done.
--
-- A freelancer sending an invoice across a border is asking a stranger to
-- pay for something the stranger cannot touch. The single thing that makes
-- that easy is evidence attached to the invoice itself: the delivered files,
-- the link to the repository, the hours logged, the screenshot of the thing
-- working. The client sees it on the same page as the pay button.
--
-- The same record does a second job later. If the payer disputes the charge,
-- this evidence is what the platform submits on the seller's behalf, which
-- is why it is frozen once the invoice has been paid: evidence that can be
-- edited after the fact is not evidence.

create table public.invoice_work_evidence (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  invoice_id uuid not null,

  -- file, link, note, hours or milestone.
  kind text not null default 'file',
  title text not null,
  description text,

  -- A delivered file held in storage, or an address the client can open.
  file_id uuid,
  external_url text,

  -- For logged work: what was done, over how long.
  hours_worked numeric(10, 2),
  performed_on date,

  -- Evidence the seller keeps for themselves is still useful in a dispute
  -- but is not shown to the client.
  is_client_visible boolean not null default true,
  display_order smallint not null default 0,

  -- Set when the invoice is paid, after which the record cannot change.
  sealed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint invoice_work_evidence_kind_check
    check (kind in ('file', 'link', 'note', 'hours', 'milestone')),
  constraint invoice_work_evidence_title_check
    check (length(btrim(title)) between 2 and 160),
  constraint invoice_work_evidence_description_check
    check (description is null or length(btrim(description)) <= 2000),
  constraint invoice_work_evidence_url_check
    check (
      external_url is null
      or (external_url ~ '^https://[^[:space:]]+$' and length(external_url) between 12 and 500)
    ),
  constraint invoice_work_evidence_hours_check
    check (hours_worked is null or (hours_worked > 0 and hours_worked <= 10000)),
  constraint invoice_work_evidence_source_check
    check (
      case kind
        when 'file' then file_id is not null
        when 'link' then external_url is not null
        when 'hours' then hours_worked is not null
        else true
      end
    )
);

comment on table public.invoice_work_evidence is
  'What the seller delivered, attached to the invoice the client is asked to pay.';

comment on column public.invoice_work_evidence.sealed_at is
  'Set when the invoice is paid; sealed evidence can no longer be edited or removed.';

create index invoice_work_evidence_invoice_idx
  on public.invoice_work_evidence (invoice_id, display_order, created_at)
  where deleted_at is null;

create index invoice_work_evidence_company_idx
  on public.invoice_work_evidence (company_id, created_at desc)
  where deleted_at is null;

select public.install_standard_triggers('invoice_work_evidence');

-- -----------------------------------------------------------------------------
-- Adding and removing proof
-- -----------------------------------------------------------------------------

create or replace function public.add_work_evidence(
  p_invoice_id uuid,
  p_kind text,
  p_title text,
  p_description text default null,
  p_file_id uuid default null,
  p_external_url text default null,
  p_hours_worked numeric default null,
  p_performed_on date default null,
  p_is_client_visible boolean default true
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_evidence_id uuid;
  v_order smallint;
begin
  select * into v_invoice
    from public.invoices
   where id = p_invoice_id
     and deleted_at is null;

  if not found then
    raise exception 'That invoice was not found' using errcode = 'P0002';
  end if;

  if not (public.is_service_role() or public.can_write_company_data(v_invoice.company_id)) then
    raise exception 'You are not allowed to work on this invoice' using errcode = '42501';
  end if;

  -- Proof may be added right up to the moment the money arrives, because a
  -- client often asks for one more screenshot before paying. After that the
  -- record is closed.
  if v_invoice.status in ('paid', 'cancelled', 'written_off') then
    raise exception 'This invoice is closed and its proof of work can no longer change'
      using errcode = '22023';
  end if;

  select coalesce(max(display_order), 0) + 1 into v_order
    from public.invoice_work_evidence
   where invoice_id = p_invoice_id
     and deleted_at is null;

  insert into public.invoice_work_evidence (
    company_id, invoice_id, kind, title, description, file_id, external_url,
    hours_worked, performed_on, is_client_visible, display_order,
    created_by, updated_by
  )
  values (
    v_invoice.company_id, p_invoice_id, p_kind, btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''), p_file_id,
    nullif(btrim(coalesce(p_external_url, '')), ''),
    p_hours_worked, p_performed_on, coalesce(p_is_client_visible, true), v_order,
    public.current_user_id(), public.current_user_id()
  )
  returning id into v_evidence_id;

  -- A delivered file belongs to the invoice from now on, so the file library
  -- shows where it is used and the cleanup job leaves it alone.
  if p_file_id is not null then
    perform public.attach_file(p_file_id, 'invoice', p_invoice_id);
  end if;

  return v_evidence_id;
end;
$$;

comment on function public.add_work_evidence(
  uuid, text, text, text, uuid, text, numeric, date, boolean
) is 'Attaches proof of the delivered work to an invoice.';

create or replace function public.remove_work_evidence(p_evidence_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_evidence public.invoice_work_evidence%rowtype;
begin
  select * into v_evidence
    from public.invoice_work_evidence
   where id = p_evidence_id
     and deleted_at is null;

  if not found then
    return false;
  end if;

  if not (public.is_service_role()
          or public.can_write_company_data(v_evidence.company_id)) then
    raise exception 'You are not allowed to work on this invoice' using errcode = '42501';
  end if;

  if v_evidence.sealed_at is not null then
    raise exception 'This proof was sealed when the invoice was paid and cannot be removed'
      using errcode = '22023';
  end if;

  update public.invoice_work_evidence
     set deleted_at = now(),
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_evidence_id;

  return true;
end;
$$;

comment on function public.remove_work_evidence(uuid) is
  'Removes a piece of proof that has not yet been sealed by payment.';

-- -----------------------------------------------------------------------------
-- Sealing the record
-- -----------------------------------------------------------------------------

-- Once the client has paid, what they saw before paying is exactly what the
-- platform will produce in a dispute, so it is frozen at that moment.
create or replace function public.seal_invoice_work_evidence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'paid' and coalesce(old.status, 'draft') <> 'paid' then
    update public.invoice_work_evidence
       set sealed_at = now(),
           updated_at = now()
     where invoice_id = new.id
       and sealed_at is null
       and deleted_at is null;
  end if;

  return new;
end;
$$;

comment on function public.seal_invoice_work_evidence() is
  'Freezes the proof attached to an invoice at the moment it is paid.';

create trigger invoices_seal_work_evidence
  after update of status on public.invoices
  for each row execute function public.seal_invoice_work_evidence();

-- -----------------------------------------------------------------------------
-- Reading it back
-- -----------------------------------------------------------------------------

create or replace function public.invoice_work_evidence(p_invoice_id uuid)
returns table (
  evidence_id uuid,
  kind text,
  title text,
  description text,
  file_id uuid,
  file_name text,
  byte_size bigint,
  mime_type text,
  external_url text,
  hours_worked numeric,
  performed_on date,
  is_client_visible boolean,
  is_sealed boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_company uuid;
begin
  select company_id into v_company
    from public.invoices
   where id = p_invoice_id
     and deleted_at is null;

  if v_company is null then
    raise exception 'That invoice was not found' using errcode = 'P0002';
  end if;

  if not (public.is_service_role() or public.has_company_access(v_company)) then
    raise exception 'You do not have permission to read this invoice'
      using errcode = '42501';
  end if;

  return query
    select e.id,
           e.kind,
           e.title,
           e.description,
           e.file_id,
           f.file_name,
           f.byte_size,
           f.mime_type,
           e.external_url,
           e.hours_worked,
           e.performed_on,
           e.is_client_visible,
           e.sealed_at is not null,
           e.created_at
      from public.invoice_work_evidence as e
      left join public.files as f on f.id = e.file_id and f.deleted_at is null
     where e.invoice_id = p_invoice_id
       and e.deleted_at is null
     order by e.display_order, e.created_at;
end;
$$;

comment on function public.invoice_work_evidence(uuid) is
  'Lists the proof attached to one invoice for the business that raised it.';

-- What the client is allowed to see, which is a smaller set and carries no
-- internal note.
create or replace function public.client_work_evidence(p_invoice_id uuid)
returns table (
  evidence_id uuid,
  kind text,
  title text,
  description text,
  file_id uuid,
  file_name text,
  byte_size bigint,
  external_url text,
  hours_worked numeric,
  performed_on date
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_service_role() then
    raise exception 'This is read on behalf of a client link only'
      using errcode = '42501';
  end if;

  return query
    select e.id,
           e.kind,
           e.title,
           e.description,
           e.file_id,
           f.file_name,
           f.byte_size,
           e.external_url,
           e.hours_worked,
           e.performed_on
      from public.invoice_work_evidence as e
      left join public.files as f on f.id = e.file_id and f.deleted_at is null
     where e.invoice_id = p_invoice_id
       and e.deleted_at is null
       and e.is_client_visible
     order by e.display_order, e.created_at;
end;
$$;

comment on function public.client_work_evidence(uuid) is
  'The proof a client sees beside the pay button on an invoice link.';

-- Totals for the invoice screen: how much proof there is, and how many hours
-- it accounts for.
create or replace function public.work_evidence_summary(p_invoice_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_company uuid;
  v_result jsonb;
begin
  select company_id into v_company
    from public.invoices
   where id = p_invoice_id
     and deleted_at is null;

  if v_company is null then
    raise exception 'That invoice was not found' using errcode = 'P0002';
  end if;

  if not (public.is_service_role() or public.has_company_access(v_company)) then
    raise exception 'You do not have permission to read this invoice'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
           'item_count', count(*),
           'client_visible_count', count(*) filter (where is_client_visible),
           'file_count', count(*) filter (where kind = 'file'),
           'link_count', count(*) filter (where kind = 'link'),
           'hours_logged', coalesce(sum(hours_worked), 0),
           'is_sealed', bool_or(sealed_at is not null)
         )
    into v_result
    from public.invoice_work_evidence
   where invoice_id = p_invoice_id
     and deleted_at is null;

  return coalesce(v_result, jsonb_build_object('item_count', 0));
end;
$$;

comment on function public.work_evidence_summary(uuid) is
  'Counts the proof attached to an invoice and the hours it accounts for.';

-- -----------------------------------------------------------------------------
-- The same proof, when the payer disputes the charge
-- -----------------------------------------------------------------------------

-- Pulls the delivered work into the evidence package. This is the strongest
-- material a seller has in a dispute, and it is already sealed, so it is
-- added as its own item rather than mixed into the delivery history.
create or replace function public.attach_work_evidence_to_dispute(p_dispute_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_dispute public.disputes%rowtype;
  v_count integer := 0;
  v_row record;
begin
  select * into v_dispute from public.disputes where id = p_dispute_id;

  if not found then
    raise exception 'That dispute was not found' using errcode = 'P0002';
  end if;

  if not (public.is_service_role()
          or public.can_write_company_data(v_dispute.company_id)) then
    raise exception 'You are not allowed to work on disputes in this company'
      using errcode = '42501';
  end if;

  if v_dispute.invoice_id is null then
    return 0;
  end if;

  for v_row in
    select e.id,
           e.kind,
           e.title,
           e.description,
           e.external_url,
           e.hours_worked,
           e.performed_on,
           e.created_at,
           f.storage_key,
           f.file_name,
           f.byte_size,
           f.content_hash
      from public.invoice_work_evidence as e
      left join public.files as f on f.id = e.file_id and f.deleted_at is null
     where e.invoice_id = v_dispute.invoice_id
       and e.deleted_at is null
     order by e.display_order, e.created_at
  loop
    insert into public.dispute_evidence_items (
      company_id, dispute_id, evidence_type, title, description, storage_key,
      file_name, file_size_bytes, content_sha256, payload, collected_by
    )
    values (
      v_dispute.company_id, p_dispute_id, 'delivered_work',
      left(v_row.title, 160), v_row.description, v_row.storage_key,
      v_row.file_name, v_row.byte_size, v_row.content_hash,
      jsonb_build_object(
        'kind', v_row.kind,
        'external_url', v_row.external_url,
        'hours_worked', v_row.hours_worked,
        'performed_on', v_row.performed_on,
        'attached_at', v_row.created_at
      ),
      public.current_user_id()
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.attach_work_evidence_to_dispute(uuid) is
  'Adds the delivered work to the evidence package answering a chargeback.';

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.invoice_work_evidence enable row level security;
alter table public.invoice_work_evidence force row level security;

create policy invoice_work_evidence_select on public.invoice_work_evidence
  for select to authenticated
  using (deleted_at is null and public.has_company_access(company_id));

comment on policy invoice_work_evidence_select on public.invoice_work_evidence is
  'A business sees the proof it attached to its own invoices and no other.';

grant select on public.invoice_work_evidence to authenticated;

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.add_work_evidence(
  uuid, text, text, text, uuid, text, numeric, date, boolean
) from public, authenticated;
revoke execute on function public.remove_work_evidence(uuid)
  from public, authenticated;
revoke execute on function public.invoice_work_evidence(uuid)
  from public, authenticated;
revoke execute on function public.client_work_evidence(uuid)
  from public, authenticated;
revoke execute on function public.work_evidence_summary(uuid)
  from public, authenticated;
revoke execute on function public.attach_work_evidence_to_dispute(uuid)
  from public, authenticated;

grant execute on function public.add_work_evidence(
  uuid, text, text, text, uuid, text, numeric, date, boolean
) to authenticated, service_role;
grant execute on function public.remove_work_evidence(uuid)
  to authenticated, service_role;
grant execute on function public.invoice_work_evidence(uuid)
  to authenticated, service_role;
grant execute on function public.client_work_evidence(uuid) to service_role;
grant execute on function public.work_evidence_summary(uuid)
  to authenticated, service_role;
grant execute on function public.attach_work_evidence_to_dispute(uuid)
  to authenticated, service_role;

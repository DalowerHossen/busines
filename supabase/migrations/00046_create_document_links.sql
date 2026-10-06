-- supabase/migrations/00046_create_document_links.sql
-- Signed links clients use to open their documents.
--
-- Clients never hold an account. Every document they see is reached through a
-- link whose token is stored only as a hash, which can expire, be revoked and
-- optionally be protected by a one time code sent to their email address.

create table public.document_links (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  document_kind public.shared_document_type not null,
  document_id uuid not null,

  -- Only the hash is stored. The token itself exists in the emailed URL alone.
  token_hash text not null,
  -- Short, human shareable code used by the short link domain.
  short_code text not null,

  status public.link_token_status not null default 'active',
  recipient_email citext,
  recipient_name text,

  -- Optional email verification before the document opens. The default is off,
  -- so a client link opens directly unless the owner turns the check on.
  requires_email_otp boolean not null default false,
  otp_code_hash text,
  otp_sent_at timestamptz,
  otp_verified_at timestamptz,
  otp_attempt_count smallint not null default 0,

  expires_at timestamptz,
  max_view_count integer,
  view_count integer not null default 0,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  last_viewed_ip inet,

  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,

  constraint document_links_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint document_links_short_code_check
    check (short_code ~ '^[A-Za-z0-9_-]{6,24}$'),
  constraint document_links_otp_hash_check
    check (otp_code_hash is null or otp_code_hash ~ '^[0-9a-f]{64}$'),
  constraint document_links_attempts_check
    check (otp_attempt_count between 0 and 10),
  constraint document_links_view_limit_check
    check (max_view_count is null or max_view_count > 0),
  constraint document_links_revoked_check
    check (status <> 'revoked' or revoked_at is not null)
);

comment on table public.document_links is
  'Signed, revocable links that give a client access to one document.';
comment on column public.document_links.token_hash is
  'SHA-256 of the link token; the token itself is never stored.';

create unique index document_links_token_unique
  on public.document_links (token_hash);

create unique index document_links_short_code_unique
  on public.document_links (short_code);

create index document_links_document_idx
  on public.document_links (document_kind, document_id, created_at desc);

create index document_links_company_idx
  on public.document_links (company_id, status);

create index document_links_expiry_idx
  on public.document_links (expires_at)
  where status = 'active' and expires_at is not null;

-- Resolves a token to the document it unlocks, applying every access rule.
-- The function is the only supported way to turn a token into a document, so
-- the rules cannot be bypassed by a caller that forgets one of them.
create or replace function public.resolve_document_link(
  p_token_hash text,
  p_ip_address inet default null,
  p_user_agent text default null
)
returns table (
  link_id uuid,
  company_id uuid,
  document_kind public.shared_document_type,
  document_id uuid,
  requires_email_otp boolean,
  recipient_email citext
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_link public.document_links%rowtype;
begin
  select * into v_link
    from public.document_links
   where token_hash = p_token_hash
     for update;

  if not found then
    raise exception 'This link is not valid' using errcode = '42501';
  end if;

  if v_link.status = 'revoked' then
    raise exception 'This link has been revoked' using errcode = '42501';
  end if;

  if v_link.expires_at is not null and v_link.expires_at <= now() then
    update public.document_links
       set status = 'expired', updated_at = now()
     where id = v_link.id;

    raise exception 'This link has expired' using errcode = '42501';
  end if;

  if v_link.max_view_count is not null and v_link.view_count >= v_link.max_view_count then
    update public.document_links
       set status = 'consumed', updated_at = now()
     where id = v_link.id;

    raise exception 'This link has already been used' using errcode = '42501';
  end if;

  update public.document_links
     set view_count = view_count + 1,
         first_viewed_at = coalesce(first_viewed_at, now()),
         last_viewed_at = now(),
         last_viewed_ip = coalesce(p_ip_address, last_viewed_ip),
         updated_at = now()
   where id = v_link.id;

  insert into public.document_events (
    company_id, document_kind, document_id, event_type, recipient_email,
    ip_address, user_agent
  )
  values (
    v_link.company_id, v_link.document_kind, v_link.document_id, 'opened',
    v_link.recipient_email, p_ip_address, p_user_agent
  );

  if v_link.document_kind = 'invoice' then
    update public.invoices
       set first_viewed_at = coalesce(first_viewed_at, now()),
           last_viewed_at = now(),
           view_count = view_count + 1,
           status = case when status = 'sent' then 'viewed' else status end,
           updated_at = now()
     where id = v_link.document_id;
  elsif v_link.document_kind = 'estimate' then
    update public.estimates
       set first_viewed_at = coalesce(first_viewed_at, now()),
           last_viewed_at = now(),
           view_count = view_count + 1,
           status = case when status = 'sent' then 'viewed' else status end,
           updated_at = now()
     where id = v_link.document_id;
  end if;

  return query
    select v_link.id,
           v_link.company_id,
           v_link.document_kind,
           v_link.document_id,
           v_link.requires_email_otp,
           v_link.recipient_email;
end;
$$;

comment on function public.resolve_document_link(text, inet, text) is
  'Validates a client link, records the view and returns the document it opens.';

-- Withdraws a link immediately, for example when an invoice was sent to the
-- wrong address.
create or replace function public.revoke_document_link(
  p_link_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from public.document_links where id = p_link_id;

  if v_company_id is null then
    return false;
  end if;

  if not public.can_write_company_data(v_company_id) then
    raise exception 'You are not allowed to revoke links in this company'
      using errcode = '42501';
  end if;

  update public.document_links
     set status = 'revoked',
         revoked_at = now(),
         revoked_by = public.current_user_id(),
         revoke_reason = p_reason,
         updated_at = now()
   where id = p_link_id
     and status <> 'revoked';

  insert into public.document_events (company_id, document_kind, document_id, event_type, detail)
  select company_id, document_kind, document_id, 'link_revoked',
         jsonb_strip_nulls(jsonb_build_object('reason', p_reason))
    from public.document_links
   where id = p_link_id;

  return true;
end;
$$;

comment on function public.revoke_document_link(uuid, text) is
  'Revokes a client link so the document can no longer be opened with it.';

-- Marks every link that has passed its expiry date, run by the nightly job.
create or replace function public.expire_stale_document_links()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.document_links
     set status = 'expired', updated_at = now()
   where status = 'active'
     and expires_at is not null
     and expires_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.expire_stale_document_links() is
  'Marks every client link whose expiry date has passed as expired.';

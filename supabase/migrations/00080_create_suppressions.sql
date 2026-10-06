-- supabase/migrations/00080_create_suppressions.sql
-- Addresses the platform must stop writing to.
--
-- A hard bounce or a complaint is permanent: sending again damages the
-- deliverability of every tenant on the shared domain. Suppression is global
-- by default and may be narrowed to one tenant when a business has its own
-- relationship with the recipient.

create table public.email_suppressions (
  id uuid primary key default public.generate_uuid_v7(),

  -- Null means the address is suppressed everywhere on the platform.
  company_id uuid,
  email citext not null,

  reason text not null,
  source text not null default 'provider_callback',
  detail text,

  -- A soft failure may be lifted; a complaint never is.
  is_permanent boolean not null default true,
  expires_at timestamptz,
  released_at timestamptz,
  released_by uuid,

  last_event_at timestamptz not null default now(),
  event_count integer not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint email_suppressions_email_check
    check (public.is_valid_email(email::text)),
  constraint email_suppressions_reason_check
    check (reason in ('hard_bounce', 'soft_bounce', 'spam_complaint',
                      'unsubscribed', 'invalid_address', 'manual_block')),
  constraint email_suppressions_source_check
    check (source in ('provider_callback', 'recipient_request', 'staff_action',
                      'validation')),
  constraint email_suppressions_permanent_check
    check (not is_permanent or expires_at is null),
  constraint email_suppressions_count_check
    check (event_count > 0)
);

comment on table public.email_suppressions is
  'Addresses that must not be written to again, and why.';

create unique index email_suppressions_unique
  on public.email_suppressions (
    email,
    coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where released_at is null;

create index email_suppressions_company_idx
  on public.email_suppressions (company_id, last_event_at desc);

-- -----------------------------------------------------------------------------
-- Unsubscribe links
-- -----------------------------------------------------------------------------

-- Marketing and reminder mail carries a one click unsubscribe. The token is
-- stored as a hash, exactly like a document link.
create table public.unsubscribe_tokens (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,

  token_hash text not null,
  email citext not null,
  client_id uuid,
  scope text not null default 'marketing',

  used_at timestamptz,
  used_ip inet,
  expires_at timestamptz,

  created_at timestamptz not null default now(),

  constraint unsubscribe_tokens_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint unsubscribe_tokens_email_check
    check (public.is_valid_email(email::text)),
  constraint unsubscribe_tokens_scope_check
    check (scope in ('marketing', 'reminders', 'all'))
);

comment on table public.unsubscribe_tokens is
  'One click unsubscribe links, stored as a hash of the emailed token.';

create unique index unsubscribe_tokens_hash_unique
  on public.unsubscribe_tokens (token_hash);

create index unsubscribe_tokens_email_idx
  on public.unsubscribe_tokens (email, created_at desc);

-- -----------------------------------------------------------------------------
-- Checks
-- -----------------------------------------------------------------------------

-- Reports whether an address may still be written to.
create or replace function public.is_email_suppressed(
  p_email text,
  p_company_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_exists boolean;
begin
  if p_email is null then
    return true;
  end if;

  select exists (
    select 1
      from public.email_suppressions
     where email = public.normalize_email(p_email)::citext
       and released_at is null
       and (expires_at is null or expires_at > now())
       and (company_id is null or company_id = p_company_id)
  )
  into v_exists;

  return coalesce(v_exists, false);
end;
$$;

comment on function public.is_email_suppressed(text, uuid) is
  'Returns true when an address is on the global or tenant suppression list.';

-- Adds or refreshes a suppression entry.
create or replace function public.suppress_email(
  p_email text,
  p_reason text,
  p_company_id uuid default null,
  p_source text default 'provider_callback',
  p_detail text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
  v_permanent boolean := p_reason in ('hard_bounce', 'spam_complaint',
                                      'invalid_address', 'manual_block',
                                      'unsubscribed');
begin
  insert into public.email_suppressions (
    company_id, email, reason, source, detail, is_permanent, expires_at
  )
  values (
    p_company_id,
    public.normalize_email(p_email)::citext,
    p_reason,
    p_source,
    p_detail,
    v_permanent,
    case when v_permanent then null else now() + interval '7 days' end
  )
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    update public.email_suppressions
       set event_count = event_count + 1,
           last_event_at = now(),
           reason = case when v_permanent then p_reason else reason end,
           is_permanent = is_permanent or v_permanent,
           expires_at = case when is_permanent or v_permanent then null else expires_at end,
           detail = coalesce(p_detail, detail),
           updated_at = now()
     where email = public.normalize_email(p_email)::citext
       and released_at is null
       and coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = coalesce(p_company_id, '00000000-0000-0000-0000-000000000000'::uuid)
     returning id into v_id;
  end if;

  return v_id;
end;
$$;

comment on function public.suppress_email(text, text, uuid, text, text) is
  'Records that an address must not be written to again, or refreshes it.';

-- Lifts a suppression, which only a human decision should ever do.
create or replace function public.release_email_suppression(
  p_suppression_id uuid,
  p_note text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.email_suppressions%rowtype;
begin
  select * into v_row
    from public.email_suppressions
   where id = p_suppression_id and released_at is null;

  if not found then
    return false;
  end if;

  if not (public.is_super_admin() or public.is_company_owner(v_row.company_id)) then
    raise exception 'Only the account owner can lift a suppression'
      using errcode = '42501';
  end if;

  if v_row.reason = 'spam_complaint' and not public.is_super_admin() then
    raise exception 'A spam complaint can only be lifted by the platform team'
      using errcode = '42501';
  end if;

  update public.email_suppressions
     set released_at = now(),
         released_by = public.current_user_id(),
         detail = coalesce(p_note, detail),
         updated_at = now()
   where id = p_suppression_id;

  return true;
end;
$$;

comment on function public.release_email_suppression(uuid, text) is
  'Lifts a suppression after a human has confirmed the address is good.';

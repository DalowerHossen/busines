-- supabase/migrations/00126_create_api_keys.sql
-- Keys for the public API.
--
-- A key is only ever stored as a digest, exactly like a password. What is
-- kept in clear is the short prefix, so a person can recognise the key in a
-- list and revoke the right one. Scopes are explicit: a key can do what it
-- was issued to do and nothing else.

create table public.api_keys (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  name text not null,
  description text,
  -- The visible part, for example kds_live_7f3a. Never enough to use.
  key_prefix text not null,
  key_hash text not null,
  status public.api_key_status not null default 'active',

  environment text not null default 'live',
  scopes text[] not null default array['invoices:read'],
  -- Optional hard restriction, checked before anything else.
  allowed_ip_ranges inet[],
  allowed_origins text[],

  -- Per key throttling. The platform limit still applies on top.
  rate_limit_per_minute integer not null default 120,
  rate_limit_per_day integer not null default 20000,

  last_used_at timestamptz,
  last_used_ip_hash text,
  request_count bigint not null default 0,

  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text,

  -- Rotation: the replaced key keeps working for a short grace window so a
  -- deployment never breaks halfway through.
  rotated_from_key_id uuid,
  grace_expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint api_keys_name_check
    check (length(btrim(name)) between 2 and 80),
  constraint api_keys_prefix_check
    check (key_prefix ~ '^kds_(live|test)_[A-Za-z0-9]{4,12}$'),
  constraint api_keys_hash_check
    check (key_hash ~ '^[0-9a-f]{64}$'),
  constraint api_keys_environment_check
    check (environment in ('live', 'test')),
  constraint api_keys_scopes_check
    check (array_length(scopes, 1) between 1 and 40),
  constraint api_keys_rate_check
    check (rate_limit_per_minute between 1 and 10000
           and rate_limit_per_day between 1 and 10000000),
  constraint api_keys_revoked_check
    check (status <> 'revoked' or revoked_at is not null),
  constraint api_keys_ip_hash_check
    check (last_used_ip_hash is null or last_used_ip_hash ~ '^[0-9a-f]{64}$')
);

comment on table public.api_keys is
  'Keys issued to a tenant for the public API, stored only as digests.';

comment on column public.api_keys.grace_expires_at is
  'While this is in the future a rotated key still authenticates, so a rotation never drops traffic.';

create unique index api_keys_hash_unique
  on public.api_keys (key_hash);

create index api_keys_company_idx
  on public.api_keys (company_id, status)
  where deleted_at is null;

create index api_keys_prefix_idx
  on public.api_keys (key_prefix)
  where deleted_at is null;

create index api_keys_expiring_idx
  on public.api_keys (expires_at)
  where expires_at is not null and status = 'active';

-- -----------------------------------------------------------------------------
-- Using a key
-- -----------------------------------------------------------------------------

-- Resolves a presented key to the tenant it belongs to, or nothing. Returning
-- nothing is deliberate: the caller should never learn why a key failed.
create or replace function public.authenticate_api_key(p_key_hash text)
returns table (
  api_key_id uuid,
  company_id uuid,
  scopes text[],
  environment text,
  rate_limit_per_minute integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select k.id, k.company_id, k.scopes, k.environment, k.rate_limit_per_minute
    from public.api_keys as k
   where k.key_hash = p_key_hash
     and k.deleted_at is null
     and k.status = 'active'
     and (k.expires_at is null or k.expires_at > now())
     and (k.grace_expires_at is null or k.grace_expires_at > now())
   limit 1;
$$;

comment on function public.authenticate_api_key(text) is
  'Resolves a presented API key digest to the tenant and scopes behind it.';

-- Does this key carry this permission? Scopes support a module wildcard so
-- that invoices:* covers invoices:read and invoices:write.
create or replace function public.api_key_has_scope(
  p_api_key_id uuid,
  p_scope text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.api_keys as k
     where k.id = p_api_key_id
       and k.deleted_at is null
       and k.status = 'active'
       and (
         p_scope = any (k.scopes)
         or '*' = any (k.scopes)
         or (split_part(p_scope, ':', 1) || ':*') = any (k.scopes)
       )
  );
$$;

comment on function public.api_key_has_scope(uuid, text) is
  'Returns true when a key carries the permission a request needs.';

-- Records that a key was used, which is what makes the last used column and
-- the usage report honest.
create or replace function public.touch_api_key(
  p_api_key_id uuid,
  p_ip_hash text default null
)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.api_keys
     set last_used_at = now(),
         last_used_ip_hash = coalesce(p_ip_hash, last_used_ip_hash),
         request_count = request_count + 1
   where id = p_api_key_id;
$$;

comment on function public.touch_api_key(uuid, text) is
  'Records the use of an API key against the key itself.';

-- Issues a replacement and leaves the old key working for a short while.
create or replace function public.rotate_api_key(
  p_api_key_id uuid,
  p_new_prefix text,
  p_new_hash text,
  p_grace_minutes integer default 5
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_key public.api_keys%rowtype;
  v_new_id uuid;
begin
  select * into v_key
    from public.api_keys
   where id = p_api_key_id and deleted_at is null for update;

  if not found then
    raise exception 'API key % was not found', p_api_key_id using errcode = 'P0002';
  end if;

  if not (public.is_service_role()
          or public.is_super_admin()
          or public.is_company_owner(v_key.company_id)) then
    raise exception 'Only the account owner can rotate an API key'
      using errcode = '42501';
  end if;

  insert into public.api_keys (
    company_id, name, description, key_prefix, key_hash, environment, scopes,
    allowed_ip_ranges, allowed_origins, rate_limit_per_minute,
    rate_limit_per_day, expires_at, rotated_from_key_id, created_by
  )
  values (
    v_key.company_id, v_key.name, v_key.description, p_new_prefix, p_new_hash,
    v_key.environment, v_key.scopes, v_key.allowed_ip_ranges,
    v_key.allowed_origins, v_key.rate_limit_per_minute, v_key.rate_limit_per_day,
    v_key.expires_at, p_api_key_id, public.current_user_id()
  )
  returning id into v_new_id;

  update public.api_keys
     set grace_expires_at = now()
                            + make_interval(mins => greatest(coalesce(p_grace_minutes, 5), 1)),
         updated_at = now()
   where id = p_api_key_id;

  return v_new_id;
end;
$$;

comment on function public.rotate_api_key(uuid, text, text, integer) is
  'Issues a replacement key and keeps the old one alive for a grace window.';

-- Stops a key immediately.
create or replace function public.revoke_api_key(
  p_api_key_id uuid,
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
  select company_id into v_company_id
    from public.api_keys
   where id = p_api_key_id and deleted_at is null;

  if v_company_id is null then
    return false;
  end if;

  if not (public.is_service_role()
          or public.is_super_admin()
          or public.is_company_owner(v_company_id)) then
    raise exception 'Only the account owner can revoke an API key'
      using errcode = '42501';
  end if;

  update public.api_keys
     set status = 'revoked',
         revoked_at = now(),
         revoked_by = public.current_user_id(),
         revoke_reason = coalesce(p_reason, 'Revoked by the account owner'),
         grace_expires_at = null,
         updated_at = now()
   where id = p_api_key_id;

  return true;
end;
$$;

comment on function public.revoke_api_key(uuid, text) is
  'Stops an API key from authenticating anything further.';

-- Closes keys that have reached their expiry date.
create or replace function public.expire_stale_api_keys()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.api_keys
     set status = 'expired', updated_at = now()
   where status = 'active'
     and expires_at is not null
     and expires_at <= now();

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

comment on function public.expire_stale_api_keys() is
  'Expires API keys that have passed the date they were issued until.';

-- supabase/migrations/00005_create_utility_functions.sql
-- General purpose database utilities used across every module.

-- -----------------------------------------------------------------------------
-- Identifier generation
-- -----------------------------------------------------------------------------

-- Generates a time ordered UUID version 7 value.
-- Time ordering keeps primary key indexes compact and sequential, which matters
-- on large multi tenant tables.
create or replace function public.generate_uuid_v7()
returns uuid
language plpgsql
volatile
set search_path = public, extensions, pg_temp
as $$
declare
  v_unix_ms bigint;
  v_bytes bytea;
begin
  v_unix_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;

  -- Six bytes of millisecond timestamp followed by ten random bytes.
  v_bytes := substring(int8send(v_unix_ms) from 3 for 6) || extensions.gen_random_bytes(10);

  -- Byte 6 holds the version nibble, which must be 7.
  v_bytes := set_byte(v_bytes, 6, (get_byte(v_bytes, 6) & 15) | 112);

  -- Byte 8 holds the variant bits, which must be 10xxxxxx.
  v_bytes := set_byte(v_bytes, 8, (get_byte(v_bytes, 8) & 63) | 128);

  return encode(v_bytes, 'hex')::uuid;
end;
$$;

comment on function public.generate_uuid_v7() is
  'Returns a time ordered UUID version 7 value for use as a primary key.';

-- Generates a cryptographically secure, URL safe random token.
create or replace function public.generate_secure_token(p_byte_length integer default 32)
returns text
language plpgsql
volatile
set search_path = public, extensions, pg_temp
as $$
declare
  v_token text;
begin
  if p_byte_length < 16 or p_byte_length > 128 then
    raise exception 'Token length must be between 16 and 128 bytes, received %', p_byte_length
      using errcode = '22023';
  end if;

  v_token := encode(extensions.gen_random_bytes(p_byte_length), 'base64');
  v_token := translate(v_token, '+/', '-_');
  v_token := replace(v_token, '=', '');

  return v_token;
end;
$$;

comment on function public.generate_secure_token(integer) is
  'Returns a URL safe random token used for client document links and secrets.';

-- -----------------------------------------------------------------------------
-- Text helpers
-- -----------------------------------------------------------------------------

-- Converts arbitrary text into a URL safe slug.
create or replace function public.slugify(p_value text)
returns text
language plpgsql
immutable
set search_path = public, extensions, pg_temp
as $$
declare
  v_slug text;
begin
  if p_value is null then
    return null;
  end if;

  v_slug := lower(extensions.unaccent(p_value));
  v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
  v_slug := regexp_replace(v_slug, '^-+|-+$', '', 'g');

  if v_slug = '' then
    return null;
  end if;

  return left(v_slug, 120);
end;
$$;

comment on function public.slugify(text) is
  'Converts text into a lowercase, accent free, hyphen separated slug.';

-- Normalises an email address for storage and comparison.
create or replace function public.normalize_email(p_email text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select nullif(lower(btrim(p_email)), '');
$$;

comment on function public.normalize_email(text) is
  'Trims and lowercases an email address, returning null for empty input.';

-- Validates the shape of an email address.
create or replace function public.is_valid_email(p_email text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select p_email is not null
     and p_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
     and length(p_email) <= 254;
$$;

comment on function public.is_valid_email(text) is
  'Returns true when the supplied value is a syntactically valid email address.';

-- Masks a secret for display, keeping only the last four characters.
create or replace function public.mask_secret(p_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_value is null or length(p_value) = 0 then null
    when length(p_value) <= 4 then repeat('*', length(p_value))
    else repeat('*', 8) || right(p_value, 4)
  end;
$$;

comment on function public.mask_secret(text) is
  'Returns a masked representation of a secret for safe display in the interface.';

-- -----------------------------------------------------------------------------
-- Time helpers
-- -----------------------------------------------------------------------------

-- Returns the current timestamp in a specific IANA time zone.
create or replace function public.now_in_timezone(p_time_zone text)
returns timestamptz
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  if p_time_zone is null or p_time_zone = '' then
    return now();
  end if;

  perform now() at time zone p_time_zone;
  return now();
exception
  when invalid_parameter_value or undefined_object then
    raise exception 'Unknown time zone %', p_time_zone using errcode = '22023';
end;
$$;

comment on function public.now_in_timezone(text) is
  'Validates the supplied IANA time zone and returns the current timestamp.';

-- Adds a number of business days to a date, skipping Saturday and Sunday.
create or replace function public.add_business_days(p_start date, p_days integer)
returns date
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_result date := p_start;
  v_added integer := 0;
begin
  if p_start is null then
    return null;
  end if;

  if p_days is null or p_days <= 0 then
    return p_start;
  end if;

  while v_added < p_days loop
    v_result := v_result + 1;
    if extract(isodow from v_result) < 6 then
      v_added := v_added + 1;
    end if;
  end loop;

  return v_result;
end;
$$;

comment on function public.add_business_days(date, integer) is
  'Adds business days to a date, skipping weekends.';

-- Returns the last day of the month that contains the supplied date.
create or replace function public.end_of_month(p_date date)
returns date
language sql
immutable
set search_path = public, pg_temp
as $$
  select (date_trunc('month', p_date) + interval '1 month - 1 day')::date;
$$;

comment on function public.end_of_month(date) is
  'Returns the final calendar day of the month containing the supplied date.';

-- Advances a date by one recurrence period, clamping to the end of the month so
-- that a cycle anchored on the 31st still produces a valid date every month.
create or replace function public.add_recurrence(
  p_date date,
  p_frequency public.recurrence_frequency,
  p_interval integer default 1,
  p_anchor_day integer default null
)
returns date
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_interval integer := greatest(coalesce(p_interval, 1), 1);
  v_months integer;
  v_candidate date;
  v_anchor integer;
  v_last_day integer;
begin
  if p_date is null then
    return null;
  end if;

  case p_frequency
    when 'daily' then
      return p_date + v_interval;
    when 'weekly' then
      return p_date + (7 * v_interval);
    when 'biweekly' then
      return p_date + (14 * v_interval);
    when 'monthly' then
      v_months := 1 * v_interval;
    when 'quarterly' then
      v_months := 3 * v_interval;
    when 'semiannual' then
      v_months := 6 * v_interval;
    when 'annual' then
      v_months := 12 * v_interval;
    when 'custom' then
      return p_date + v_interval;
    else
      raise exception 'Unsupported recurrence frequency %', p_frequency using errcode = '22023';
  end case;

  v_candidate := (date_trunc('month', p_date) + make_interval(months => v_months))::date;
  v_anchor := coalesce(p_anchor_day, extract(day from p_date)::integer);
  v_last_day := extract(day from public.end_of_month(v_candidate))::integer;

  return v_candidate + (least(v_anchor, v_last_day) - 1);
end;
$$;

comment on function public.add_recurrence(date, public.recurrence_frequency, integer, integer) is
  'Advances a date by one recurrence period, clamping to the end of short months.';

-- supabase/migrations/00006_create_money_functions.sql
-- Decimal safe money helpers.
-- Every monetary column uses numeric(18, 4). Rounding to the presentation scale
-- happens through these functions so that the application, the database and the
-- generated documents always agree on the final figure.

-- Rounds a monetary value using an explicit rounding mode.
create or replace function public.round_money(
  p_value numeric,
  p_scale integer default 2,
  p_mode public.rounding_mode default 'half_up'
)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_scale integer := coalesce(p_scale, 2);
  v_factor numeric;
  v_shifted numeric;
  v_floor numeric;
  v_fraction numeric;
begin
  if p_value is null then
    return null;
  end if;

  if v_scale < 0 or v_scale > 6 then
    raise exception 'Rounding scale must be between 0 and 6, received %', v_scale
      using errcode = '22023';
  end if;

  v_factor := power(10::numeric, v_scale);
  v_shifted := p_value * v_factor;

  case p_mode
    when 'half_up' then
      return round(p_value, v_scale);
    when 'half_down' then
      v_floor := trunc(v_shifted);
      v_fraction := abs(v_shifted - v_floor);
      if v_fraction > 0.5 then
        return round((v_floor + sign(v_shifted)) / v_factor, v_scale);
      end if;
      return round(v_floor / v_factor, v_scale);
    when 'half_even' then
      v_floor := trunc(v_shifted);
      v_fraction := abs(v_shifted - v_floor);
      if v_fraction > 0.5 then
        return round((v_floor + sign(v_shifted)) / v_factor, v_scale);
      elsif v_fraction < 0.5 then
        return round(v_floor / v_factor, v_scale);
      elsif (v_floor::bigint % 2) = 0 then
        return round(v_floor / v_factor, v_scale);
      else
        return round((v_floor + sign(v_shifted)) / v_factor, v_scale);
      end if;
    when 'ceiling' then
      return round(ceil(v_shifted) / v_factor, v_scale);
    when 'floor' then
      return round(floor(v_shifted) / v_factor, v_scale);
    else
      raise exception 'Unsupported rounding mode %', p_mode using errcode = '22023';
  end case;
end;
$$;

comment on function public.round_money(numeric, integer, public.rounding_mode) is
  'Rounds a monetary value to the requested scale using an explicit rounding mode.';

-- Converts a decimal amount into the minor units expected by payment gateways.
-- Zero decimal currencies such as JPY use an exponent of 0.
create or replace function public.to_minor_units(p_amount numeric, p_exponent integer default 2)
returns bigint
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_exponent integer := coalesce(p_exponent, 2);
begin
  if p_amount is null then
    return null;
  end if;

  if v_exponent < 0 or v_exponent > 4 then
    raise exception 'Currency exponent must be between 0 and 4, received %', v_exponent
      using errcode = '22023';
  end if;

  return round(p_amount * power(10::numeric, v_exponent))::bigint;
end;
$$;

comment on function public.to_minor_units(numeric, integer) is
  'Converts a decimal amount into integer minor units for gateway requests.';

-- Converts gateway minor units back into a decimal amount.
create or replace function public.from_minor_units(p_amount bigint, p_exponent integer default 2)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_exponent integer := coalesce(p_exponent, 2);
begin
  if p_amount is null then
    return null;
  end if;

  if v_exponent < 0 or v_exponent > 4 then
    raise exception 'Currency exponent must be between 0 and 4, received %', v_exponent
      using errcode = '22023';
  end if;

  return round(p_amount::numeric / power(10::numeric, v_exponent), v_exponent);
end;
$$;

comment on function public.from_minor_units(bigint, integer) is
  'Converts integer minor units received from a gateway into a decimal amount.';

-- Calculates the tax portion of a line amount for both tax modes.
create or replace function public.calculate_tax_amount(
  p_base_amount numeric,
  p_tax_rate numeric,
  p_tax_mode public.tax_mode default 'exclusive',
  p_scale integer default 2,
  p_rounding public.rounding_mode default 'half_up'
)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_rate numeric := coalesce(p_tax_rate, 0);
  v_base numeric := coalesce(p_base_amount, 0);
begin
  if v_rate < 0 or v_rate > 100 then
    raise exception 'Tax rate must be between 0 and 100, received %', v_rate
      using errcode = '22023';
  end if;

  if p_tax_mode = 'none' or v_rate = 0 then
    return 0;
  end if;

  if p_tax_mode = 'inclusive' then
    return public.round_money(v_base - (v_base / (1 + (v_rate / 100))), p_scale, p_rounding);
  end if;

  return public.round_money(v_base * (v_rate / 100), p_scale, p_rounding);
end;
$$;

comment on function public.calculate_tax_amount(
  numeric, numeric, public.tax_mode, integer, public.rounding_mode
) is 'Calculates tax for inclusive or exclusive pricing with explicit rounding.';

-- Calculates a discount amount from either a percentage or a fixed value.
create or replace function public.calculate_discount_amount(
  p_base_amount numeric,
  p_discount_value numeric,
  p_discount_type public.discount_type default 'percentage',
  p_scale integer default 2,
  p_rounding public.rounding_mode default 'half_up'
)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_base numeric := coalesce(p_base_amount, 0);
  v_value numeric := coalesce(p_discount_value, 0);
  v_amount numeric;
begin
  if v_value < 0 then
    raise exception 'Discount value cannot be negative, received %', v_value
      using errcode = '22023';
  end if;

  if p_discount_type = 'percentage' then
    if v_value > 100 then
      raise exception 'Percentage discount cannot exceed 100, received %', v_value
        using errcode = '22023';
    end if;
    v_amount := v_base * (v_value / 100);
  else
    v_amount := v_value;
  end if;

  return public.round_money(least(v_amount, v_base), p_scale, p_rounding);
end;
$$;

comment on function public.calculate_discount_amount(
  numeric, numeric, public.discount_type, integer, public.rounding_mode
) is 'Calculates a discount amount, never allowing it to exceed the base amount.';

-- Converts an amount between currencies using an explicit exchange rate.
create or replace function public.convert_currency(
  p_amount numeric,
  p_exchange_rate numeric,
  p_scale integer default 2,
  p_rounding public.rounding_mode default 'half_up'
)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_amount is null then
    return null;
  end if;

  if p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'Exchange rate must be greater than zero, received %', p_exchange_rate
      using errcode = '22023';
  end if;

  return public.round_money(p_amount * p_exchange_rate, p_scale, p_rounding);
end;
$$;

comment on function public.convert_currency(numeric, numeric, integer, public.rounding_mode) is
  'Converts an amount using a stored exchange rate and rounds the result.';

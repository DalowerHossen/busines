-- supabase/migrations/00143_exchange_rates.sql
-- Platform exchange-rate snapshots used by later multi-currency calculation
-- code. Rates are immutable snapshots per provider and effective timestamp.

create table public.exchange_rates (
  id uuid primary key default extensions.gen_random_uuid(),
  base_currency_code text not null,
  quote_currency_code text not null,
  rate numeric(24, 12) not null,
  source text not null,
  effective_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint exchange_rates_base_not_blank check (length(btrim(base_currency_code)) > 0),
  constraint exchange_rates_quote_not_blank check (length(btrim(quote_currency_code)) > 0),
  constraint exchange_rates_currencies_distinct check (base_currency_code <> quote_currency_code),
  constraint exchange_rates_rate_positive check (rate > 0),
  constraint exchange_rates_source_not_blank check (length(btrim(source)) > 0)
);

create unique index exchange_rates_pair_source_time_key
  on public.exchange_rates (base_currency_code, quote_currency_code, source, effective_at);
create index exchange_rates_pair_time_idx
  on public.exchange_rates (base_currency_code, quote_currency_code, effective_at desc);

comment on table public.exchange_rates is
  'An immutable currency exchange-rate snapshot from a named provider.';

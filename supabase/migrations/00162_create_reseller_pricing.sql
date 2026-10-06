-- supabase/migrations/00162_create_reseller_pricing.sql
-- What a white label partner charges, and what the platform charges them.
--
-- A reseller buys the platform at a wholesale price and sells it at whatever
-- price they choose. Both numbers live here, so a statement can always be
-- explained line by line: this is what the tenant paid, this is what the
-- platform kept, this is what the partner earned.

create table public.reseller_price_books (
  id uuid primary key default public.generate_uuid_v7(),
  reseller_id uuid not null,

  name text not null,
  currency char(3) not null default 'USD',
  is_default boolean not null default false,
  is_active boolean not null default true,

  -- What the partner tells their customers the platform is called.
  public_plan_prefix text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint reseller_price_books_name_check
    check (length(btrim(name)) between 2 and 80),
  constraint reseller_price_books_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint reseller_price_books_prefix_check
    check (public_plan_prefix is null
           or length(btrim(public_plan_prefix)) between 1 and 30)
);

comment on table public.reseller_price_books is
  'One set of prices a white label partner sells the platform at.';

create index reseller_price_books_reseller_idx
  on public.reseller_price_books (reseller_id)
  where deleted_at is null;

create unique index reseller_price_books_single_default
  on public.reseller_price_books (reseller_id)
  where is_default and deleted_at is null;

-- The price of one plan in one book, with the wholesale cost beside it.
create table public.reseller_plan_prices (
  id uuid primary key default public.generate_uuid_v7(),
  price_book_id uuid not null,
  reseller_id uuid not null,
  plan_id uuid not null,

  billing_interval public.billing_interval not null default 'monthly',
  -- What the partner's customer pays.
  retail_amount numeric(18, 4) not null,
  -- What the partner pays the platform for it.
  wholesale_amount numeric(18, 4) not null,
  currency char(3) not null default 'USD',

  -- Shown struck through on the partner's own pricing page.
  compare_at_amount numeric(18, 4),
  public_name text,
  public_description text,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint reseller_plan_prices_retail_check
    check (retail_amount >= 0),
  constraint reseller_plan_prices_wholesale_check
    check (wholesale_amount >= 0),
  -- Selling below cost is almost always a typing mistake, so it is refused.
  constraint reseller_plan_prices_margin_check
    check (retail_amount >= wholesale_amount),
  constraint reseller_plan_prices_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint reseller_plan_prices_compare_check
    check (compare_at_amount is null or compare_at_amount >= retail_amount),
  constraint reseller_plan_prices_public_name_check
    check (public_name is null or length(btrim(public_name)) between 2 and 60)
);

comment on table public.reseller_plan_prices is
  'The retail and wholesale price of one plan for one white label partner.';

create unique index reseller_plan_prices_unique
  on public.reseller_plan_prices (price_book_id, plan_id, billing_interval)
  where deleted_at is null;

create index reseller_plan_prices_reseller_idx
  on public.reseller_plan_prices (reseller_id, plan_id)
  where is_active and deleted_at is null;

-- The margin on one line, which is the number the partner actually cares about.
create or replace function public.reseller_price_margin(
  p_reseller_plan_price_id uuid
)
returns table (
  retail_amount numeric,
  wholesale_amount numeric,
  margin_amount numeric,
  margin_percentage numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.retail_amount,
         p.wholesale_amount,
         p.retail_amount - p.wholesale_amount,
         case
           when p.retail_amount > 0
           then round(
             (p.retail_amount - p.wholesale_amount) * 100.0 / p.retail_amount, 2
           )
           else 0
         end
    from public.reseller_plan_prices as p
   where p.id = p_reseller_plan_price_id;
$$;

comment on function public.reseller_price_margin(uuid) is
  'Returns the retail price, the cost and the margin of one partner price.';

-- What a tenant created by a partner is charged for a plan. Falls back to
-- the platform price when the partner has not set one.
create or replace function public.effective_plan_price(
  p_company_id uuid,
  p_plan_id uuid,
  p_billing_interval public.billing_interval default 'monthly'
)
returns table (
  source text,
  amount numeric,
  currency char(3)
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_reseller_id uuid;
  v_row record;
begin
  select reseller_id into v_reseller_id
    from public.companies
   where id = p_company_id;

  if v_reseller_id is not null then
    select rp.retail_amount, rp.currency
      into v_row
      from public.reseller_plan_prices as rp
      join public.reseller_price_books as b on b.id = rp.price_book_id
     where rp.reseller_id = v_reseller_id
       and rp.plan_id = p_plan_id
       and rp.billing_interval = p_billing_interval
       and rp.is_active
       and rp.deleted_at is null
       and b.is_active
       and b.deleted_at is null
     order by b.is_default desc
     limit 1;

    if found then
      return query select 'reseller'::text, v_row.retail_amount, v_row.currency;
      return;
    end if;
  end if;

  return query
  select 'platform'::text, pp.amount, pp.currency
    from public.plan_prices as pp
   where pp.plan_id = p_plan_id
     and pp.billing_interval = p_billing_interval
     and pp.is_active
     and pp.deleted_at is null
   limit 1;
end;
$$;

comment on function public.effective_plan_price(uuid, uuid, public.billing_interval) is
  'Returns what a tenant pays for a plan, at partner prices where they apply.';

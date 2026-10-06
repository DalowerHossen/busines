-- supabase/migrations/00167_create_marketplace_functions.sql
-- Publishing, buying and installing marketplace listings.

-- Does the caller speak for this vendor?
create or replace function public.is_marketplace_vendor(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.marketplace_vendors as v
     where v.id = p_vendor_id
       and v.deleted_at is null
       and (
         (v.company_id is not null
          and public.is_company_owner(v.company_id))
         or (v.reseller_id is not null
             and public.is_reseller_owner(v.reseller_id))
       )
  );
$$;

comment on function public.is_marketplace_vendor(uuid) is
  'Returns whether the caller may act for this marketplace vendor.';

-- Sends a draft listing to review. Nothing reaches the catalogue unread.
create or replace function public.submit_listing_for_review(p_listing_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_listing public.marketplace_listings%rowtype;
  v_vendor public.marketplace_vendors%rowtype;
begin
  select * into v_listing
    from public.marketplace_listings
   where id = p_listing_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That listing does not exist' using errcode = 'P0002';
  end if;

  if not coalesce(
      public.is_service_role()
      or public.is_super_admin()
      or public.is_marketplace_vendor(v_listing.vendor_id),
      false
    ) then
    raise exception 'That listing belongs to another vendor'
      using errcode = '42501';
  end if;

  select * into v_vendor
    from public.marketplace_vendors
   where id = v_listing.vendor_id;

  if v_vendor.status <> 'approved' then
    raise exception 'A vendor has to be approved before they can sell'
      using errcode = '22023';
  end if;

  if v_listing.status not in ('draft', 'rejected', 'unpublished') then
    raise exception 'Only a draft listing can be sent for review'
      using errcode = '22023';
  end if;

  if v_listing.artifact_payload = '{}'::jsonb then
    raise exception 'A listing has to contain something before it is reviewed'
      using errcode = '22023';
  end if;

  update public.marketplace_listings
     set status = 'in_review',
         submitted_at = now(),
         review_notes = null,
         updated_at = now()
   where id = p_listing_id;

  return true;
end;
$$;

comment on function public.submit_listing_for_review(uuid) is
  'Sends a vendor listing to platform review.';

-- Approves a listing and freezes the version buyers will receive.
create or replace function public.publish_listing(
  p_listing_id uuid,
  p_changelog text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_listing public.marketplace_listings%rowtype;
  v_version_id uuid;
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Only the platform can publish a listing'
      using errcode = '42501';
  end if;

  select * into v_listing
    from public.marketplace_listings
   where id = p_listing_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That listing does not exist' using errcode = 'P0002';
  end if;

  if v_listing.status <> 'in_review' then
    raise exception 'Only a listing under review can be published'
      using errcode = '22023';
  end if;

  update public.marketplace_listing_versions
     set is_current = false
   where listing_id = p_listing_id and is_current;

  insert into public.marketplace_listing_versions (
    listing_id, version, changelog, artifact_payload, is_current,
    published_by
  )
  values (
    p_listing_id, v_listing.version, p_changelog, v_listing.artifact_payload,
    true, public.current_user_id()
  )
  on conflict (listing_id, version) do update
    set artifact_payload = excluded.artifact_payload,
        changelog = excluded.changelog,
        is_current = true,
        published_at = now()
  returning id into v_version_id;

  update public.marketplace_listings
     set status = 'published',
         published_at = coalesce(published_at, now()),
         unpublished_at = null,
         reviewed_at = now(),
         reviewed_by = public.current_user_id(),
         updated_at = now()
   where id = p_listing_id;

  update public.marketplace_vendors
     set listing_count = (
           select count(*)
             from public.marketplace_listings
            where vendor_id = v_listing.vendor_id
              and status = 'published'
              and deleted_at is null
         ),
         updated_at = now()
   where id = v_listing.vendor_id;

  return v_version_id;
end;
$$;

comment on function public.publish_listing(uuid, text) is
  'Approves a reviewed listing and freezes the version buyers receive.';

-- Turns a listing down with a reason the vendor can act on.
create or replace function public.reject_listing(
  p_listing_id uuid,
  p_reason text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Only the platform can reject a listing'
      using errcode = '42501';
  end if;

  if p_reason is null or length(btrim(p_reason)) < 10 then
    raise exception 'A rejection has to say what is wrong'
      using errcode = '22023';
  end if;

  update public.marketplace_listings
     set status = 'rejected',
         review_notes = p_reason,
         reviewed_at = now(),
         reviewed_by = public.current_user_id(),
         updated_at = now()
   where id = p_listing_id
     and status = 'in_review';

  return found;
end;
$$;

comment on function public.reject_listing(uuid, text) is
  'Turns a reviewed listing down with a reason.';

-- Buys a listing for a tenant and splits the money with the vendor.
create or replace function public.purchase_listing(
  p_company_id uuid,
  p_listing_id uuid,
  p_payment_reference text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_listing public.marketplace_listings%rowtype;
  v_vendor public.marketplace_vendors%rowtype;
  v_order_id uuid;
  v_reference text;
  v_next integer;
  v_vendor_amount numeric;
  v_fee numeric;
  v_available date;
begin
  if not coalesce(public.is_service_role() or public.is_company_owner(p_company_id), false) then
    raise exception 'Only the account owner can buy from the marketplace'
      using errcode = '42501';
  end if;

  select * into v_listing
    from public.marketplace_listings
   where id = p_listing_id and deleted_at is null;

  if not found or v_listing.status <> 'published' then
    raise exception 'That listing is not on sale' using errcode = '22023';
  end if;

  select * into v_vendor
    from public.marketplace_vendors
   where id = v_listing.vendor_id;

  if v_vendor.company_id = p_company_id then
    raise exception 'A vendor does not buy their own listing'
      using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.marketplace_installs
     where listing_id = p_listing_id
       and company_id = p_company_id
       and status <> 'uninstalled'
  ) then
    raise exception 'That listing is already installed on this account'
      using errcode = '23505';
  end if;

  v_vendor_amount := round(
    v_listing.price_amount * v_vendor.revenue_share_percentage / 100, 4
  );
  v_fee := v_listing.price_amount - v_vendor_amount;

  select coalesce(
           max(nullif(regexp_replace(order_reference, '^MO-', ''), '')::integer),
           0
         ) + 1
    into v_next
    from public.marketplace_orders
   where order_reference ~ '^MO-[0-9]+$';

  v_reference := 'MO-' || lpad(v_next::text, 4, '0');

  insert into public.marketplace_orders (
    order_reference, listing_id, listing_version, vendor_id, company_id,
    purchased_by, pricing_model, gross_amount, platform_fee_amount,
    vendor_amount, currency, revenue_share_percentage, status, payment_reference,
    paid_at
  )
  values (
    v_reference, p_listing_id, v_listing.version, v_listing.vendor_id,
    p_company_id, public.current_user_id(), v_listing.pricing_model,
    v_listing.price_amount, v_fee, v_vendor_amount, v_listing.price_currency,
    v_vendor.revenue_share_percentage,
    case when v_listing.pricing_model = 'free' then 'paid' else 'pending' end,
    p_payment_reference,
    case when v_listing.pricing_model = 'free' then now() else null end
  )
  returning id into v_order_id;

  if v_listing.pricing_model = 'free' then
    update public.marketplace_listings
       set purchase_count = purchase_count + 1,
           updated_at = now()
     where id = p_listing_id;
  else
    -- Earnings are held for a fortnight so refunds settle first.
    v_available := (now() + interval '14 days')::date;

    insert into public.marketplace_vendor_earnings (
      vendor_id, order_id, amount, currency, available_at
    )
    values (
      v_listing.vendor_id, v_order_id, v_vendor_amount,
      v_listing.price_currency, v_available
    );
  end if;

  return v_order_id;
end;
$$;

comment on function public.purchase_listing(uuid, uuid, text) is
  'Creates a marketplace order and the vendor share that goes with it.';

-- Confirms the payment on an order and releases the vendor share.
create or replace function public.confirm_marketplace_order(
  p_order_id uuid,
  p_payment_reference text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.marketplace_orders%rowtype;
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Only the platform can confirm a marketplace payment'
      using errcode = '42501';
  end if;

  select * into v_order
    from public.marketplace_orders
   where id = p_order_id
     for update;

  if not found or v_order.status <> 'pending' then
    return false;
  end if;

  update public.marketplace_orders
     set status = 'paid',
         paid_at = now(),
         payment_reference = coalesce(p_payment_reference, payment_reference),
         updated_at = now()
   where id = p_order_id;

  update public.marketplace_listings
     set purchase_count = purchase_count + 1,
         updated_at = now()
   where id = v_order.listing_id;

  return true;
end;
$$;

comment on function public.confirm_marketplace_order(uuid, text) is
  'Marks a marketplace order as paid and counts the sale.';

-- Puts a bought listing to work inside the tenant.
create or replace function public.install_listing(
  p_company_id uuid,
  p_listing_id uuid,
  p_configuration jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_listing public.marketplace_listings%rowtype;
  v_order public.marketplace_orders%rowtype;
  v_install_id uuid;
begin
  if not coalesce(public.is_service_role() or public.is_company_owner(p_company_id), false) then
    raise exception 'Only the account owner can install a listing'
      using errcode = '42501';
  end if;

  select * into v_listing
    from public.marketplace_listings
   where id = p_listing_id and deleted_at is null;

  if not found or v_listing.status <> 'published' then
    raise exception 'That listing is not available to install'
      using errcode = '22023';
  end if;

  if v_listing.pricing_model <> 'free' then
    select * into v_order
      from public.marketplace_orders
     where listing_id = p_listing_id
       and company_id = p_company_id
       and status = 'paid'
     order by paid_at desc
     limit 1;

    if not found then
      raise exception 'That listing has to be paid for before it is installed'
        using errcode = '22023';
    end if;
  else
    select * into v_order
      from public.marketplace_orders
     where listing_id = p_listing_id
       and company_id = p_company_id
       and status = 'paid'
     order by paid_at desc
     limit 1;
  end if;

  insert into public.marketplace_installs (
    listing_id, company_id, order_id, installed_version, configuration,
    installed_by
  )
  values (
    p_listing_id, p_company_id, v_order.id, v_listing.version,
    coalesce(p_configuration, '{}'::jsonb), public.current_user_id()
  )
  returning id into v_install_id;

  update public.marketplace_listings
     set install_count = install_count + 1,
         updated_at = now()
   where id = p_listing_id;

  update public.marketplace_vendors
     set install_count = install_count + 1,
         updated_at = now()
   where id = v_listing.vendor_id;

  return v_install_id;
end;
$$;

comment on function public.install_listing(uuid, uuid, jsonb) is
  'Installs a published listing into a tenant that is entitled to it.';

-- Removes an install, leaving the record of what it created behind.
create or replace function public.uninstall_listing(
  p_install_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_install public.marketplace_installs%rowtype;
begin
  select * into v_install
    from public.marketplace_installs
   where id = p_install_id
     for update;

  if not found then
    return false;
  end if;

  if not coalesce(
      public.is_service_role()
      or public.is_company_owner(v_install.company_id),
      false
    ) then
    raise exception 'Only the account owner can remove an install'
      using errcode = '42501';
  end if;

  if v_install.status = 'uninstalled' then
    return false;
  end if;

  update public.marketplace_installs
     set status = 'uninstalled',
         uninstalled_at = now(),
         uninstall_reason = p_reason,
         updated_at = now()
   where id = p_install_id;

  return true;
end;
$$;

comment on function public.uninstall_listing(uuid, text) is
  'Marks a marketplace install as removed from the tenant.';

-- Refunds an order, which also takes back the vendor share.
create or replace function public.refund_marketplace_order(
  p_order_id uuid,
  p_reason text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.marketplace_orders%rowtype;
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Only the platform can refund a marketplace order'
      using errcode = '42501';
  end if;

  select * into v_order
    from public.marketplace_orders
   where id = p_order_id
     for update;

  if not found or v_order.status <> 'paid' then
    return false;
  end if;

  update public.marketplace_orders
     set status = 'refunded',
         refunded_at = now(),
         refund_reason = p_reason,
         updated_at = now()
   where id = p_order_id;

  update public.marketplace_vendor_earnings
     set status = 'reversed',
         reversed_at = now(),
         updated_at = now()
   where order_id = p_order_id
     and status in ('pending', 'available');

  update public.marketplace_installs
     set status = 'uninstalled',
         uninstalled_at = now(),
         uninstall_reason = 'Order refunded',
         updated_at = now()
   where order_id = p_order_id
     and status <> 'uninstalled';

  return true;
end;
$$;

comment on function public.refund_marketplace_order(uuid, text) is
  'Refunds a marketplace order and takes back what it paid out.';

-- A buyer rating, which only an installer may leave.
create or replace function public.review_listing(
  p_company_id uuid,
  p_listing_id uuid,
  p_rating smallint,
  p_title text default null,
  p_body text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_install public.marketplace_installs%rowtype;
  v_review_id uuid;
begin
  if not coalesce(public.is_service_role() or public.is_company_owner(p_company_id), false) then
    raise exception 'Only the account owner can review a listing'
      using errcode = '42501';
  end if;

  select * into v_install
    from public.marketplace_installs
   where listing_id = p_listing_id
     and company_id = p_company_id
   order by installed_at desc
   limit 1;

  if not found then
    raise exception 'Only an account that installed a listing can review it'
      using errcode = '22023';
  end if;

  insert into public.marketplace_reviews (
    listing_id, company_id, rating, title, body, install_id
  )
  values (
    p_listing_id, p_company_id, p_rating, p_title, p_body, v_install.id
  )
  returning id into v_review_id;

  update public.marketplace_listings
     set rating_total = rating_total + p_rating,
         rating_count = rating_count + 1,
         updated_at = now()
   where id = p_listing_id;

  update public.marketplace_vendors as v
     set average_rating = sub.avg_rating,
         updated_at = now()
    from (
      select l.vendor_id,
             round(sum(l.rating_total)::numeric
                   / nullif(sum(l.rating_count), 0), 2) as avg_rating
        from public.marketplace_listings as l
       where l.vendor_id = (
               select vendor_id from public.marketplace_listings
                where id = p_listing_id
             )
       group by l.vendor_id
    ) as sub
   where v.id = sub.vendor_id;

  return v_review_id;
end;
$$;

comment on function public.review_listing(uuid, uuid, smallint, text, text) is
  'Records a buyer rating and refreshes the listing and vendor averages.';

-- What a vendor has earned and what is still being held.
create or replace function public.vendor_earnings_summary(p_vendor_id uuid)
returns table (
  pending_amount numeric,
  available_amount numeric,
  paid_amount numeric,
  reversed_amount numeric,
  currency char(3)
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(
      public.is_service_role()
      or public.is_super_admin()
      or public.is_marketplace_vendor(p_vendor_id),
      false
    ) then
    raise exception 'Those earnings belong to another vendor'
      using errcode = '42501';
  end if;

  return query
  select coalesce(sum(e.amount) filter (where e.status = 'pending'), 0),
         coalesce(sum(e.amount) filter (where e.status = 'available'), 0),
         coalesce(sum(e.amount) filter (where e.status = 'paid'), 0),
         coalesce(sum(e.amount) filter (where e.status = 'reversed'), 0),
         coalesce(min(e.currency), 'USD'::char(3))
    from public.marketplace_vendor_earnings as e
   where e.vendor_id = p_vendor_id;
end;
$$;

comment on function public.vendor_earnings_summary(uuid) is
  'Totals a marketplace vendor pending, available, paid and reversed money.';

-- Releases earnings whose holding period has passed.
create or replace function public.release_vendor_earnings()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Only the platform releases vendor earnings'
      using errcode = '42501';
  end if;

  with released as (
    update public.marketplace_vendor_earnings
       set status = 'available',
           updated_at = now()
     where status = 'pending'
       and available_at is not null
       and available_at <= current_date
    returning 1
  )
  select count(*)::int into v_count from released;

  return v_count;
end;
$$;

comment on function public.release_vendor_earnings() is
  'Moves vendor earnings out of the holding period once it has passed.';

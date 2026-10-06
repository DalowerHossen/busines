-- supabase/migrations/00201_create_marketplace_portal.sql
-- The shopfront, the vendor desk, and two doors that were left open.
--
-- The marketplace already knew how to review, publish, sell, install and pay
-- out. What it did not have was a way to browse it, a way to ask to become a
-- vendor, or a way to take a listing back off sale. It also trusted vendors
-- with columns no vendor should be able to write: a vendor could mark its
-- own application approved, raise its own revenue share, and push a listing
-- straight to published without anybody reading it. Those columns are now
-- withheld, and the only route through them is a function that checks who is
-- asking.

-- -----------------------------------------------------------------------------
-- Columns a vendor may no longer write directly
-- -----------------------------------------------------------------------------

revoke update on public.marketplace_vendors from authenticated;

grant update (
  vendor_name, headline, bio, support_email, website_url, logo_path,
  payout_currency, payout_method, payout_details_encrypted, deleted_at,
  updated_at, updated_by
) on public.marketplace_vendors to authenticated;

revoke update on public.marketplace_listings from authenticated;

grant update (
  listing_slug, title, summary, description, category, tags, artifact_kind,
  artifact_payload, preview_image_path, demo_url, pricing_model, price_amount,
  price_currency, version, minimum_platform_version, deleted_at, updated_at,
  updated_by
) on public.marketplace_listings to authenticated;

-- -----------------------------------------------------------------------------
-- Becoming a vendor
-- -----------------------------------------------------------------------------

create or replace function public.apply_marketplace_vendor(
  p_company_id uuid,
  p_vendor_name text,
  p_vendor_slug text,
  p_support_email text,
  p_headline text default null,
  p_bio text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_vendor_id uuid;
begin
  if not coalesce(public.is_service_role() or public.is_company_owner(p_company_id), false) then
    raise exception 'Only the account owner can open a vendor account'
      using errcode = '42501';
  end if;

  if exists (
    select 1 from public.marketplace_vendors
     where company_id = p_company_id and deleted_at is null
  ) then
    raise exception 'This business already sells in the marketplace'
      using errcode = '23505';
  end if;

  if exists (
    select 1 from public.marketplace_vendors
     where vendor_slug = p_vendor_slug and deleted_at is null
  ) then
    raise exception 'That vendor address is already taken' using errcode = '23505';
  end if;

  insert into public.marketplace_vendors (
    company_id, vendor_name, vendor_slug, headline, bio, support_email,
    status, created_by, updated_by
  )
  values (
    p_company_id,
    btrim(p_vendor_name),
    p_vendor_slug,
    nullif(btrim(coalesce(p_headline, '')), ''),
    nullif(btrim(coalesce(p_bio, '')), ''),
    nullif(btrim(p_support_email), '')::citext,
    'pending_review',
    public.current_user_id(),
    public.current_user_id()
  )
  returning id into v_vendor_id;

  return v_vendor_id;
end;
$$;

comment on function public.apply_marketplace_vendor(uuid, text, text, text, text, text) is
  'Opens a marketplace vendor account for a business, pending platform review.';

-- Decides a vendor application, and sets the terms while deciding it.
create or replace function public.review_marketplace_vendor(
  p_vendor_id uuid,
  p_approve boolean,
  p_note text default null,
  p_revenue_share numeric default null
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Only the platform team can decide a vendor application'
      using errcode = '42501';
  end if;

  if not p_approve and nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'Say why the application is being refused' using errcode = '22023';
  end if;

  v_status := case when p_approve then 'approved' else 'closed' end;

  update public.marketplace_vendors
     set status = v_status,
         revenue_share_percentage = coalesce(p_revenue_share, revenue_share_percentage),
         approved_at = case when p_approve then now() else approved_at end,
         suspension_reason = case when p_approve then null else nullif(btrim(coalesce(p_note, '')), '') end,
         updated_at = now()
   where id = p_vendor_id and deleted_at is null;

  if not found then
    raise exception 'That vendor does not exist' using errcode = 'P0002';
  end if;

  return v_status;
end;
$$;

comment on function public.review_marketplace_vendor(uuid, boolean, text, numeric) is
  'Approves or closes a marketplace vendor application and sets its share.';

-- Takes a listing off sale without touching what buyers already installed.
create or replace function public.unpublish_listing(
  p_listing_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_listing public.marketplace_listings%rowtype;
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
    raise exception 'That listing belongs to another vendor' using errcode = '42501';
  end if;

  if v_listing.status <> 'published' then
    raise exception 'Only a published listing can be taken off sale'
      using errcode = '22023';
  end if;

  update public.marketplace_listings
     set status = 'unpublished',
         unpublished_at = now(),
         review_notes = nullif(btrim(coalesce(p_reason, '')), ''),
         updated_at = now()
   where id = p_listing_id;

  return true;
end;
$$;

comment on function public.unpublish_listing(uuid, text) is
  'Takes a published listing off sale, leaving existing installs alone.';

-- -----------------------------------------------------------------------------
-- The shopfront
-- -----------------------------------------------------------------------------

create or replace function public.marketplace_catalogue(
  p_category text default null,
  p_search text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  listing_id uuid,
  listing_slug text,
  title text,
  summary text,
  category text,
  artifact_kind text,
  pricing_model text,
  price_amount numeric,
  price_currency char(3),
  version text,
  install_count integer,
  average_rating numeric,
  rating_count integer,
  vendor_id uuid,
  vendor_name text,
  vendor_slug text,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.id,
         l.listing_slug,
         l.title,
         l.summary,
         l.category,
         l.artifact_kind,
         l.pricing_model,
         l.price_amount,
         l.price_currency,
         l.version,
         l.install_count,
         case when l.rating_count = 0 then null
              else round(l.rating_total::numeric / l.rating_count, 2)
         end,
         l.rating_count,
         v.id,
         v.vendor_name,
         v.vendor_slug,
         l.published_at
    from public.marketplace_listings as l
    join public.marketplace_vendors as v on v.id = l.vendor_id
   where l.status = 'published'
     and l.deleted_at is null
     and v.status = 'approved'
     and v.deleted_at is null
     and (p_category is null or l.category = p_category)
     and (
       p_search is null
       or l.title ilike '%' || p_search || '%'
       or l.summary ilike '%' || p_search || '%'
     )
   order by l.install_count desc, l.published_at desc
   limit greatest(1, least(coalesce(p_limit, 24), 60))
  offset greatest(0, coalesce(p_offset, 0));
$$;

comment on function public.marketplace_catalogue(text, text, integer, integer) is
  'Lists the published marketplace listings anybody may browse.';

-- Everything one vendor needs on their own desk, in one call.
create or replace function public.vendor_listings(p_vendor_id uuid)
returns table (
  listing_id uuid,
  listing_slug text,
  title text,
  category text,
  pricing_model text,
  price_amount numeric,
  price_currency char(3),
  version text,
  status text,
  install_count integer,
  purchase_count integer,
  rating_count integer,
  review_notes text,
  submitted_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz
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
    raise exception 'Those listings belong to another vendor' using errcode = '42501';
  end if;

  return query
  select l.id,
         l.listing_slug,
         l.title,
         l.category,
         l.pricing_model,
         l.price_amount,
         l.price_currency,
         l.version,
         l.status,
         l.install_count,
         l.purchase_count,
         l.rating_count,
         l.review_notes,
         l.submitted_at,
         l.published_at,
         l.updated_at
    from public.marketplace_listings as l
   where l.vendor_id = p_vendor_id
     and l.deleted_at is null
   order by l.updated_at desc;
end;
$$;

comment on function public.vendor_listings(uuid) is
  'Lists every listing of one vendor, whatever state it is in.';

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

grant execute on function
  public.apply_marketplace_vendor(uuid, text, text, text, text, text) to authenticated;
grant execute on function
  public.review_marketplace_vendor(uuid, boolean, text, numeric) to authenticated;
grant execute on function public.unpublish_listing(uuid, text) to authenticated;
grant execute on function
  public.marketplace_catalogue(text, text, integer, integer) to anon, authenticated;
grant execute on function public.vendor_listings(uuid) to authenticated;

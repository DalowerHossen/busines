-- supabase/migrations/00171_install_partner_triggers.sql
-- Timestamps, audit trail and the rules that keep the partner side honest.

select public.install_standard_triggers('reseller_price_books');
select public.install_timestamp_trigger('reseller_payouts');
select public.install_actor_trigger('reseller_payouts');
select public.install_standard_triggers('reseller_domains');
select public.install_standard_triggers('marketplace_vendors');
select public.install_standard_triggers('marketplace_listings');
select public.install_standard_triggers('developer_apps');

select public.install_standard_triggers('reseller_plan_prices');
select public.install_timestamp_trigger('reseller_tenant_links');
select public.install_timestamp_trigger('reseller_commissions');
select public.install_timestamp_trigger('marketplace_reviews');
select public.install_timestamp_trigger('marketplace_orders');
select public.install_timestamp_trigger('marketplace_installs');
select public.install_timestamp_trigger('marketplace_vendor_earnings');
select public.install_timestamp_trigger('marketplace_vendor_payouts');
select public.install_timestamp_trigger('developer_app_installs');
select public.install_timestamp_trigger('developer_app_capabilities');

-- Money and access are the two things an argument is ever about, so both
-- keep a trail.
select public.install_audit_trigger('reseller_price_books');
select public.install_audit_trigger('reseller_payouts');
select public.install_audit_trigger('marketplace_listings');
select public.install_audit_trigger('marketplace_vendor_payouts');
select public.install_audit_trigger('developer_apps');
select public.install_audit_trigger('developer_app_installs');

-- -----------------------------------------------------------------------------
-- One default price book per partner
-- -----------------------------------------------------------------------------

create or replace function public.enforce_single_default_price_book()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.is_default and new.deleted_at is null then
    update public.reseller_price_books
       set is_default = false,
           updated_at = now()
     where reseller_id = new.reseller_id
       and id <> new.id
       and is_default
       and deleted_at is null;
  end if;

  return new;
end;
$$;

comment on function public.enforce_single_default_price_book() is
  'Keeps exactly one price book marked as the default for a partner.';

create trigger reseller_price_books_20_single_default
  before insert or update of is_default on public.reseller_price_books
  for each row execute function public.enforce_single_default_price_book();

-- -----------------------------------------------------------------------------
-- A published listing cannot be edited underneath its buyers
-- -----------------------------------------------------------------------------

create or replace function public.guard_published_listing()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status = 'published' and new.status = 'published' then
    if new.artifact_payload is distinct from old.artifact_payload
       and new.version = old.version then
      raise exception
        'Change the version before changing what a published listing contains'
        using errcode = '22023';
    end if;

    if new.price_amount is distinct from old.price_amount
       and new.pricing_model = 'free' then
      raise exception 'A free listing cannot be given a price'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.guard_published_listing() is
  'Stops a published listing changing its contents without a new version.';

create trigger marketplace_listings_20_publish_guard
  before update on public.marketplace_listings
  for each row execute function public.guard_published_listing();

-- -----------------------------------------------------------------------------
-- An application may only be granted what it was approved for
-- -----------------------------------------------------------------------------

create or replace function public.guard_app_install_scopes()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_app public.developer_apps%rowtype;
  v_unknown text[];
begin
  select * into v_app
    from public.developer_apps
   where id = new.app_id;

  if not found then
    raise exception 'That application does not exist' using errcode = 'P0002';
  end if;

  if v_app.status <> 'approved' and new.status = 'active' then
    raise exception 'An application has to be approved before it is connected'
      using errcode = '22023';
  end if;

  select array_agg(s) into v_unknown
    from unnest(new.granted_scopes) as s
   where not (s = any (v_app.allowed_scopes));

  if v_unknown is not null then
    raise exception 'This application was never approved for %',
      array_to_string(v_unknown, ', ')
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_app_install_scopes() is
  'Refuses a connection that asks for more than the application was approved for.';

create trigger developer_app_installs_20_scope_guard
  before insert or update of granted_scopes, status
  on public.developer_app_installs
  for each row execute function public.guard_app_install_scopes();

-- -----------------------------------------------------------------------------
-- A vendor rating that always matches its reviews
-- -----------------------------------------------------------------------------

create or replace function public.recalculate_listing_rating()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_listing_id uuid;
begin
  v_listing_id := coalesce(new.listing_id, old.listing_id);

  update public.marketplace_listings
     set rating_total = coalesce(sub.total, 0),
         rating_count = coalesce(sub.qty, 0),
         updated_at = now()
    from (
      select coalesce(sum(rating), 0)::integer as total,
             count(*)::integer as qty
        from public.marketplace_reviews
       where listing_id = v_listing_id
         and is_visible
         and deleted_at is null
    ) as sub
   where id = v_listing_id;

  return null;
end;
$$;

comment on function public.recalculate_listing_rating() is
  'Recomputes a listing rating whenever a review changes or is hidden.';

create trigger marketplace_reviews_30_rating
  after update or delete on public.marketplace_reviews
  for each row execute function public.recalculate_listing_rating();

-- -----------------------------------------------------------------------------
-- A verified domain cannot quietly change hostname
-- -----------------------------------------------------------------------------

create or replace function public.guard_verified_domain()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.is_verified and new.hostname is distinct from old.hostname then
    raise exception 'Add a new domain rather than renaming a verified one'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

comment on function public.guard_verified_domain() is
  'Stops a verified partner domain being renamed into something else.';

create trigger reseller_domains_20_verified_guard
  before update on public.reseller_domains
  for each row execute function public.guard_verified_domain();

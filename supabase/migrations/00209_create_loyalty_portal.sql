-- supabase/migrations/00209_create_loyalty_portal.sql
-- The screens behind the loyalty scheme and the reviews it earns.
--
-- Earning, spending and expiring points were written when the tables were
-- built. What was missing was the ordinary day around them: setting the
-- scheme up, deciding what points buy, reading one member's statement, and
-- turning a happy client into a review that may be shown. Those routines
-- live here. Points are money that has not been spent, so nothing in this
-- file ever edits a balance directly: the balance is always the sum of the
-- movements, and a movement is only ever added.

-- -----------------------------------------------------------------------------
-- The scheme itself
-- -----------------------------------------------------------------------------

create or replace function public.company_loyalty_program(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_program public.loyalty_programs%rowtype;
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'That scheme belongs to another business' using errcode = '42501';
  end if;

  select * into v_program
    from public.loyalty_programs
   where company_id = p_company_id
     and deleted_at is null
   order by is_active desc, created_at desc
   limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'program_id', v_program.id,
    'name', v_program.name,
    'description', v_program.description,
    'is_active', v_program.is_active,
    'points_per_currency_unit', v_program.points_per_currency_unit,
    'earn_on', v_program.earn_on,
    'minimum_spend', v_program.minimum_spend,
    'point_value', v_program.point_value,
    'minimum_redemption_points', v_program.minimum_redemption_points,
    'redemption_multiple', v_program.redemption_multiple,
    'points_expire_after_months', v_program.points_expire_after_months,
    'expiry_warning_days', v_program.expiry_warning_days,
    'silver_threshold', v_program.silver_threshold,
    'gold_threshold', v_program.gold_threshold,
    'platinum_threshold', v_program.platinum_threshold,
    'terms_url', v_program.terms_url,
    'currency', v_program.currency,
    'member_count', v_program.member_count,
    'points_issued', v_program.points_issued,
    'points_redeemed', v_program.points_redeemed
  );
end;
$$;

comment on function public.company_loyalty_program(uuid) is
  'Reads the loyalty scheme one business runs, if it runs one.';

-- Writes the scheme. Giving points away is giving money away, so this is an
-- owner decision and nobody else may make it.
create or replace function public.save_loyalty_program(
  p_company_id uuid,
  p_name text,
  p_program_id uuid default null,
  p_description text default null,
  p_points_per_currency_unit numeric default 1,
  p_earn_on text default 'payment',
  p_minimum_spend numeric default 0,
  p_point_value numeric default 0.01,
  p_minimum_redemption_points integer default 100,
  p_redemption_multiple integer default 100,
  p_points_expire_after_months smallint default null,
  p_silver_threshold integer default null,
  p_gold_threshold integer default null,
  p_platinum_threshold integer default null,
  p_terms_url text default null,
  p_currency char(3) default 'USD',
  p_is_active boolean default true
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not coalesce(
    public.is_service_role() or public.is_company_owner(p_company_id),
    false
  ) then
    raise exception 'Only the account owner can run a loyalty scheme'
      using errcode = '42501';
  end if;

  if p_points_per_currency_unit is null or p_points_per_currency_unit <= 0 then
    raise exception 'Say how many points a unit of spending earns'
      using errcode = '22023';
  end if;

  if p_point_value is null or p_point_value <= 0 then
    raise exception 'Say what one point is worth' using errcode = '22023';
  end if;

  if p_program_id is not null then
    select id into v_id
      from public.loyalty_programs
     where id = p_program_id
       and company_id = p_company_id
       and deleted_at is null;

    if v_id is null then
      raise exception 'That scheme does not exist' using errcode = 'P0002';
    end if;

    update public.loyalty_programs
       set name = btrim(p_name),
           description = p_description,
           is_active = coalesce(p_is_active, true),
           points_per_currency_unit = p_points_per_currency_unit,
           earn_on = coalesce(p_earn_on, 'payment'),
           minimum_spend = coalesce(p_minimum_spend, 0),
           point_value = p_point_value,
           minimum_redemption_points = coalesce(p_minimum_redemption_points, 100),
           redemption_multiple = coalesce(p_redemption_multiple, 100),
           points_expire_after_months = p_points_expire_after_months,
           silver_threshold = p_silver_threshold,
           gold_threshold = p_gold_threshold,
           platinum_threshold = p_platinum_threshold,
           terms_url = p_terms_url,
           currency = coalesce(p_currency, 'USD'),
           updated_by = public.current_user_id(),
           updated_at = now()
     where id = v_id;

    return v_id;
  end if;

  insert into public.loyalty_programs (
    company_id, name, description, is_active, points_per_currency_unit,
    earn_on, minimum_spend, point_value, minimum_redemption_points,
    redemption_multiple, points_expire_after_months, silver_threshold,
    gold_threshold, platinum_threshold, terms_url, currency, created_by
  )
  values (
    p_company_id, btrim(p_name), p_description, coalesce(p_is_active, true),
    p_points_per_currency_unit, coalesce(p_earn_on, 'payment'),
    coalesce(p_minimum_spend, 0), p_point_value,
    coalesce(p_minimum_redemption_points, 100), coalesce(p_redemption_multiple, 100),
    p_points_expire_after_months, p_silver_threshold, p_gold_threshold,
    p_platinum_threshold, p_terms_url, coalesce(p_currency, 'USD'),
    public.current_user_id()
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.save_loyalty_program(
  uuid, text, uuid, text, numeric, text, numeric, numeric, integer, integer,
  smallint, integer, integer, integer, text, char, boolean
) is
  'Creates or changes the loyalty scheme of one business.';

-- -----------------------------------------------------------------------------
-- What points buy
-- -----------------------------------------------------------------------------

create or replace function public.company_loyalty_rewards(p_company_id uuid)
returns table (
  reward_id uuid,
  name text,
  description text,
  reward_type text,
  points_cost integer,
  credit_amount numeric,
  discount_percentage numeric,
  minimum_tier text,
  stock_quantity integer,
  redeemed_count integer,
  per_member_limit integer,
  is_active boolean,
  available_from date,
  available_until date,
  display_order smallint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'Those rewards belong to another business' using errcode = '42501';
  end if;

  return query
  select r.id,
         r.name,
         r.description,
         r.reward_type,
         r.points_cost,
         r.credit_amount,
         r.discount_percentage,
         r.minimum_tier,
         r.stock_quantity,
         r.redeemed_count,
         r.per_member_limit,
         r.is_active,
         r.available_from,
         r.available_until,
         r.display_order
    from public.loyalty_rewards as r
   where r.company_id = p_company_id
     and r.deleted_at is null
   order by r.display_order, r.points_cost;
end;
$$;

comment on function public.company_loyalty_rewards(uuid) is
  'Lists everything the members of one scheme can spend their points on.';

create or replace function public.save_loyalty_reward(
  p_program_id uuid,
  p_name text,
  p_points_cost integer,
  p_reward_id uuid default null,
  p_description text default null,
  p_reward_type text default 'invoice_credit',
  p_credit_amount numeric default null,
  p_discount_percentage numeric default null,
  p_minimum_tier text default 'standard',
  p_stock_quantity integer default null,
  p_per_member_limit integer default null,
  p_available_from date default null,
  p_available_until date default null,
  p_display_order smallint default 0
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_program public.loyalty_programs%rowtype;
  v_id uuid;
begin
  select * into v_program
    from public.loyalty_programs
   where id = p_program_id and deleted_at is null;

  if not found then
    raise exception 'That scheme does not exist' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.is_company_owner(v_program.company_id),
    false
  ) then
    raise exception 'Only the account owner can decide what points buy'
      using errcode = '42501';
  end if;

  if p_points_cost is null or p_points_cost <= 0 then
    raise exception 'A reward has to cost some points' using errcode = '22023';
  end if;

  if p_reward_id is not null then
    select id into v_id
      from public.loyalty_rewards
     where id = p_reward_id
       and program_id = p_program_id
       and deleted_at is null;

    if v_id is null then
      raise exception 'That reward does not exist' using errcode = 'P0002';
    end if;

    update public.loyalty_rewards
       set name = btrim(p_name),
           description = p_description,
           reward_type = coalesce(p_reward_type, 'invoice_credit'),
           points_cost = p_points_cost,
           credit_amount = p_credit_amount,
           discount_percentage = p_discount_percentage,
           minimum_tier = coalesce(p_minimum_tier, 'standard'),
           stock_quantity = p_stock_quantity,
           per_member_limit = p_per_member_limit,
           available_from = p_available_from,
           available_until = p_available_until,
           display_order = coalesce(p_display_order, 0),
           updated_by = public.current_user_id(),
           updated_at = now()
     where id = v_id;

    return v_id;
  end if;

  insert into public.loyalty_rewards (
    company_id, program_id, name, description, reward_type, points_cost,
    credit_amount, discount_percentage, minimum_tier, stock_quantity,
    per_member_limit, available_from, available_until, display_order, created_by
  )
  values (
    v_program.company_id, p_program_id, btrim(p_name), p_description,
    coalesce(p_reward_type, 'invoice_credit'), p_points_cost, p_credit_amount,
    p_discount_percentage, coalesce(p_minimum_tier, 'standard'), p_stock_quantity,
    p_per_member_limit, p_available_from, p_available_until,
    coalesce(p_display_order, 0), public.current_user_id()
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.save_loyalty_reward(
  uuid, text, integer, uuid, text, text, numeric, numeric, text, integer,
  integer, date, date, smallint
) is
  'Creates or changes one thing that points can be exchanged for.';

create or replace function public.set_loyalty_reward_active(
  p_reward_id uuid,
  p_is_active boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_reward public.loyalty_rewards%rowtype;
begin
  select * into v_reward
    from public.loyalty_rewards
   where id = p_reward_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That reward does not exist' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.is_company_owner(v_reward.company_id),
    false
  ) then
    raise exception 'Only the account owner can decide what points buy'
      using errcode = '42501';
  end if;

  update public.loyalty_rewards
     set is_active = p_is_active,
         updated_by = public.current_user_id(),
         updated_at = now()
   where id = p_reward_id;

  return true;
end;
$$;

comment on function public.set_loyalty_reward_active(uuid, boolean) is
  'Offers a reward again, or stops offering it, without deleting the history.';

-- -----------------------------------------------------------------------------
-- The members
-- -----------------------------------------------------------------------------

create or replace function public.company_loyalty_members(
  p_company_id uuid,
  p_search text default null,
  p_limit integer default 50
)
returns table (
  account_id uuid,
  membership_number text,
  client_id uuid,
  client_name text,
  tier text,
  points_balance integer,
  points_value numeric,
  points_earned_lifetime bigint,
  points_redeemed_lifetime bigint,
  next_expiry_date date,
  last_earned_at timestamptz,
  is_suspended boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'Those members belong to another business' using errcode = '42501';
  end if;

  return query
  select a.id,
         a.membership_number,
         a.client_id,
         cl.display_name,
         a.tier,
         a.points_balance,
         round(a.points_balance * p.point_value, 2),
         a.points_earned_lifetime,
         a.points_redeemed_lifetime,
         a.next_expiry_date,
         a.last_earned_at,
         a.is_suspended
    from public.loyalty_accounts as a
    join public.loyalty_programs as p on p.id = a.program_id
    left join public.clients as cl on cl.id = a.client_id
   where a.company_id = p_company_id
     and a.deleted_at is null
     and (
       p_search is null
       or btrim(p_search) = ''
       or a.membership_number ilike '%' || btrim(p_search) || '%'
       or coalesce(cl.display_name, '') ilike '%' || btrim(p_search) || '%'
     )
   order by a.points_balance desc, a.joined_at desc
   limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

comment on function public.company_loyalty_members(uuid, text, integer) is
  'Lists the members of a scheme, the biggest balances first.';

create or replace function public.loyalty_member_detail(p_account_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.loyalty_accounts%rowtype;
  v_program public.loyalty_programs%rowtype;
  v_client_name text;
begin
  select * into v_account
    from public.loyalty_accounts
   where id = p_account_id and deleted_at is null;

  if not found then
    return null;
  end if;

  if not coalesce(
    public.is_service_role() or public.has_company_access(v_account.company_id),
    false
  ) then
    raise exception 'That membership is not yours to read' using errcode = '42501';
  end if;

  select * into v_program
    from public.loyalty_programs
   where id = v_account.program_id;

  select display_name into v_client_name
    from public.clients
   where id = v_account.client_id;

  return jsonb_build_object(
    'account_id', v_account.id,
    'membership_number', v_account.membership_number,
    'client_id', v_account.client_id,
    'client_name', v_client_name,
    'tier', v_account.tier,
    'tier_achieved_at', v_account.tier_achieved_at,
    'points_balance', v_account.points_balance,
    'points_value', round(v_account.points_balance * v_program.point_value, 2),
    'currency', v_program.currency,
    'points_earned_lifetime', v_account.points_earned_lifetime,
    'points_redeemed_lifetime', v_account.points_redeemed_lifetime,
    'points_expired_lifetime', v_account.points_expired_lifetime,
    'joined_at', v_account.joined_at,
    'next_expiry_date', v_account.next_expiry_date,
    'is_suspended', v_account.is_suspended,
    'suspension_reason', v_account.suspension_reason,
    'movements', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'movement_id', t.id,
                 'entry_type', t.entry_type,
                 'points', t.points,
                 'balance_after', t.balance_after,
                 'reason', t.reason,
                 'expires_on', t.expires_on,
                 'created_at', t.created_at
               )
               order by t.created_at desc
             )
        from public.loyalty_transactions as t
       where t.account_id = v_account.id
    ), '[]'::jsonb),
    'redemptions', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'redemption_id', d.id,
                 'redemption_code', d.redemption_code,
                 'reward_name', rw.name,
                 'points_spent', d.points_spent,
                 'reward_value', d.reward_value,
                 'currency', d.currency,
                 'status', d.status,
                 'issued_at', d.issued_at,
                 'expires_on', d.expires_on,
                 'applied_at', d.applied_at
               )
               order by d.issued_at desc
             )
        from public.loyalty_redemptions as d
        left join public.loyalty_rewards as rw on rw.id = d.reward_id
       where d.account_id = v_account.id
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.loyalty_member_detail(uuid) is
  'Reads one membership with every movement and every reward claimed.';

create or replace function public.loyalty_overview(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_point_value numeric;
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'That scheme belongs to another business' using errcode = '42501';
  end if;

  select coalesce(max(point_value), 0.01) into v_point_value
    from public.loyalty_programs
   where company_id = p_company_id and deleted_at is null;

  return jsonb_build_object(
    'member_count', (
      select count(*)::int from public.loyalty_accounts
       where company_id = p_company_id and deleted_at is null
    ),
    'points_outstanding', (
      select coalesce(sum(points_balance), 0)::bigint
        from public.loyalty_accounts
       where company_id = p_company_id and deleted_at is null
    ),
    'liability_amount', (
      select round(coalesce(sum(points_balance), 0) * v_point_value, 2)
        from public.loyalty_accounts
       where company_id = p_company_id and deleted_at is null
    ),
    'rewards_claimed', (
      select count(*)::int from public.loyalty_redemptions
       where company_id = p_company_id
    ),
    'rewards_waiting', (
      select count(*)::int from public.loyalty_redemptions
       where company_id = p_company_id and status = 'issued'
    ),
    'top_tier_members', (
      select count(*)::int from public.loyalty_accounts
       where company_id = p_company_id
         and deleted_at is null
         and tier in ('gold', 'platinum')
    )
  );
end;
$$;

comment on function public.loyalty_overview(uuid) is
  'Counts the members, the points still owed and what they are worth.';

-- -----------------------------------------------------------------------------
-- Asking for a review once the work is paid for
-- -----------------------------------------------------------------------------

create or replace function public.invite_invoice_review(p_invoice_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_email text;
  v_request_id uuid;
begin
  select * into v_invoice
    from public.invoices
   where id = p_invoice_id and deleted_at is null;

  if not found then
    raise exception 'That invoice does not exist' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.can_write_company_data(v_invoice.company_id),
    false
  ) then
    raise exception 'That invoice is not yours to write to' using errcode = '42501';
  end if;

  if v_invoice.status <> 'paid' then
    raise exception 'Ask for a review once the invoice has been paid'
      using errcode = '22023';
  end if;

  select email::text into v_email
    from public.clients
   where id = v_invoice.client_id;

  if v_email is null then
    raise exception 'That client has no address we can write to'
      using errcode = '22023';
  end if;

  v_request_id := public.request_review(
    v_invoice.company_id, v_email, 'invoice', p_invoice_id, v_invoice.client_id
  );

  return v_request_id;
end;
$$;

comment on function public.invite_invoice_review(uuid) is
  'Invites the client of a paid invoice to rate the work, once.';

create or replace function public.company_review_requests(
  p_company_id uuid,
  p_status text default null,
  p_limit integer default 50
)
returns table (
  request_id uuid,
  email_address text,
  client_id uuid,
  client_name text,
  subject_type text,
  subject_id uuid,
  status text,
  rating smallint,
  comment text,
  would_recommend boolean,
  requested_at timestamptz,
  responded_at timestamptz,
  has_testimonial boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'Those reviews belong to another business' using errcode = '42501';
  end if;

  return query
  select r.id,
         r.email_address::text,
         r.client_id,
         cl.display_name,
         r.subject_type,
         r.subject_id,
         r.status,
         r.rating,
         r.comment,
         r.would_recommend,
         r.requested_at,
         r.responded_at,
         exists (
           select 1 from public.testimonials as t
            where t.review_request_id = r.id and t.deleted_at is null
         )
    from public.review_requests as r
    left join public.clients as cl on cl.id = r.client_id
   where r.company_id = p_company_id
     and (p_status is null or r.status = p_status)
   order by r.requested_at desc
   limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

comment on function public.company_review_requests(uuid, text, integer) is
  'Lists the review invitations of one business and the answers that came back.';

create or replace function public.company_testimonials(p_company_id uuid)
returns table (
  testimonial_id uuid,
  review_request_id uuid,
  author_name text,
  author_title text,
  author_company text,
  quote text,
  rating smallint,
  is_approved boolean,
  consent_given boolean,
  is_featured boolean,
  display_surface text,
  display_order smallint,
  approved_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'Those quotes belong to another business' using errcode = '42501';
  end if;

  return query
  select t.id,
         t.review_request_id,
         t.author_name,
         t.author_title,
         t.author_company,
         t.quote,
         t.rating,
         t.is_approved,
         t.consent_given,
         t.is_featured,
         t.display_surface,
         t.display_order,
         t.approved_at,
         t.created_at
    from public.testimonials as t
   where t.company_id = p_company_id
     and t.deleted_at is null
   order by t.display_order, t.created_at desc;
end;
$$;

comment on function public.company_testimonials(uuid) is
  'Lists the quotes a business holds, published or not.';

-- Turns an answered review into a quote. Consent is recorded here rather
-- than assumed, because the approval routine refuses to publish without it.
create or replace function public.save_testimonial(
  p_company_id uuid,
  p_author_name text,
  p_quote text,
  p_testimonial_id uuid default null,
  p_review_request_id uuid default null,
  p_author_title text default null,
  p_author_company text default null,
  p_rating smallint default null,
  p_consent_given boolean default false,
  p_display_surface text default 'home',
  p_is_featured boolean default false,
  p_display_order smallint default 100
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not coalesce(
    public.is_service_role() or public.is_company_owner(p_company_id),
    false
  ) then
    raise exception 'Only the account owner can publish what a client said'
      using errcode = '42501';
  end if;

  if p_review_request_id is not null
     and not exists (
       select 1 from public.review_requests
        where id = p_review_request_id and company_id = p_company_id
     ) then
    raise exception 'That review belongs to another business' using errcode = '42501';
  end if;

  if p_testimonial_id is not null then
    select id into v_id
      from public.testimonials
     where id = p_testimonial_id
       and company_id = p_company_id
       and deleted_at is null;

    if v_id is null then
      raise exception 'That quote does not exist' using errcode = 'P0002';
    end if;

    update public.testimonials
       set author_name = btrim(p_author_name),
           author_title = p_author_title,
           author_company = p_author_company,
           quote = btrim(p_quote),
           rating = p_rating,
           consent_given = coalesce(p_consent_given, false),
           consent_given_at = case
             when coalesce(p_consent_given, false) then coalesce(consent_given_at, now())
             else null
           end,
           is_approved = case when coalesce(p_consent_given, false) then is_approved else false end,
           approved_at = case when coalesce(p_consent_given, false) then approved_at else null end,
           is_featured = coalesce(p_is_featured, false),
           display_surface = coalesce(p_display_surface, 'home'),
           display_order = coalesce(p_display_order, 100),
           updated_by = public.current_user_id(),
           updated_at = now()
     where id = v_id;

    return v_id;
  end if;

  insert into public.testimonials (
    company_id, review_request_id, author_name, author_title, author_company,
    quote, rating, consent_given, consent_given_at, is_featured,
    display_surface, display_order, created_by
  )
  values (
    p_company_id, p_review_request_id, btrim(p_author_name), p_author_title,
    p_author_company, btrim(p_quote), p_rating, coalesce(p_consent_given, false),
    case when coalesce(p_consent_given, false) then now() else null end,
    coalesce(p_is_featured, false), coalesce(p_display_surface, 'home'),
    coalesce(p_display_order, 100), public.current_user_id()
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.save_testimonial(
  uuid, text, text, uuid, uuid, text, text, smallint, boolean, text, boolean, smallint
) is
  'Creates or changes a quote, keeping consent and approval tied together.';

create or replace function public.review_overview(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_summary record;
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'Those reviews belong to another business' using errcode = '42501';
  end if;

  select * into v_summary from public.review_summary(p_company_id);

  return jsonb_build_object(
    'response_count', coalesce(v_summary.response_count, 0),
    'average_rating', coalesce(v_summary.average_rating, 0),
    'promoter_count', coalesce(v_summary.promoter_count, 0),
    'detractor_count', coalesce(v_summary.detractor_count, 0),
    'recommend_rate', coalesce(v_summary.recommend_rate, 0),
    'waiting_count', (
      select count(*)::int from public.review_requests
       where company_id = p_company_id and status in ('pending', 'sent')
    ),
    'published_count', (
      select count(*)::int from public.testimonials
       where company_id = p_company_id and is_approved and deleted_at is null
    ),
    'unpublished_count', (
      select count(*)::int from public.testimonials
       where company_id = p_company_id and not is_approved and deleted_at is null
    )
  );
end;
$$;

comment on function public.review_overview(uuid) is
  'Summarises the ratings of one business and the quotes drawn from them.';

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.company_loyalty_program(uuid)
  from public, authenticated;
revoke execute on function public.save_loyalty_program(
  uuid, text, uuid, text, numeric, text, numeric, numeric, integer, integer,
  smallint, integer, integer, integer, text, char, boolean
) from public, authenticated;
revoke execute on function public.company_loyalty_rewards(uuid)
  from public, authenticated;
revoke execute on function public.save_loyalty_reward(
  uuid, text, integer, uuid, text, text, numeric, numeric, text, integer,
  integer, date, date, smallint
) from public, authenticated;
revoke execute on function public.set_loyalty_reward_active(uuid, boolean)
  from public, authenticated;
revoke execute on function public.company_loyalty_members(uuid, text, integer)
  from public, authenticated;
revoke execute on function public.loyalty_member_detail(uuid)
  from public, authenticated;
revoke execute on function public.loyalty_overview(uuid)
  from public, authenticated;
revoke execute on function public.invite_invoice_review(uuid)
  from public, authenticated;
revoke execute on function public.company_review_requests(uuid, text, integer)
  from public, authenticated;
revoke execute on function public.company_testimonials(uuid)
  from public, authenticated;
revoke execute on function public.save_testimonial(
  uuid, text, text, uuid, uuid, text, text, smallint, boolean, text, boolean, smallint
) from public, authenticated;
revoke execute on function public.review_overview(uuid)
  from public, authenticated;

grant execute on function public.company_loyalty_program(uuid)
  to authenticated, service_role;
grant execute on function public.save_loyalty_program(
  uuid, text, uuid, text, numeric, text, numeric, numeric, integer, integer,
  smallint, integer, integer, integer, text, char, boolean
) to authenticated, service_role;
grant execute on function public.company_loyalty_rewards(uuid)
  to authenticated, service_role;
grant execute on function public.save_loyalty_reward(
  uuid, text, integer, uuid, text, text, numeric, numeric, text, integer,
  integer, date, date, smallint
) to authenticated, service_role;
grant execute on function public.set_loyalty_reward_active(uuid, boolean)
  to authenticated, service_role;
grant execute on function public.company_loyalty_members(uuid, text, integer)
  to authenticated, service_role;
grant execute on function public.loyalty_member_detail(uuid)
  to authenticated, service_role;
grant execute on function public.loyalty_overview(uuid)
  to authenticated, service_role;
grant execute on function public.invite_invoice_review(uuid)
  to authenticated, service_role;
grant execute on function public.company_review_requests(uuid, text, integer)
  to authenticated, service_role;
grant execute on function public.company_testimonials(uuid)
  to authenticated, service_role;
grant execute on function public.save_testimonial(
  uuid, text, text, uuid, uuid, text, text, smallint, boolean, text, boolean, smallint
) to authenticated, service_role;
grant execute on function public.review_overview(uuid)
  to authenticated, service_role;

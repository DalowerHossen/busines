-- supabase/migrations/00185_create_loyalty_functions.sql
-- Earning, spending and losing points, always through a movement row.

-- Enrols a client, or returns the membership they already have.
create or replace function public.enrol_loyalty_member(
  p_program_id uuid,
  p_client_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_program public.loyalty_programs%rowtype;
  v_account_id uuid;
  v_next integer;
  v_number text;
begin
  select * into v_program
    from public.loyalty_programs
   where id = p_program_id and deleted_at is null;

  if not found then
    raise exception 'That loyalty programme does not exist' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.can_write_company_data(v_program.company_id),
    false
  ) then
    raise exception 'That account is not yours to write to' using errcode = '42501';
  end if;

  select id into v_account_id
    from public.loyalty_accounts
   where program_id = p_program_id
     and client_id = p_client_id
     and deleted_at is null;

  if v_account_id is not null then
    return v_account_id;
  end if;

  select coalesce(
           max(nullif(regexp_replace(membership_number, '^LY-', ''), '')::integer),
           0
         ) + 1
    into v_next
    from public.loyalty_accounts
   where company_id = v_program.company_id
     and membership_number ~ '^LY-[0-9]+$';

  v_number := 'LY-' || lpad(v_next::text, 4, '0');

  insert into public.loyalty_accounts (
    company_id, program_id, client_id, membership_number
  )
  values (v_program.company_id, p_program_id, p_client_id, v_number)
  returning id into v_account_id;

  update public.loyalty_programs
     set member_count = member_count + 1,
         updated_at = now()
   where id = p_program_id;

  return v_account_id;
end;
$$;

comment on function public.enrol_loyalty_member(uuid, uuid) is
  'Adds a client to a loyalty programme, once.';

-- Moves a member up when their lifetime earnings pass a threshold.
create or replace function public.recalculate_loyalty_tier(p_account_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.loyalty_accounts%rowtype;
  v_program public.loyalty_programs%rowtype;
  v_tier text;
begin
  select * into v_account from public.loyalty_accounts where id = p_account_id;

  if not found then
    return null;
  end if;

  select * into v_program
    from public.loyalty_programs
   where id = v_account.program_id;

  v_tier := 'standard';

  if v_program.platinum_threshold is not null
     and v_account.points_earned_lifetime >= v_program.platinum_threshold then
    v_tier := 'platinum';
  elsif v_program.gold_threshold is not null
        and v_account.points_earned_lifetime >= v_program.gold_threshold then
    v_tier := 'gold';
  elsif v_program.silver_threshold is not null
        and v_account.points_earned_lifetime >= v_program.silver_threshold then
    v_tier := 'silver';
  end if;

  if v_tier <> v_account.tier then
    update public.loyalty_accounts
       set tier = v_tier,
           tier_achieved_at = now(),
           tier_reviewed_at = now(),
           updated_at = now()
     where id = p_account_id;
  else
    update public.loyalty_accounts
       set tier_reviewed_at = now(),
           updated_at = now()
     where id = p_account_id;
  end if;

  return v_tier;
end;
$$;

comment on function public.recalculate_loyalty_tier(uuid) is
  'Sets the tier a member has reached on their lifetime earnings.';

-- Awards points, with the expiry the programme sets.
create or replace function public.award_loyalty_points(
  p_account_id uuid,
  p_points integer,
  p_reason text,
  p_payment_id uuid default null,
  p_invoice_id uuid default null,
  p_entry_type text default 'earned',
  p_expires_on date default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.loyalty_accounts%rowtype;
  v_program public.loyalty_programs%rowtype;
  v_transaction_id uuid;
  v_balance integer;
  v_expires date;
begin
  if coalesce(p_points, 0) <= 0 then
    raise exception 'Points awarded have to be more than nothing'
      using errcode = '22023';
  end if;

  select * into v_account
    from public.loyalty_accounts
   where id = p_account_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That membership does not exist' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.can_write_company_data(v_account.company_id),
    false
  ) then
    raise exception 'That account is not yours to write to' using errcode = '42501';
  end if;

  if v_account.is_suspended then
    raise exception 'That membership is suspended' using errcode = '22023';
  end if;

  select * into v_program
    from public.loyalty_programs
   where id = v_account.program_id;

  v_balance := v_account.points_balance + p_points;

  -- Promotional points may be given a shorter life than the programme default.
  v_expires := coalesce(
    p_expires_on,
    case
      when v_program.points_expire_after_months is null then null
      else (current_date
            + make_interval(months => v_program.points_expire_after_months))::date
    end
  );

  insert into public.loyalty_transactions (
    company_id, account_id, entry_type, points, balance_after, reason,
    payment_id, invoice_id, expires_on, created_by
  )
  values (
    v_account.company_id, p_account_id, coalesce(p_entry_type, 'earned'),
    p_points, v_balance, p_reason, p_payment_id, p_invoice_id, v_expires,
    public.current_user_id()
  )
  returning id into v_transaction_id;

  update public.loyalty_accounts
     set points_balance = v_balance,
         points_earned_lifetime = points_earned_lifetime + p_points,
         last_earned_at = now(),
         next_expiry_date = least(coalesce(next_expiry_date, v_expires), v_expires),
         updated_at = now()
   where id = p_account_id;

  update public.loyalty_programs
     set points_issued = points_issued + p_points,
         updated_at = now()
   where id = v_account.program_id;

  perform public.recalculate_loyalty_tier(p_account_id);

  return v_transaction_id;
end;
$$;

comment on function public.award_loyalty_points(
  uuid, integer, text, uuid, uuid, text, date
) is 'Adds points to a membership and records why they were given.';

-- Works out and awards the points a received payment is worth.
create or replace function public.accrue_points_for_payment(p_payment_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_program public.loyalty_programs%rowtype;
  v_account_id uuid;
  v_points integer;
begin
  select * into v_payment
    from public.payments
   where id = p_payment_id and deleted_at is null;

  if not found or v_payment.status <> 'succeeded' or v_payment.client_id is null then
    return null;
  end if;

  if not coalesce(
    public.is_service_role() or public.can_write_company_data(v_payment.company_id),
    false
  ) then
    raise exception 'That account is not yours to write to' using errcode = '42501';
  end if;

  select * into v_program
    from public.loyalty_programs
   where company_id = v_payment.company_id
     and is_active
     and deleted_at is null;

  if not found or v_program.earn_on not in ('payment', 'invoice_paid') then
    return null;
  end if;

  if v_payment.amount < v_program.minimum_spend then
    return null;
  end if;

  -- Points are whole things; the remainder is simply not awarded.
  v_points := floor(v_payment.amount * v_program.points_per_currency_unit)::integer;

  if v_points <= 0 then
    return null;
  end if;

  -- Paying twice for the same payment is the one mistake worth guarding.
  if exists (
    select 1
      from public.loyalty_transactions
     where payment_id = p_payment_id
       and entry_type in ('earned', 'bonus')
  ) then
    return null;
  end if;

  v_account_id := public.enrol_loyalty_member(v_program.id, v_payment.client_id);

  return public.award_loyalty_points(
    v_account_id, v_points, 'Points for a payment received', p_payment_id, null,
    'earned'
  );
end;
$$;

comment on function public.accrue_points_for_payment(uuid) is
  'Awards the points a received payment earns, once per payment.';

-- Spends points on a reward and issues the code that proves it.
create or replace function public.redeem_loyalty_reward(
  p_account_id uuid,
  p_reward_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_account public.loyalty_accounts%rowtype;
  v_reward public.loyalty_rewards%rowtype;
  v_program public.loyalty_programs%rowtype;
  v_redemption_id uuid;
  v_code text;
  v_balance integer;
  v_tier_rank integer;
  v_required_rank integer;
begin
  select * into v_account
    from public.loyalty_accounts
   where id = p_account_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That membership does not exist' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.can_write_company_data(v_account.company_id),
    false
  ) then
    raise exception 'That account is not yours to write to' using errcode = '42501';
  end if;

  if v_account.is_suspended then
    raise exception 'That membership is suspended' using errcode = '22023';
  end if;

  select * into v_reward
    from public.loyalty_rewards
   where id = p_reward_id
     and program_id = v_account.program_id
     and is_active
     and deleted_at is null;

  if not found then
    raise exception 'That reward is not available' using errcode = 'P0002';
  end if;

  if v_reward.available_from is not null and v_reward.available_from > current_date then
    raise exception 'That reward cannot be claimed yet' using errcode = '22023';
  end if;

  if v_reward.available_until is not null and v_reward.available_until < current_date then
    raise exception 'That reward is no longer offered' using errcode = '22023';
  end if;

  if v_reward.stock_quantity is not null and v_reward.stock_quantity <= 0 then
    raise exception 'That reward has run out' using errcode = '22023';
  end if;

  v_tier_rank := array_position(
    array['standard', 'silver', 'gold', 'platinum'], v_account.tier
  );
  v_required_rank := array_position(
    array['standard', 'silver', 'gold', 'platinum'], v_reward.minimum_tier
  );

  if v_tier_rank < v_required_rank then
    raise exception 'That reward is for % members and above', v_reward.minimum_tier
      using errcode = '42501';
  end if;

  if v_account.points_balance < v_reward.points_cost then
    raise exception 'That reward costs % points and the balance is %',
      v_reward.points_cost, v_account.points_balance
      using errcode = '22023';
  end if;

  select * into v_program
    from public.loyalty_programs
   where id = v_account.program_id;

  if v_reward.per_member_limit is not null then
    if (
      select count(*)
        from public.loyalty_redemptions
       where account_id = p_account_id
         and reward_id = p_reward_id
         and status <> 'cancelled'
    ) >= v_reward.per_member_limit then
      raise exception 'This membership has claimed that reward as often as allowed'
        using errcode = '22023';
    end if;
  end if;

  v_code := upper(
    substr(replace(encode(extensions.gen_random_bytes(8), 'hex'), '-', ''), 1, 10)
  );

  v_balance := v_account.points_balance - v_reward.points_cost;

  insert into public.loyalty_redemptions (
    company_id, account_id, reward_id, redemption_code, points_spent,
    reward_value, currency, expires_on, created_by
  )
  values (
    v_account.company_id, p_account_id, p_reward_id, v_code,
    v_reward.points_cost,
    coalesce(v_reward.credit_amount,
             round(v_reward.points_cost * v_program.point_value, 4)),
    v_program.currency, (current_date + 180), public.current_user_id()
  )
  returning id into v_redemption_id;

  insert into public.loyalty_transactions (
    company_id, account_id, entry_type, points, balance_after, reason,
    reward_id, redemption_id, created_by
  )
  values (
    v_account.company_id, p_account_id, 'redeemed', -v_reward.points_cost,
    v_balance, 'Redeemed ' || v_reward.name, p_reward_id, v_redemption_id,
    public.current_user_id()
  );

  update public.loyalty_accounts
     set points_balance = v_balance,
         points_redeemed_lifetime = points_redeemed_lifetime + v_reward.points_cost,
         last_redeemed_at = now(),
         updated_at = now()
   where id = p_account_id;

  update public.loyalty_rewards
     set redeemed_count = redeemed_count + 1,
         stock_quantity = case
           when stock_quantity is null then null
           else stock_quantity - 1
         end,
         updated_at = now()
   where id = p_reward_id;

  update public.loyalty_programs
     set points_redeemed = points_redeemed + v_reward.points_cost,
         updated_at = now()
   where id = v_account.program_id;

  return v_redemption_id;
end;
$$;

comment on function public.redeem_loyalty_reward(uuid, uuid) is
  'Exchanges points for a reward and issues the code that proves the claim.';

-- Marks a reward as used against an invoice.
create or replace function public.apply_loyalty_redemption(
  p_redemption_id uuid,
  p_invoice_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_redemption public.loyalty_redemptions%rowtype;
begin
  select * into v_redemption
    from public.loyalty_redemptions
   where id = p_redemption_id
     for update;

  if not found or v_redemption.status <> 'issued' then
    return false;
  end if;

  if not coalesce(
    public.is_service_role() or public.can_write_company_data(v_redemption.company_id),
    false
  ) then
    raise exception 'That account is not yours to write to' using errcode = '42501';
  end if;

  update public.loyalty_redemptions
     set status = 'applied',
         applied_at = now(),
         applied_to_invoice_id = p_invoice_id,
         updated_at = now()
   where id = p_redemption_id;

  return true;
end;
$$;

comment on function public.apply_loyalty_redemption(uuid, uuid) is
  'Records that a claimed reward has been used on an invoice.';

-- Takes back points that were never spent in time.
create or replace function public.expire_loyalty_points()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_total integer := 0;
  v_balance integer;
  v_expiring integer;
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Only the platform expires points' using errcode = '42501';
  end if;

  for v_row in
    select t.account_id,
           sum(t.points)::integer as points,
           a.company_id as company_id
      from public.loyalty_transactions as t
      join public.loyalty_accounts as a on a.id = t.account_id
     where t.entry_type in ('earned', 'bonus')
       and t.expired_at is null
       and t.expires_on is not null
       and t.expires_on < current_date
     group by t.account_id, a.company_id
  loop
    select points_balance into v_balance
      from public.loyalty_accounts
     where id = v_row.account_id
       for update;

    -- Points already spent cannot expire a second time.
    v_expiring := least(v_row.points, v_balance);

    update public.loyalty_transactions
       set expired_at = now()
     where account_id = v_row.account_id
       and entry_type in ('earned', 'bonus')
       and expired_at is null
       and expires_on is not null
       and expires_on < current_date;

    if v_expiring > 0 then
      insert into public.loyalty_transactions (
        company_id, account_id, entry_type, points, balance_after, reason
      )
      values (
        v_row.company_id, v_row.account_id, 'expired', -v_expiring,
        v_balance - v_expiring, 'Points expired without being used'
      );

      update public.loyalty_accounts
         set points_balance = v_balance - v_expiring,
             points_expired_lifetime = points_expired_lifetime + v_expiring,
             next_expiry_date = (
               select min(expires_on)
                 from public.loyalty_transactions
                where account_id = v_row.account_id
                  and entry_type in ('earned', 'bonus')
                  and expired_at is null
             ),
             updated_at = now()
       where id = v_row.account_id;

      v_total := v_total + v_expiring;
    end if;
  end loop;

  return v_total;
end;
$$;

comment on function public.expire_loyalty_points() is
  'Removes points whose expiry date has passed and records the loss.';

-- The statement a member is shown.
create or replace function public.loyalty_account_summary(p_account_id uuid)
returns table (
  membership_number text,
  tier text,
  points_balance integer,
  points_value numeric,
  points_earned_lifetime bigint,
  points_redeemed_lifetime bigint,
  next_expiry_date date,
  rewards_available integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.loyalty_accounts%rowtype;
  v_program public.loyalty_programs%rowtype;
begin
  select * into v_account
    from public.loyalty_accounts
   where id = p_account_id and deleted_at is null;

  if not found then
    return;
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

  return query
  select v_account.membership_number,
         v_account.tier,
         v_account.points_balance,
         round(v_account.points_balance * v_program.point_value, 2),
         v_account.points_earned_lifetime,
         v_account.points_redeemed_lifetime,
         v_account.next_expiry_date,
         (select count(*)
            from public.loyalty_rewards as r
           where r.program_id = v_account.program_id
             and r.is_active
             and r.deleted_at is null
             and r.points_cost <= v_account.points_balance)::integer;
end;
$$;

comment on function public.loyalty_account_summary(uuid) is
  'Shows a member their balance, its worth and what they can afford.';

-- supabase/migrations/00214_create_settlement_admin.sql
-- The controls the platform team needs over the money it holds.
--
-- Three things have to be changeable without a deployment, because all three
-- change for commercial reasons rather than technical ones: what the platform
-- charges, how long it holds, and how quickly it promises to pay out. The
-- previous file made those terms data. This one gives the platform team the
-- means to edit them, to drop a negotiated deal back to the standard terms,
-- and to see what the whole arrangement is actually earning.

-- -----------------------------------------------------------------------------
-- Dropping a negotiated deal
-- -----------------------------------------------------------------------------

-- Removing the terms of one account is not the same as deleting anything:
-- that account simply falls back to the standard terms from its next payment
-- onwards. Settlements already made keep the figures they were made with.
create or replace function public.delete_settlement_policy(p_company_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may change the collection terms'
      using errcode = '42501';
  end if;

  if p_company_id is null then
    raise exception 'The standard terms cannot be removed, only edited'
      using errcode = '22023';
  end if;

  update public.settlement_policies
     set deleted_at = now(),
         is_active = false,
         updated_at = now(),
         updated_by = public.current_user_id()
   where company_id = p_company_id
     and deleted_at is null;

  return found;
end;
$$;

comment on function public.delete_settlement_policy(uuid) is
  'Returns one account to the standard collection terms, changing no settlement already made.';

-- -----------------------------------------------------------------------------
-- What the arrangement earns
-- -----------------------------------------------------------------------------

create or replace function public.settlement_revenue_report(
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_from date := coalesce(p_from, current_date - 30);
  v_to date := coalesce(p_to, current_date);
  v_result jsonb;
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may read the collection revenue'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
           'from_date', v_from,
           'to_date', v_to,
           'settled_count', count(*) filter (where status <> 'reversed'),
           'collected_volume',
             coalesce(sum(gross_amount) filter (where status <> 'reversed'), 0),
           'platform_fees',
             coalesce(sum(platform_fee_amount) filter (where status <> 'reversed'), 0),
           'gateway_fees',
             coalesce(sum(gateway_fee_amount) filter (where status <> 'reversed'), 0),
           'seller_share',
             coalesce(sum(net_amount) filter (where status <> 'reversed'), 0),
           'held_now', coalesce(sum(net_amount) filter (where status = 'held'), 0),
           'awaiting_withdrawal',
             coalesce(sum(net_amount) filter (where status = 'available'), 0),
           'reversed_count', count(*) filter (where status = 'reversed'),
           'reversed_volume',
             coalesce(sum(gross_amount) filter (where status = 'reversed'), 0),
           'average_fee',
             case
               when count(*) filter (where status <> 'reversed') = 0 then 0
               else round(
                 coalesce(sum(platform_fee_amount) filter (where status <> 'reversed'), 0)
                 / count(*) filter (where status <> 'reversed'),
                 4
               )
             end
         )
    into v_result
    from public.settlements
   where created_at::date between v_from and v_to;

  return v_result;
end;
$$;

comment on function public.settlement_revenue_report(date, date) is
  'Totals what the platform collected, kept and held over a period.';

-- The accounts worth negotiating with: whoever is putting the most volume
-- through, with what they have paid in fees so far.
create or replace function public.top_settlement_accounts(p_limit integer default 20)
returns table (
  company_id uuid,
  company_name text,
  currency char(3),
  settled_count integer,
  collected_volume numeric,
  platform_fees numeric,
  has_own_terms boolean,
  fee_percentage numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may read the collection revenue'
      using errcode = '42501';
  end if;

  return query
    select s.company_id,
           c.legal_name,
           max(s.currency),
           count(*)::int,
           coalesce(sum(s.gross_amount), 0)::numeric,
           coalesce(sum(s.platform_fee_amount), 0)::numeric,
           bool_or(p.id is not null),
           max(coalesce(p.fee_percentage, 0))
      from public.settlements as s
      left join public.companies as c on c.id = s.company_id
      left join public.settlement_policies as p
        on p.company_id = s.company_id and p.deleted_at is null
     where s.status <> 'reversed'
     group by s.company_id, c.legal_name
     order by coalesce(sum(s.gross_amount), 0) desc
     limit greatest(coalesce(p_limit, 20), 1);
end;
$$;

comment on function public.top_settlement_accounts(integer) is
  'Ranks the accounts putting the most money through the platform.';

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.delete_settlement_policy(uuid)
  from public, authenticated;
revoke execute on function public.settlement_revenue_report(date, date)
  from public, authenticated;
revoke execute on function public.top_settlement_accounts(integer)
  from public, authenticated;

grant execute on function public.delete_settlement_policy(uuid)
  to authenticated, service_role;
grant execute on function public.settlement_revenue_report(date, date)
  to authenticated, service_role;
grant execute on function public.top_settlement_accounts(integer)
  to authenticated, service_role;

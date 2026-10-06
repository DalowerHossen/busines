-- supabase/migrations/00216_create_seller_onboarding.sql
-- Getting a new seller from signing up to being paid.
--
-- A freelancer in Dhaka or a shop in Manila signs up, and between that
-- moment and their first payment there are exactly five things that have to
-- be true: the business has a name and an address to print on an invoice,
-- their identity has been checked, there is somewhere to send the money, a
-- client exists, and an invoice has been issued. Everything else can wait.
--
-- None of that is stored as a separate checklist, because a checklist that
-- is written down drifts away from reality the moment somebody edits a
-- record directly. It is computed from the data itself, every time, so what
-- the seller is told is always true. The only thing kept in a table is which
-- optional suggestions they have waved away.

create table public.onboarding_dismissals (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  task_key text not null,
  dismissed_at timestamptz not null default now(),
  dismissed_by uuid,

  constraint onboarding_dismissals_key_check
    check (task_key ~ '^[a-z][a-z0-9_]{2,40}$')
);

comment on table public.onboarding_dismissals is
  'Optional setup suggestions a seller has chosen to hide.';

create unique index onboarding_dismissals_unique
  on public.onboarding_dismissals (company_id, task_key);

-- -----------------------------------------------------------------------------
-- Where this seller has got to
-- -----------------------------------------------------------------------------

create or replace function public.company_onboarding_state(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_company public.companies%rowtype;
  v_profile public.company_profiles%rowtype;
  v_has_payout boolean;
  v_has_client boolean;
  v_has_invoice boolean;
  v_has_payment boolean;
  v_has_proof boolean;
  v_has_logo boolean;
  v_has_own_storage boolean;
  v_has_two_factor boolean;
  v_required integer := 0;
  v_done integer := 0;
  v_tasks jsonb := '[]'::jsonb;
  v_dismissed text[];
begin
  select * into v_company
    from public.companies
   where id = p_company_id
     and deleted_at is null;

  if not found then
    raise exception 'That business was not found' using errcode = 'P0002';
  end if;

  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You do not have permission to read this account'
      using errcode = '42501';
  end if;

  select * into v_profile
    from public.company_profiles
   where company_id = p_company_id;

  select coalesce(array_agg(task_key), array[]::text[])
    into v_dismissed
    from public.onboarding_dismissals
   where company_id = p_company_id;

  select exists (
    select 1 from public.payout_accounts as a
      join public.wallets as w on w.id = a.wallet_id
     where w.company_id = p_company_id
       and a.deleted_at is null
  ) into v_has_payout;

  select exists (
    select 1 from public.clients
     where company_id = p_company_id and deleted_at is null
  ) into v_has_client;

  select exists (
    select 1 from public.invoices
     where company_id = p_company_id
       and deleted_at is null
       and invoice_number is not null
  ) into v_has_invoice;

  select exists (
    select 1 from public.payments
     where company_id = p_company_id
       and deleted_at is null
       and status = 'succeeded'
  ) into v_has_payment;

  select exists (
    select 1 from public.invoice_work_evidence
     where company_id = p_company_id and deleted_at is null
  ) into v_has_proof;

  select exists (
    select 1 from public.storage_targets
     where company_id = p_company_id and deleted_at is null and is_active
  ) into v_has_own_storage;

  v_has_logo := v_profile.logo_url is not null;

  select exists (
    select 1 from public.users
     where company_id = p_company_id
       and deleted_at is null
       and two_factor_enabled
  ) into v_has_two_factor;

  -- The five that stand between signing up and being paid.
  v_tasks := v_tasks || jsonb_build_object(
    'key', 'business_details',
    'title', 'Tell us about your business',
    'description', 'The name and address that appear on every invoice you send.',
    'href', '/dashboard/settings/company',
    'is_required', true,
    'is_done', v_profile.company_id is not null
                 and coalesce(btrim(v_profile.legal_name), '') <> ''
                 and coalesce(btrim(v_profile.address_line1), '') <> ''
                 and v_profile.email is not null
  );

  v_tasks := v_tasks || jsonb_build_object(
    'key', 'identity_check',
    'title', 'Verify your identity',
    'description', 'Required before we can hold money on your behalf or send it to you.',
    'href', '/dashboard/settings/verification',
    'is_required', true,
    'is_done', v_company.kyc_status = 'verified'
  );

  v_tasks := v_tasks || jsonb_build_object(
    'key', 'payout_destination',
    'title', 'Say where your money should go',
    'description', 'The bank or wallet we send your balance to when you withdraw.',
    'href', '/dashboard/payouts',
    'is_required', true,
    'is_done', v_has_payout
  );

  v_tasks := v_tasks || jsonb_build_object(
    'key', 'first_client',
    'title', 'Add your first client',
    'description', 'Who you are billing, and where their invoice should be sent.',
    'href', '/dashboard/clients/new',
    'is_required', true,
    'is_done', v_has_client
  );

  v_tasks := v_tasks || jsonb_build_object(
    'key', 'first_invoice',
    'title', 'Send your first invoice',
    'description', 'Your client pays by card on a page with your name on it.',
    'href', '/dashboard/invoices/new',
    'is_required', true,
    'is_done', v_has_invoice
  );

  -- Worth doing, but nobody is stopped from trading without them.
  v_tasks := v_tasks || jsonb_build_object(
    'key', 'attach_proof',
    'title', 'Attach proof of your work',
    'description', 'Clients who can see the delivered work pay sooner and dispute less.',
    'href', '/dashboard/invoices',
    'is_required', false,
    'is_done', v_has_proof
  );

  v_tasks := v_tasks || jsonb_build_object(
    'key', 'upload_logo',
    'title', 'Put your logo on your invoices',
    'description', 'It appears on new invoices only, so nothing already sent changes.',
    'href', '/dashboard/settings/branding',
    'is_required', false,
    'is_done', v_has_logo
  );

  v_tasks := v_tasks || jsonb_build_object(
    'key', 'connect_storage',
    'title', 'Keep your documents in your own drive',
    'description', 'Receipts and contracts stay in an account you own.',
    'href', '/dashboard/settings/storage',
    'is_required', false,
    'is_done', v_has_own_storage
  );

  v_tasks := v_tasks || jsonb_build_object(
    'key', 'protect_account',
    'title', 'Turn on two step sign in',
    'description', 'Your account holds money. A password on its own is not enough.',
    'href', '/dashboard/settings/security',
    'is_required', false,
    'is_done', v_has_two_factor
  );

  select count(*) filter (where (task ->> 'is_required')::boolean),
         count(*) filter (where (task ->> 'is_required')::boolean
                            and (task ->> 'is_done')::boolean)
    into v_required, v_done
    from jsonb_array_elements(v_tasks) as task;

  return jsonb_build_object(
    'company_id', p_company_id,
    'status', v_company.status::text,
    'kyc_status', v_company.kyc_status::text,
    'required_count', v_required,
    'required_done', v_done,
    'is_ready_to_trade', v_done = v_required,
    'has_first_payment', v_has_payment,
    'dismissed', to_jsonb(v_dismissed),
    'tasks', v_tasks
  );
end;
$$;

comment on function public.company_onboarding_state(uuid) is
  'Works out from the data itself what a new seller still has to do before being paid.';

-- -----------------------------------------------------------------------------
-- Hiding a suggestion, and crossing the line into trading
-- -----------------------------------------------------------------------------

create or replace function public.dismiss_onboarding_task(
  p_company_id uuid,
  p_task_key text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.can_write_company_data(p_company_id)) then
    raise exception 'You do not have permission to change this account'
      using errcode = '42501';
  end if;

  insert into public.onboarding_dismissals (company_id, task_key, dismissed_by)
  values (p_company_id, p_task_key, public.current_user_id())
  on conflict (company_id, task_key) do nothing;

  return true;
end;
$$;

comment on function public.dismiss_onboarding_task(uuid, text) is
  'Hides one optional setup suggestion for a seller.';

create or replace function public.restore_onboarding_task(
  p_company_id uuid,
  p_task_key text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.can_write_company_data(p_company_id)) then
    raise exception 'You do not have permission to change this account'
      using errcode = '42501';
  end if;

  delete from public.onboarding_dismissals
   where company_id = p_company_id
     and task_key = p_task_key;

  return found;
end;
$$;

comment on function public.restore_onboarding_task(uuid, text) is
  'Brings back a setup suggestion the seller had hidden.';

-- A business stops being in onboarding the moment it can actually trade,
-- which is a fact about its data rather than a button somebody presses.
create or replace function public.activate_ready_company(p_company_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_state jsonb;
begin
  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You do not have permission to change this account'
      using errcode = '42501';
  end if;

  v_state := public.company_onboarding_state(p_company_id);

  if not (v_state ->> 'is_ready_to_trade')::boolean then
    return false;
  end if;

  update public.companies
     set status = 'active',
         activated_at = coalesce(activated_at, now()),
         updated_at = now()
   where id = p_company_id
     and status = 'onboarding'
     and deleted_at is null;

  return found;
end;
$$;

comment on function public.activate_ready_company(uuid) is
  'Moves a business out of onboarding once everything needed to trade is in place.';

-- What the platform team watches: who signed up and got stuck, and where.
create or replace function public.onboarding_funnel(p_days integer default 30)
returns table (
  company_id uuid,
  company_name text,
  signed_up_at timestamptz,
  status public.company_status,
  required_done integer,
  required_count integer,
  stuck_on text,
  has_first_payment boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may read the signup funnel'
      using errcode = '42501';
  end if;

  return query
    select c.id,
           c.legal_name,
           c.created_at,
           c.status,
           (s.state ->> 'required_done')::int,
           (s.state ->> 'required_count')::int,
           (
             select task ->> 'title'
               from jsonb_array_elements(s.state -> 'tasks') as task
              where (task ->> 'is_required')::boolean
                and not (task ->> 'is_done')::boolean
              limit 1
           ),
           (s.state ->> 'has_first_payment')::boolean
      from public.companies as c
      cross join lateral (
        select public.company_onboarding_state(c.id) as state
      ) as s
     where c.deleted_at is null
       and c.created_at >= now() - make_interval(days => greatest(coalesce(p_days, 30), 1))
     order by c.created_at desc;
end;
$$;

comment on function public.onboarding_funnel(integer) is
  'Shows which new sellers are stuck and on which step.';

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.onboarding_dismissals enable row level security;
alter table public.onboarding_dismissals force row level security;

create policy onboarding_dismissals_select on public.onboarding_dismissals
  for select to authenticated
  using (public.has_company_access(company_id));

grant select on public.onboarding_dismissals to authenticated;

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.company_onboarding_state(uuid)
  from public, authenticated;
revoke execute on function public.dismiss_onboarding_task(uuid, text)
  from public, authenticated;
revoke execute on function public.restore_onboarding_task(uuid, text)
  from public, authenticated;
revoke execute on function public.activate_ready_company(uuid)
  from public, authenticated;
revoke execute on function public.onboarding_funnel(integer)
  from public, authenticated;

grant execute on function public.company_onboarding_state(uuid)
  to authenticated, service_role;
grant execute on function public.dismiss_onboarding_task(uuid, text)
  to authenticated, service_role;
grant execute on function public.restore_onboarding_task(uuid, text)
  to authenticated, service_role;
grant execute on function public.activate_ready_company(uuid)
  to authenticated, service_role;
grant execute on function public.onboarding_funnel(integer)
  to authenticated, service_role;

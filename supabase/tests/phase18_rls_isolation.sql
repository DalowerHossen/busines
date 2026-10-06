-- supabase/tests/phase18_rls_isolation.sql
-- Run this file inside a disposable Supabase/Postgres test database with a
-- privileged database role. The transaction is rolled back at the end, so
-- no fixture survives the test. Phase 20 will add the application repository
-- tests that exercise these same boundaries through Supabase clients.

begin;

create temporary table phase18_test_ids (
  owner_one uuid not null,
  owner_two uuid not null,
  accountant uuid not null,
  company_one uuid not null,
  company_two uuid not null,
  client_one uuid not null,
  client_two uuid not null
) on commit drop;

insert into phase18_test_ids values (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000103',
  '10000000-0000-0000-0000-000000000101',
  '10000000-0000-0000-0000-000000000102',
  '20000000-0000-0000-0000-000000000101',
  '20000000-0000-0000-0000-000000000102'
);

-- The fixture uses the standard Supabase auth.users columns. A disposable
-- test project may already have these IDs; conflict handling keeps the test
-- repeatable when it is run more than once in the same database.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  '00000000-0000-0000-0000-000000000000',
  ids.user_id,
  'authenticated',
  'authenticated',
  ids.email,
  '',
  now(),
  jsonb_build_object('full_name', ids.full_name),
  now(),
  now()
from (
  values
    ('00000000-0000-0000-0000-000000000101'::uuid, 'phase18-owner-one@example.test', 'Phase 18 Owner One'),
    ('00000000-0000-0000-0000-000000000102'::uuid, 'phase18-owner-two@example.test', 'Phase 18 Owner Two'),
    ('00000000-0000-0000-0000-000000000103'::uuid, 'phase18-accountant@example.test', 'Phase 18 Accountant')
) as ids(user_id, email, full_name)
on conflict (id) do nothing;

insert into public.companies (id, owner_user_id, name, slug)
select ids.company_id, ids.owner_id, ids.name, ids.slug
from (
  values
    (
      '10000000-0000-0000-0000-000000000101'::uuid,
      '00000000-0000-0000-0000-000000000101'::uuid,
      'Phase 18 Company One',
      'phase18-company-one'
    ),
    (
      '10000000-0000-0000-0000-000000000102'::uuid,
      '00000000-0000-0000-0000-000000000102'::uuid,
      'Phase 18 Company Two',
      'phase18-company-two'
    )
) as ids(company_id, owner_id, name, slug)
on conflict (id) do nothing;

insert into public.accountant_company_access (
  company_id,
  accountant_user_id,
  invited_by_user_id,
  is_active
)
select
  '10000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000101',
  true
where not exists (
  select 1
  from public.accountant_company_access
  where company_id = '10000000-0000-0000-0000-000000000101'
    and accountant_user_id = '00000000-0000-0000-0000-000000000103'
);

insert into public.clients (id, company_id, display_name, email)
values
  (
    '20000000-0000-0000-0000-000000000101',
    '10000000-0000-0000-0000-000000000101',
    'Phase 18 Client One',
    'phase18-client-one@example.test'
  ),
  (
    '20000000-0000-0000-0000-000000000102',
    '10000000-0000-0000-0000-000000000102',
    'Phase 18 Client Two',
    'phase18-client-two@example.test'
  )
on conflict (id) do nothing;

insert into public.expense_categories (company_id, name)
values
  ('10000000-0000-0000-0000-000000000101', 'Phase 18 Category One'),
  ('10000000-0000-0000-0000-000000000102', 'Phase 18 Category Two');

insert into public.product_categories (company_id, name)
values
  ('10000000-0000-0000-0000-000000000101', 'Phase 18 Product Category One'),
  ('10000000-0000-0000-0000-000000000102', 'Phase 18 Product Category Two');

insert into public.projects (
  company_id,
  project_code,
  name,
  created_by_user_id
)
values
  (
    '10000000-0000-0000-0000-000000000101',
    'P18-ONE',
    'Phase 18 Project One',
    '00000000-0000-0000-0000-000000000101'
  ),
  (
    '10000000-0000-0000-0000-000000000102',
    'P18-TWO',
    'Phase 18 Project Two',
    '00000000-0000-0000-0000-000000000102'
  );

-- Owner One can see only Company One through both Phase 17 and Phase 18.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000101',
  true
);

do $$
declare
  visible_clients integer;
  visible_expense_categories integer;
  visible_product_categories integer;
  visible_projects integer;
begin
  select count(*) into visible_clients from public.clients;
  select count(*) into visible_expense_categories from public.expense_categories;
  select count(*) into visible_product_categories from public.product_categories;
  select count(*) into visible_projects from public.projects;

  if visible_clients <> 1 then
    raise exception 'cross-tenant client isolation failed: expected 1 row, got %', visible_clients;
  end if;
  if visible_expense_categories <> 1 then
    raise exception 'cross-tenant accounting isolation failed: expected 1 row, got %', visible_expense_categories;
  end if;
  if visible_product_categories <> 1 then
    raise exception 'cross-tenant inventory isolation failed: expected 1 row, got %', visible_product_categories;
  end if;
  if visible_projects <> 1 then
    raise exception 'cross-tenant project isolation failed: expected 1 row, got %', visible_projects;
  end if;
end;
$$;

-- An owner cannot insert a Phase 18 row into another company.
do $$
begin
  begin
    insert into public.expense_categories (company_id, name)
    values ('10000000-0000-0000-0000-000000000102', 'Cross-tenant write must fail');
    raise exception 'cross-tenant write unexpectedly succeeded';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

-- The accountant delegation can read Company One accounting data but still
-- cannot read Company Two, and has no access to the owner-only project domain.
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000103',
  true
);

do $$
declare
  visible_expense_categories integer;
  visible_projects integer;
begin
  select count(*) into visible_expense_categories from public.expense_categories;
  select count(*) into visible_projects from public.projects;

  if visible_expense_categories <> 1 then
    raise exception 'accountant company isolation failed: expected 1 row, got %', visible_expense_categories;
  end if;
  if visible_projects <> 0 then
    raise exception 'accountant owner-only project boundary failed: got % rows', visible_projects;
  end if;
end;
$$;

rollback;

select 'Phase 18 RLS isolation test passed.' as result;

-- supabase/tests/phase19_functions.sql
-- Run after `supabase db reset` in a disposable Supabase/Postgres database.
-- The transaction is rolled back, so the fixture does not survive the test.
-- Run supabase/seed.sql twice before this file when validating seed
-- idempotency; every deterministic seed row must remain single-instance.

begin;

-- The migration must have installed timestamp maintenance on all applicable
-- tables, including a table created before Phase 19.
do $$
declare
  v_missing integer;
begin
  select count(*) into v_missing
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.column_name = 'updated_at'
    and not exists (
      select 1
      from pg_trigger t
      join pg_class r on r.oid = t.tgrelid
      join pg_namespace n on n.oid = r.relnamespace
      where n.nspname = 'public'
        and r.relname = c.table_name
        and t.tgname = 'set_' || c.table_name || '_updated_at'
        and not t.tgenabled = 'D'
    );
  if v_missing <> 0 then
    raise exception 'Phase 19 updated_at trigger coverage failed for % tables', v_missing;
  end if;
end;
$$;

-- Invoice numbering is generated inside the insert transaction and consumes
-- the company profile counter exactly once.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000001901',
  'authenticated', 'authenticated', 'phase19-owner@example.test', '', now(),
  '{"full_name":"Phase 19 Owner"}'::jsonb, now(), now()
) on conflict (id) do nothing;

insert into public.companies (id, owner_user_id, name, slug)
values (
  '10000000-0000-0000-0000-000000001901',
  '00000000-0000-0000-0000-000000001901',
  'Phase 19 Company', 'phase19-company'
) on conflict (id) do nothing;

insert into public.company_profiles (company_id, invoice_prefix, next_invoice_sequence)
values ('10000000-0000-0000-0000-000000001901', 'P19', 1)
on conflict (company_id) do nothing;

insert into public.clients (id, company_id, display_name, email)
values (
  '20000000-0000-0000-0000-000000001901',
  '10000000-0000-0000-0000-000000001901',
  'Phase 19 Client', 'phase19-client@example.test'
) on conflict (id) do nothing;

insert into public.company_profile_snapshots (id, company_id, company_name)
values (
  '00000000-0000-0000-0000-000000001902',
  '10000000-0000-0000-0000-000000001901',
  'Phase 19 Company'
) on conflict (id) do nothing;

do $$
declare
  v_invoice_id uuid := '30000000-0000-0000-0000-000000001901';
  v_invoice_number text;
  v_sequence integer;
begin
  insert into public.invoices (
    id, company_id, client_id, invoice_number, status,
    company_profile_snapshot_id, client_snapshot_display_name,
    client_snapshot_email, due_date, created_by_user_id
  ) values (
    v_invoice_id,
    '10000000-0000-0000-0000-000000001901',
    '20000000-0000-0000-0000-000000001901',
    null, 'draft', '00000000-0000-0000-0000-000000001902',
    'Phase 19 Client', 'phase19-client@example.test', current_date + 30,
    '00000000-0000-0000-0000-000000001901'
  );
  select invoice_number into v_invoice_number
  from public.invoices where id = v_invoice_id;
  if v_invoice_number <> 'P19-000001' then
    raise exception 'Invoice number trigger returned %', v_invoice_number;
  end if;
  select next_invoice_sequence into v_sequence
  from public.company_profiles
  where company_id = '10000000-0000-0000-0000-000000001901';
  if v_sequence <> 2 then
    raise exception 'Invoice sequence counter returned %', v_sequence;
  end if;
end;
$$;

-- Stock updates lock the level row and reject a stale quantity_before.
insert into public.products (id, company_id, name, track_inventory)
values (
  '00000000-0000-0000-0000-000000001903',
  '10000000-0000-0000-0000-000000001901',
  'Phase 19 Product', true
) on conflict (id) do nothing;
insert into public.warehouses (id, company_id, name, code)
values (
  '00000000-0000-0000-0000-000000001904',
  '10000000-0000-0000-0000-000000001901',
  'Phase 19 Warehouse', 'P19'
) on conflict (id) do nothing;
insert into public.stock_movements (
  id, company_id, warehouse_id, product_id, movement_type,
  quantity_delta, quantity_before, quantity_after
) values (
  '00000000-0000-0000-0000-000000001905',
  '10000000-0000-0000-0000-000000001901',
  '00000000-0000-0000-0000-000000001904',
  '00000000-0000-0000-0000-000000001903',
  'opening_balance', 5, 0, 5
);

do $$
begin
  begin
    insert into public.stock_movements (
      id, company_id, warehouse_id, product_id, movement_type,
      quantity_delta, quantity_before, quantity_after
    ) values (
      '00000000-0000-0000-0000-000000001906',
      '10000000-0000-0000-0000-000000001901',
      '00000000-0000-0000-0000-000000001904',
      '00000000-0000-0000-0000-000000001903',
      'adjustment_increase', 2, 0, 2
    );
    raise exception 'stale stock movement was accepted';
  exception when others then
    if sqlerrm not like '%stale quantity_before%' then
      raise;
    end if;
  end;
end;
$$;

insert into public.client_credit_balance_entries (
  id, company_id, client_id, reason, amount, currency_code, created_by_user_id
) values (
  '00000000-0000-0000-0000-000000001907',
  '10000000-0000-0000-0000-000000001901',
  '20000000-0000-0000-0000-000000001901',
  'manual_adjustment', 125.50, 'USD',
  '00000000-0000-0000-0000-000000001901'
);

do $$
begin
  if public.calculate_client_credit_balance('20000000-0000-0000-0000-000000001901') <> 125.50 then
    raise exception 'client credit calculation failed';
  end if;
end;
$$;

-- A versioned company policy is the only source for late-fee calculation.
insert into public.system_settings (scope, company_id, key, value_plain)
values (
  'company', '10000000-0000-0000-0000-000000001901', 'invoice_late_fee_policy',
  '{"policy_version":"phase19-test-1","enabled":true,"type":"percent","rate_percent":10,"fixed_amount":0}'::jsonb
) on conflict do nothing;
update public.invoices
set status = 'sent', due_date = current_date - 2, amount_due = 100, total_amount = 100
where id = '30000000-0000-0000-0000-000000001901';

select public.mark_overdue_invoices(current_date);
do $$
begin
  if (select status from public.invoices where id = '30000000-0000-0000-0000-000000001901') <> 'overdue' then
    raise exception 'overdue status transition failed';
  end if;
  if (select late_fee_amount from public.invoices where id = '30000000-0000-0000-0000-000000001901') <> 10 then
    raise exception 'late-fee calculation failed';
  end if;
  if (select count(*) from public.audit_logs where entity_id = '30000000-0000-0000-0000-000000001901') = 0 then
    raise exception 'audit trigger did not record invoice changes';
  end if;
end;
$$;

rollback;

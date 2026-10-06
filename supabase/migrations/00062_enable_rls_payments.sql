-- supabase/migrations/00062_enable_rls_payments.sql
-- Row level security for the payment module.
--
-- Two rules shape this file. Money records follow the usual tenancy guard.
-- Credentials are stricter: a gateway secret is readable by the owner of the
-- tenant it belongs to and by the platform team, never by staff, accountants
-- or resellers, and platform gateways are visible to the platform alone.

alter table public.payment_gateways enable row level security;
alter table public.gateway_availability enable row level security;
alter table public.client_payment_methods enable row level security;
alter table public.payment_intents enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.refunds enable row level security;
alter table public.disputes enable row level security;
alter table public.dispute_evidence_items enable row level security;
alter table public.webhook_events enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.payout_accounts enable row level security;
alter table public.payouts enable row level security;

alter table public.payment_gateways force row level security;
alter table public.gateway_availability force row level security;
alter table public.client_payment_methods force row level security;
alter table public.payment_intents force row level security;
alter table public.payments force row level security;
alter table public.payment_allocations force row level security;
alter table public.payment_receipts force row level security;
alter table public.refunds force row level security;
alter table public.disputes force row level security;
alter table public.dispute_evidence_items force row level security;
alter table public.webhook_events force row level security;
alter table public.wallets force row level security;
alter table public.wallet_transactions force row level security;
alter table public.payout_accounts force row level security;
alter table public.payouts force row level security;

select public.install_tenant_policies('payments');
select public.install_tenant_policies('refunds');
select public.install_tenant_policies('disputes');
select public.install_tenant_policies('payment_receipts');
select public.install_tenant_policies('client_payment_methods');

-- -----------------------------------------------------------------------------
-- Gateway credentials
-- -----------------------------------------------------------------------------

create policy payment_gateways_select on public.payment_gateways
  for select to authenticated
  using (
    deleted_at is null
    and (
      public.is_super_admin()
      or (owner_type = 'company' and company_id is not null
          and public.is_company_owner(company_id))
    )
  );

create policy payment_gateways_insert on public.payment_gateways
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (owner_type = 'company' and company_id is not null
        and public.is_company_owner(company_id))
  );

create policy payment_gateways_update on public.payment_gateways
  for update to authenticated
  using (
    deleted_at is null
    and (
      public.is_super_admin()
      or (owner_type = 'company' and company_id is not null
          and public.is_company_owner(company_id))
    )
  )
  with check (
    public.is_super_admin()
    or (owner_type = 'company' and company_id is not null
        and public.is_company_owner(company_id))
  );

comment on policy payment_gateways_select on public.payment_gateways is
  'Only the platform team and the tenant owner may see gateway credentials.';

-- Which providers a tenant accepts is ordinary settings data.
create policy gateway_availability_select on public.gateway_availability
  for select to authenticated
  using (public.has_company_access(company_id));

create policy gateway_availability_insert on public.gateway_availability
  for insert to authenticated
  with check (public.is_company_owner(company_id) or public.is_super_admin());

create policy gateway_availability_update on public.gateway_availability
  for update to authenticated
  using (public.is_company_owner(company_id) or public.is_super_admin())
  with check (public.is_company_owner(company_id) or public.is_super_admin());

-- -----------------------------------------------------------------------------
-- Payments and their satellites
-- -----------------------------------------------------------------------------

create policy payment_intents_select on public.payment_intents
  for select to authenticated
  using (public.has_company_access(company_id));

create policy payment_intents_insert on public.payment_intents
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy payment_allocations_select on public.payment_allocations
  for select to authenticated
  using (public.has_company_access(company_id));

create policy payment_allocations_insert on public.payment_allocations
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy dispute_evidence_select on public.dispute_evidence_items
  for select to authenticated
  using (public.has_company_access(company_id));

create policy dispute_evidence_insert on public.dispute_evidence_items
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

-- Raw webhooks belong to the platform. They may contain provider level detail
-- about several tenants and are reviewed by the platform team alone.
create policy webhook_events_select on public.webhook_events
  for select to authenticated
  using (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- Wallets and payouts
-- -----------------------------------------------------------------------------

-- A wallet is visible to the party it belongs to: the tenant owner, the
-- reseller or the individual, plus the platform team.
create policy wallets_select on public.wallets
  for select to authenticated
  using (
    deleted_at is null
    and (
      public.is_super_admin()
      or (company_id is not null and public.has_company_access(company_id))
      or (user_id is not null and user_id = public.current_user_id())
      or (reseller_id is not null and exists (
            select 1
              from public.resellers as r
             where r.id = reseller_id
               and r.user_id = public.current_user_id()
          ))
    )
  );

create policy wallets_update on public.wallets
  for update to authenticated
  using (
    deleted_at is null
    and (
      public.is_super_admin()
      or (company_id is not null and public.is_company_owner(company_id))
    )
  )
  with check (
    public.is_super_admin()
    or (company_id is not null and public.is_company_owner(company_id))
  );

create policy wallet_transactions_select on public.wallet_transactions
  for select to authenticated
  using (
    exists (
      select 1
        from public.wallets as w
       where w.id = wallet_id
         and (
           public.is_super_admin()
           or (w.company_id is not null and public.has_company_access(w.company_id))
           or (w.user_id is not null and w.user_id = public.current_user_id())
           or (w.reseller_id is not null and exists (
                 select 1
                   from public.resellers as r
                  where r.id = w.reseller_id
                    and r.user_id = public.current_user_id()
               ))
         )
    )
  );

create policy payout_accounts_select on public.payout_accounts
  for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1
        from public.wallets as w
       where w.id = wallet_id
         and (
           public.is_super_admin()
           or (w.company_id is not null and public.is_company_owner(w.company_id))
           or (w.user_id is not null and w.user_id = public.current_user_id())
           or (w.reseller_id is not null and exists (
                 select 1
                   from public.resellers as r
                  where r.id = w.reseller_id
                    and r.user_id = public.current_user_id()
               ))
         )
    )
  );

create policy payout_accounts_insert on public.payout_accounts
  for insert to authenticated
  with check (
    exists (
      select 1
        from public.wallets as w
       where w.id = wallet_id
         and (
           public.is_super_admin()
           or (w.company_id is not null and public.is_company_owner(w.company_id))
           or (w.user_id is not null and w.user_id = public.current_user_id())
         )
    )
  );

create policy payout_accounts_update on public.payout_accounts
  for update to authenticated
  using (
    deleted_at is null
    and exists (
      select 1
        from public.wallets as w
       where w.id = wallet_id
         and (
           public.is_super_admin()
           or (w.company_id is not null and public.is_company_owner(w.company_id))
           or (w.user_id is not null and w.user_id = public.current_user_id())
         )
    )
  )
  with check (true);

create policy payouts_select on public.payouts
  for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1
        from public.wallets as w
       where w.id = wallet_id
         and (
           public.is_super_admin()
           or (w.company_id is not null and public.has_company_access(w.company_id))
           or (w.user_id is not null and w.user_id = public.current_user_id())
           or (w.reseller_id is not null and exists (
                 select 1
                   from public.resellers as r
                  where r.id = w.reseller_id
                    and r.user_id = public.current_user_id()
               ))
         )
    )
  );

-- Payouts are requested through a routine that checks the balance, the hold
-- window and the threshold, so no direct insert is allowed from a session.
create policy payouts_update on public.payouts
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

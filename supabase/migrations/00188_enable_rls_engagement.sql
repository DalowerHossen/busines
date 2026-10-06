-- supabase/migrations/00188_enable_rls_engagement.sql
-- Row level security for messaging, bank feeds, receipts, plans and points.
--
-- Everything here is tenant data. Bank feed tokens and messaging credentials
-- are never selectable at all, and the policies below are only the first of
-- the two gates; the column grants in the next file are the second.

alter table public.messaging_channels enable row level security;
alter table public.contact_channel_identities enable row level security;
alter table public.channel_suppressions enable row level security;
alter table public.message_routes enable row level security;
alter table public.message_route_steps enable row level security;
alter table public.message_route_runs enable row level security;
alter table public.inbound_messages enable row level security;
alter table public.bank_feed_connections enable row level security;
alter table public.bank_feed_accounts enable row level security;
alter table public.bank_feed_syncs enable row level security;
alter table public.bank_transaction_splits enable row level security;
alter table public.reconciliation_memory enable row level security;
alter table public.receipt_scans enable row level security;
alter table public.receipt_scan_lines enable row level security;
alter table public.instalment_offers enable row level security;
alter table public.instalment_plans enable row level security;
alter table public.instalment_schedule_items enable row level security;
alter table public.loyalty_programs enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.loyalty_rewards enable row level security;
alter table public.loyalty_redemptions enable row level security;

alter table public.messaging_channels force row level security;
alter table public.contact_channel_identities force row level security;
alter table public.channel_suppressions force row level security;
alter table public.message_routes force row level security;
alter table public.message_route_steps force row level security;
alter table public.message_route_runs force row level security;
alter table public.inbound_messages force row level security;
alter table public.bank_feed_connections force row level security;
alter table public.bank_feed_accounts force row level security;
alter table public.bank_feed_syncs force row level security;
alter table public.bank_transaction_splits force row level security;
alter table public.reconciliation_memory force row level security;
alter table public.receipt_scans force row level security;
alter table public.receipt_scan_lines force row level security;
alter table public.instalment_offers force row level security;
alter table public.instalment_plans force row level security;
alter table public.instalment_schedule_items force row level security;
alter table public.loyalty_programs force row level security;
alter table public.loyalty_accounts force row level security;
alter table public.loyalty_transactions force row level security;
alter table public.loyalty_rewards force row level security;
alter table public.loyalty_redemptions force row level security;

-- -----------------------------------------------------------------------------
-- Messaging
-- -----------------------------------------------------------------------------

create policy messaging_channels_select on public.messaging_channels
  for select to authenticated
  using (
    public.is_super_admin()
    or (company_id is null and deleted_at is null)
    or public.has_company_access(company_id)
  );

create policy messaging_channels_insert on public.messaging_channels
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (company_id is not null and public.is_company_owner(company_id))
  );

create policy messaging_channels_update on public.messaging_channels
  for update to authenticated
  using (
    public.is_super_admin()
    or (company_id is not null and public.is_company_owner(company_id))
  )
  with check (
    public.is_super_admin()
    or (company_id is not null and public.is_company_owner(company_id))
  );

create policy contact_channel_identities_select
  on public.contact_channel_identities
  for select to authenticated
  using (public.is_super_admin() or public.has_company_access(company_id));

create policy contact_channel_identities_insert
  on public.contact_channel_identities
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy contact_channel_identities_update
  on public.contact_channel_identities
  for update to authenticated
  using (public.can_write_company_data(company_id))
  with check (public.can_write_company_data(company_id));

create policy channel_suppressions_select on public.channel_suppressions
  for select to authenticated
  using (
    public.is_super_admin()
    or company_id is null
    or public.has_company_access(company_id)
  );

create policy message_routes_select on public.message_routes
  for select to authenticated
  using (
    public.is_super_admin()
    or (company_id is null and deleted_at is null)
    or public.has_company_access(company_id)
  );

create policy message_routes_insert on public.message_routes
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (company_id is not null and public.is_company_owner(company_id))
  );

create policy message_routes_update on public.message_routes
  for update to authenticated
  using (
    public.is_super_admin()
    or (company_id is not null and public.is_company_owner(company_id))
  )
  with check (
    public.is_super_admin()
    or (company_id is not null and public.is_company_owner(company_id))
  );

create policy message_route_steps_select on public.message_route_steps
  for select to authenticated
  using (
    exists (
      select 1
        from public.message_routes as r
       where r.id = route_id
         and (public.is_super_admin()
              or r.company_id is null
              or public.has_company_access(r.company_id))
    )
  );

create policy message_route_steps_write on public.message_route_steps
  for all to authenticated
  using (
    exists (
      select 1
        from public.message_routes as r
       where r.id = route_id
         and r.company_id is not null
         and public.is_company_owner(r.company_id)
    )
  )
  with check (
    exists (
      select 1
        from public.message_routes as r
       where r.id = route_id
         and r.company_id is not null
         and public.is_company_owner(r.company_id)
    )
  );

create policy message_route_runs_select on public.message_route_runs
  for select to authenticated
  using (public.is_super_admin() or public.has_company_access(company_id));

create policy inbound_messages_select on public.inbound_messages
  for select to authenticated
  using (
    public.is_super_admin()
    or (company_id is not null and public.has_company_access(company_id))
  );

create policy inbound_messages_update on public.inbound_messages
  for update to authenticated
  using (company_id is not null and public.can_write_company_data(company_id))
  with check (company_id is not null and public.can_write_company_data(company_id));

-- -----------------------------------------------------------------------------
-- Bank feeds
-- -----------------------------------------------------------------------------

create policy bank_feed_connections_select on public.bank_feed_connections
  for select to authenticated
  using (public.is_super_admin() or public.has_company_access(company_id));

create policy bank_feed_connections_update on public.bank_feed_connections
  for update to authenticated
  using (public.is_company_owner(company_id))
  with check (public.is_company_owner(company_id));

create policy bank_feed_accounts_select on public.bank_feed_accounts
  for select to authenticated
  using (public.is_super_admin() or public.has_company_access(company_id));

create policy bank_feed_accounts_update on public.bank_feed_accounts
  for update to authenticated
  using (public.is_company_owner(company_id))
  with check (public.is_company_owner(company_id));

create policy bank_feed_syncs_select on public.bank_feed_syncs
  for select to authenticated
  using (public.is_super_admin() or public.has_company_access(company_id));

create policy bank_transaction_splits_select on public.bank_transaction_splits
  for select to authenticated
  using (public.is_super_admin() or public.has_company_access(company_id));

create policy bank_transaction_splits_write on public.bank_transaction_splits
  for all to authenticated
  using (public.can_write_company_data(company_id))
  with check (public.can_write_company_data(company_id));

create policy reconciliation_memory_select on public.reconciliation_memory
  for select to authenticated
  using (public.is_super_admin() or public.has_company_access(company_id));

create policy reconciliation_memory_write on public.reconciliation_memory
  for all to authenticated
  using (public.can_write_company_data(company_id))
  with check (public.can_write_company_data(company_id));

-- -----------------------------------------------------------------------------
-- Receipts
-- -----------------------------------------------------------------------------

create policy receipt_scans_select on public.receipt_scans
  for select to authenticated
  using (public.is_super_admin() or public.has_company_access(company_id));

create policy receipt_scans_insert on public.receipt_scans
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy receipt_scans_update on public.receipt_scans
  for update to authenticated
  using (public.can_write_company_data(company_id))
  with check (public.can_write_company_data(company_id));

create policy receipt_scan_lines_select on public.receipt_scan_lines
  for select to authenticated
  using (
    exists (
      select 1
        from public.receipt_scans as s
       where s.id = scan_id
         and (public.is_super_admin() or public.has_company_access(s.company_id))
    )
  );

create policy receipt_scan_lines_update on public.receipt_scan_lines
  for update to authenticated
  using (
    exists (
      select 1
        from public.receipt_scans as s
       where s.id = scan_id and public.can_write_company_data(s.company_id)
    )
  )
  with check (
    exists (
      select 1
        from public.receipt_scans as s
       where s.id = scan_id and public.can_write_company_data(s.company_id)
    )
  );

-- -----------------------------------------------------------------------------
-- Instalments
-- -----------------------------------------------------------------------------

create policy instalment_offers_select on public.instalment_offers
  for select to authenticated
  using (
    public.is_super_admin()
    or (company_id is null and is_active and deleted_at is null)
    or public.has_company_access(company_id)
  );

create policy instalment_offers_insert on public.instalment_offers
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (company_id is not null and public.is_company_owner(company_id))
  );

create policy instalment_offers_update on public.instalment_offers
  for update to authenticated
  using (
    public.is_super_admin()
    or (company_id is not null and public.is_company_owner(company_id))
  )
  with check (
    public.is_super_admin()
    or (company_id is not null and public.is_company_owner(company_id))
  );

create policy instalment_plans_select on public.instalment_plans
  for select to authenticated
  using (public.is_super_admin() or public.has_company_access(company_id));

create policy instalment_schedule_items_select
  on public.instalment_schedule_items
  for select to authenticated
  using (public.is_super_admin() or public.has_company_access(company_id));

-- -----------------------------------------------------------------------------
-- Loyalty
-- -----------------------------------------------------------------------------

create policy loyalty_programs_select on public.loyalty_programs
  for select to authenticated
  using (public.is_super_admin() or public.has_company_access(company_id));

create policy loyalty_programs_insert on public.loyalty_programs
  for insert to authenticated
  with check (public.is_company_owner(company_id));

create policy loyalty_programs_update on public.loyalty_programs
  for update to authenticated
  using (public.is_company_owner(company_id))
  with check (public.is_company_owner(company_id));

create policy loyalty_accounts_select on public.loyalty_accounts
  for select to authenticated
  using (public.is_super_admin() or public.has_company_access(company_id));

create policy loyalty_transactions_select on public.loyalty_transactions
  for select to authenticated
  using (public.is_super_admin() or public.has_company_access(company_id));

create policy loyalty_rewards_select on public.loyalty_rewards
  for select to authenticated
  using (public.is_super_admin() or public.has_company_access(company_id));

create policy loyalty_rewards_insert on public.loyalty_rewards
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy loyalty_rewards_update on public.loyalty_rewards
  for update to authenticated
  using (public.can_write_company_data(company_id))
  with check (public.can_write_company_data(company_id));

create policy loyalty_redemptions_select on public.loyalty_redemptions
  for select to authenticated
  using (public.is_super_admin() or public.has_company_access(company_id));

create policy loyalty_redemptions_update on public.loyalty_redemptions
  for update to authenticated
  using (public.can_write_company_data(company_id))
  with check (public.can_write_company_data(company_id));

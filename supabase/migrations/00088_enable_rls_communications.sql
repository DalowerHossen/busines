-- supabase/migrations/00088_enable_rls_communications.sql
-- Row level security for templates, senders, messages and reminders.
--
-- Two rules shape this file. Everything addressed to a tenant follows the
-- usual tenancy guard. Everything that decides what reaches a client, which
-- means sender identities, suppressions and send approvals, is reserved for
-- the owner, because that is the person answerable for the message.

alter table public.email_templates enable row level security;
alter table public.email_template_versions enable row level security;
alter table public.sending_domains enable row level security;
alter table public.sender_identities enable row level security;
alter table public.messages enable row level security;
alter table public.message_events enable row level security;
alter table public.email_suppressions enable row level security;
alter table public.unsubscribe_tokens enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.reminder_rules enable row level security;
alter table public.reminder_settings enable row level security;
alter table public.invoice_reminders enable row level security;
alter table public.payment_promises enable row level security;
alter table public.send_requests enable row level security;
alter table public.send_batches enable row level security;
alter table public.send_batch_items enable row level security;

alter table public.email_templates force row level security;
alter table public.email_template_versions force row level security;
alter table public.sending_domains force row level security;
alter table public.sender_identities force row level security;
alter table public.messages force row level security;
alter table public.message_events force row level security;
alter table public.email_suppressions force row level security;
alter table public.unsubscribe_tokens force row level security;
alter table public.notifications force row level security;
alter table public.notification_preferences force row level security;
alter table public.reminder_rules force row level security;
alter table public.reminder_settings force row level security;
alter table public.invoice_reminders force row level security;
alter table public.payment_promises force row level security;
alter table public.send_requests force row level security;
alter table public.send_batches force row level security;
alter table public.send_batch_items force row level security;

select public.install_tenant_policies('reminder_rules');

-- -----------------------------------------------------------------------------
-- Templates
-- -----------------------------------------------------------------------------

-- A tenant reads the platform wording so the editor can show what it would
-- inherit, and reads or edits its own copy.
create policy email_templates_select on public.email_templates
  for select to authenticated
  using (
    deleted_at is null
    and (company_id is null or public.has_company_access(company_id))
  );

create policy email_templates_insert on public.email_templates
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (company_id is not null and public.is_company_owner(company_id))
  );

create policy email_templates_update on public.email_templates
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

comment on policy email_templates_select on public.email_templates is
  'A tenant sees the platform wording it inherits and its own rewrites.';

create policy email_template_versions_select on public.email_template_versions
  for select to authenticated
  using (company_id is null or public.has_company_access(company_id));

-- -----------------------------------------------------------------------------
-- Senders
-- -----------------------------------------------------------------------------

create policy sending_domains_select on public.sending_domains
  for select to authenticated
  using (
    deleted_at is null
    and (company_id is null or public.has_company_access(company_id))
  );

create policy sending_domains_insert on public.sending_domains
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (company_id is not null and public.is_company_owner(company_id))
  );

create policy sending_domains_update on public.sending_domains
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

create policy sender_identities_select on public.sender_identities
  for select to authenticated
  using (
    deleted_at is null
    and (company_id is null or public.has_company_access(company_id))
  );

create policy sender_identities_insert on public.sender_identities
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (company_id is not null and public.is_company_owner(company_id))
  );

create policy sender_identities_update on public.sender_identities
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

comment on policy sender_identities_update on public.sender_identities is
  'Only the owner decides which address a business writes to clients from.';

-- -----------------------------------------------------------------------------
-- Messages
-- -----------------------------------------------------------------------------

-- The log is readable by the tenant it belongs to; it is written by the
-- security definer routines, never by a session directly.
create policy messages_select on public.messages
  for select to authenticated
  using (company_id is not null and public.has_company_access(company_id));

create policy message_events_select on public.message_events
  for select to authenticated
  using (company_id is not null and public.has_company_access(company_id));

create policy email_suppressions_select on public.email_suppressions
  for select to authenticated
  using (
    public.is_super_admin()
    or (company_id is not null and public.is_company_owner(company_id))
  );

comment on policy email_suppressions_select on public.email_suppressions is
  'The do not contact list is owner level information, not staff level.';

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------

create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = public.current_user_id());

create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy notification_preferences_select on public.notification_preferences
  for select to authenticated
  using (user_id = public.current_user_id());

create policy notification_preferences_insert on public.notification_preferences
  for insert to authenticated
  with check (user_id = public.current_user_id());

create policy notification_preferences_update on public.notification_preferences
  for update to authenticated
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

-- -----------------------------------------------------------------------------
-- Reminders
-- -----------------------------------------------------------------------------

create policy reminder_settings_select on public.reminder_settings
  for select to authenticated
  using (public.has_company_access(company_id));

create policy reminder_settings_insert on public.reminder_settings
  for insert to authenticated
  with check (public.is_company_owner(company_id) or public.is_super_admin());

create policy reminder_settings_update on public.reminder_settings
  for update to authenticated
  using (public.is_company_owner(company_id) or public.is_super_admin())
  with check (public.is_company_owner(company_id) or public.is_super_admin());

create policy invoice_reminders_select on public.invoice_reminders
  for select to authenticated
  using (public.has_company_access(company_id));

create policy payment_promises_select on public.payment_promises
  for select to authenticated
  using (public.has_company_access(company_id));

create policy payment_promises_insert on public.payment_promises
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy payment_promises_update on public.payment_promises
  for update to authenticated
  using (public.can_write_company_data(company_id))
  with check (public.can_write_company_data(company_id));

-- -----------------------------------------------------------------------------
-- Approvals and batches
-- -----------------------------------------------------------------------------

-- Staff may raise and read a request; only the owner may decide it, which the
-- review routine enforces on top of this policy.
create policy send_requests_select on public.send_requests
  for select to authenticated
  using (public.has_company_access(company_id));

create policy send_requests_insert on public.send_requests
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy send_requests_update on public.send_requests
  for update to authenticated
  using (public.can_send_client_email(company_id))
  with check (public.can_send_client_email(company_id));

comment on policy send_requests_update on public.send_requests is
  'A request is decided by the owner, never by the colleague who raised it.';

create policy send_batches_select on public.send_batches
  for select to authenticated
  using (public.has_company_access(company_id));

create policy send_batches_insert on public.send_batches
  for insert to authenticated
  with check (public.can_send_client_email(company_id));

create policy send_batches_update on public.send_batches
  for update to authenticated
  using (public.can_send_client_email(company_id))
  with check (public.can_send_client_email(company_id));

create policy send_batch_items_select on public.send_batch_items
  for select to authenticated
  using (public.has_company_access(company_id));

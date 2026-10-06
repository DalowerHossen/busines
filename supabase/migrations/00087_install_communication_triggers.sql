-- supabase/migrations/00087_install_communication_triggers.sql
-- Standard triggers, wording history and the automation that keeps reminders
-- in step with the invoices they chase.

select public.install_standard_triggers('email_templates');
select public.install_standard_triggers('sending_domains');
select public.install_standard_triggers('sender_identities');
select public.install_standard_triggers('reminder_rules');

select public.install_timestamp_trigger('messages');
select public.install_timestamp_trigger('email_suppressions');
select public.install_timestamp_trigger('notifications');
select public.install_timestamp_trigger('notification_preferences');
select public.install_timestamp_trigger('reminder_settings');
select public.install_timestamp_trigger('invoice_reminders');
select public.install_timestamp_trigger('payment_promises');
select public.install_timestamp_trigger('send_requests');
select public.install_timestamp_trigger('send_batches');
select public.install_timestamp_trigger('send_batch_items');

select public.install_audit_trigger('email_templates');
select public.install_audit_trigger('sending_domains');
select public.install_audit_trigger('sender_identities');
select public.install_audit_trigger('email_suppressions');
select public.install_audit_trigger('reminder_rules');
select public.install_audit_trigger('send_requests');

-- -----------------------------------------------------------------------------
-- Wording history
-- -----------------------------------------------------------------------------

-- Keeps the previous wording and moves the version forward on every edit.
create or replace function public.record_email_template_version()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.subject is distinct from old.subject
     or new.body_html is distinct from old.body_html
     or new.body_text is distinct from old.body_text then
    insert into public.email_template_versions (
      template_id, company_id, version, subject, body_html, body_text, changed_by
    )
    values (
      old.id, old.company_id, old.version, old.subject, old.body_html,
      old.body_text, public.current_user_id()
    );

    new.version := old.version + 1;
    new.last_edited_by := public.current_user_id();
  end if;

  return new;
end;
$$;

comment on function public.record_email_template_version() is
  'Stores the previous wording of a template before an edit replaces it.';

create trigger email_templates_10_version_history
  before update on public.email_templates
  for each row execute function public.record_email_template_version();

-- The platform wording is the fallback for every tenant and is not editable
-- from a tenant session.
create or replace function public.guard_system_template()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(old.is_system, new.is_system)
     and not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'The platform wording can only be changed by the platform team'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_system_template() is
  'Protects the platform wording that every tenant falls back to.';

create trigger email_templates_20_system_guard
  before update on public.email_templates
  for each row execute function public.guard_system_template();

-- -----------------------------------------------------------------------------
-- Sender defaults
-- -----------------------------------------------------------------------------

-- Keeps one default sender per tenant, and one for the platform.
create or replace function public.guard_default_sender_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_default then
    update public.sender_identities
       set is_default = false,
           updated_at = now()
     where id <> new.id
       and coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = coalesce(new.company_id, '00000000-0000-0000-0000-000000000000'::uuid)
       and is_default
       and deleted_at is null;
  end if;

  return new;
end;
$$;

comment on function public.guard_default_sender_identity() is
  'Keeps a single default sender for each tenant and for the platform.';

create trigger sender_identities_10_default_guard
  before insert or update of is_default on public.sender_identities
  for each row execute function public.guard_default_sender_identity();

-- -----------------------------------------------------------------------------
-- Reminder automation
-- -----------------------------------------------------------------------------

-- Rebuilds or stops the reminder ladder when an invoice moves.
create or replace function public.sync_invoice_reminders()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and new.status is not distinct from old.status
     and new.due_date is not distinct from old.due_date
     and new.balance_due is not distinct from old.balance_due then
    return new;
  end if;

  if new.status in ('paid', 'cancelled', 'written_off') or new.balance_due <= 0 then
    perform public.cancel_invoice_reminders(
      new.id, 'The invoice no longer needs chasing'
    );
  elsif new.status in ('sent', 'viewed', 'partially_paid', 'overdue') then
    perform public.schedule_invoice_reminders(new.id);
  end if;

  return new;
end;
$$;

comment on function public.sync_invoice_reminders() is
  'Keeps the reminder plan of an invoice in step with its status and balance.';

create trigger invoices_90_reminder_sync
  after insert or update of status, due_date, paid_amount on public.invoices
  for each row execute function public.sync_invoice_reminders();

-- Gives every new tenant a working sending window and a sensible ladder.
create or replace function public.install_default_reminder_setup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.reminder_settings (company_id, time_zone)
  values (new.id, coalesce(new.time_zone, 'UTC'))
  on conflict (company_id) do nothing;

  insert into public.reminder_rules (company_id, name, template_key, offset_days)
  values
    (new.id, 'Three days before the due date', 'invoice_reminder', -3),
    (new.id, 'On the due date', 'invoice_reminder', 0),
    (new.id, 'Seven days overdue', 'invoice_overdue', 7),
    (new.id, 'Twenty one days overdue', 'invoice_overdue', 21)
  on conflict do nothing;

  return new;
end;
$$;

comment on function public.install_default_reminder_setup() is
  'Gives a new tenant a working reminder ladder it can edit or switch off.';

create trigger companies_60_reminder_setup
  after insert on public.companies
  for each row execute function public.install_default_reminder_setup();

-- supabase/migrations/00086_add_communication_foreign_keys.sql
-- Relationships for templates, senders, messages, reminders and approvals.
--
-- The message log outlives the records it refers to: a client may be removed
-- and the evidence of what they were sent must still read correctly, so those
-- references clear rather than cascade.

-- Templates -------------------------------------------------------------------

alter table public.email_templates
  add constraint email_templates_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.email_templates
  add constraint email_templates_last_edited_by_fkey
  foreign key (last_edited_by) references public.users (id) on delete set null;

alter table public.email_templates
  add constraint email_templates_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.email_templates
  add constraint email_templates_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.email_template_versions
  add constraint email_template_versions_template_fkey
  foreign key (template_id) references public.email_templates (id) on delete cascade;

alter table public.email_template_versions
  add constraint email_template_versions_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.email_template_versions
  add constraint email_template_versions_changed_by_fkey
  foreign key (changed_by) references public.users (id) on delete set null;

-- Senders ---------------------------------------------------------------------

alter table public.sending_domains
  add constraint sending_domains_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.sending_domains
  add constraint sending_domains_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.sending_domains
  add constraint sending_domains_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.sender_identities
  add constraint sender_identities_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.sender_identities
  add constraint sender_identities_domain_fkey
  foreign key (sending_domain_id) references public.sending_domains (id)
  on delete set null;

alter table public.sender_identities
  add constraint sender_identities_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.sender_identities
  add constraint sender_identities_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

-- Messages --------------------------------------------------------------------

alter table public.messages
  add constraint messages_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.messages
  add constraint messages_sender_identity_fkey
  foreign key (sender_identity_id) references public.sender_identities (id)
  on delete set null;

alter table public.messages
  add constraint messages_client_fkey
  foreign key (client_id) references public.clients (id) on delete set null;

alter table public.messages
  add constraint messages_requested_by_fkey
  foreign key (requested_by) references public.users (id) on delete set null;

alter table public.messages
  add constraint messages_approved_by_fkey
  foreign key (approved_by) references public.users (id) on delete set null;

alter table public.messages
  add constraint messages_batch_fkey
  foreign key (batch_id) references public.send_batches (id) on delete set null;

alter table public.message_events
  add constraint message_events_message_fkey
  foreign key (message_id) references public.messages (id) on delete cascade;

alter table public.message_events
  add constraint message_events_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

-- Suppressions ----------------------------------------------------------------

alter table public.email_suppressions
  add constraint email_suppressions_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.email_suppressions
  add constraint email_suppressions_released_by_fkey
  foreign key (released_by) references public.users (id) on delete set null;

alter table public.unsubscribe_tokens
  add constraint unsubscribe_tokens_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.unsubscribe_tokens
  add constraint unsubscribe_tokens_client_fkey
  foreign key (client_id) references public.clients (id) on delete set null;

-- Notifications ---------------------------------------------------------------

alter table public.notifications
  add constraint notifications_user_fkey
  foreign key (user_id) references public.users (id) on delete cascade;

alter table public.notifications
  add constraint notifications_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.notifications
  add constraint notifications_message_fkey
  foreign key (message_id) references public.messages (id) on delete set null;

alter table public.notification_preferences
  add constraint notification_preferences_user_fkey
  foreign key (user_id) references public.users (id) on delete cascade;

alter table public.notification_preferences
  add constraint notification_preferences_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

-- Reminders -------------------------------------------------------------------

alter table public.reminder_rules
  add constraint reminder_rules_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.reminder_rules
  add constraint reminder_rules_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.reminder_rules
  add constraint reminder_rules_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.reminder_settings
  add constraint reminder_settings_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.invoice_reminders
  add constraint invoice_reminders_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.invoice_reminders
  add constraint invoice_reminders_invoice_fkey
  foreign key (invoice_id) references public.invoices (id) on delete cascade;

alter table public.invoice_reminders
  add constraint invoice_reminders_rule_fkey
  foreign key (rule_id) references public.reminder_rules (id) on delete cascade;

alter table public.invoice_reminders
  add constraint invoice_reminders_message_fkey
  foreign key (message_id) references public.messages (id) on delete set null;

alter table public.payment_promises
  add constraint payment_promises_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.payment_promises
  add constraint payment_promises_invoice_fkey
  foreign key (invoice_id) references public.invoices (id) on delete cascade;

alter table public.payment_promises
  add constraint payment_promises_client_fkey
  foreign key (client_id) references public.clients (id) on delete set null;

alter table public.payment_promises
  add constraint payment_promises_recorded_by_fkey
  foreign key (recorded_by) references public.users (id) on delete set null;

-- Approvals and batches -------------------------------------------------------

alter table public.send_requests
  add constraint send_requests_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.send_requests
  add constraint send_requests_requested_by_fkey
  foreign key (requested_by) references public.users (id) on delete restrict;

alter table public.send_requests
  add constraint send_requests_reviewed_by_fkey
  foreign key (reviewed_by) references public.users (id) on delete set null;

alter table public.send_requests
  add constraint send_requests_message_fkey
  foreign key (message_id) references public.messages (id) on delete set null;

alter table public.send_batches
  add constraint send_batches_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.send_batches
  add constraint send_batches_created_by_fkey
  foreign key (created_by) references public.users (id) on delete restrict;

alter table public.send_batches
  add constraint send_batches_cancelled_by_fkey
  foreign key (cancelled_by) references public.users (id) on delete set null;

alter table public.send_batch_items
  add constraint send_batch_items_batch_fkey
  foreign key (batch_id) references public.send_batches (id) on delete cascade;

alter table public.send_batch_items
  add constraint send_batch_items_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.send_batch_items
  add constraint send_batch_items_message_fkey
  foreign key (message_id) references public.messages (id) on delete set null;

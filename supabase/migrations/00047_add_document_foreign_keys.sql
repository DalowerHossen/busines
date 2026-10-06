-- supabase/migrations/00047_add_document_foreign_keys.sql
-- Relationships for invoices, estimates, credit notes, schedules and links.
--
-- A client or a product that appears on an issued document can no longer be
-- removed from the database, which is why those references are restricted
-- rather than cascaded.

alter table public.invoices
  add constraint invoices_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.invoices
  add constraint invoices_client_fkey
  foreign key (client_id) references public.clients (id) on delete restrict;

alter table public.invoices
  add constraint invoices_client_same_company_fkey
  foreign key (client_id, company_id) references public.clients (id, company_id);

alter table public.invoices
  add constraint invoices_contact_fkey
  foreign key (client_contact_id) references public.client_contacts (id) on delete set null;

alter table public.invoices
  add constraint invoices_snapshot_fkey
  foreign key (company_profile_snapshot_id)
  references public.company_profile_snapshots (id) on delete restrict;

alter table public.invoices
  add constraint invoices_shipping_tax_rate_fkey
  foreign key (shipping_tax_rate_id) references public.tax_rates (id) on delete set null;

alter table public.invoices
  add constraint invoices_revision_fkey
  foreign key (revision_of_invoice_id) references public.invoices (id) on delete set null;

alter table public.invoices
  add constraint invoices_source_estimate_fkey
  foreign key (source_estimate_id) references public.estimates (id) on delete set null;

alter table public.invoices
  add constraint invoices_schedule_fkey
  foreign key (recurring_schedule_id)
  references public.recurring_invoice_schedules (id) on delete set null;

alter table public.invoices
  add constraint invoices_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.invoices
  add constraint invoices_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.invoice_items
  add constraint invoice_items_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.invoice_items
  add constraint invoice_items_invoice_fkey
  foreign key (invoice_id) references public.invoices (id) on delete cascade;

alter table public.invoice_items
  add constraint invoice_items_invoice_same_company_fkey
  foreign key (invoice_id, company_id) references public.invoices (id, company_id);

alter table public.invoice_items
  add constraint invoice_items_product_fkey
  foreign key (product_id) references public.products (id) on delete set null;

alter table public.invoice_items
  add constraint invoice_items_tax_rate_fkey
  foreign key (tax_rate_id) references public.tax_rates (id) on delete set null;

alter table public.invoice_items
  add constraint invoice_items_tax_group_fkey
  foreign key (tax_group_id) references public.tax_groups (id) on delete set null;

alter table public.invoice_items
  add constraint invoice_items_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.invoice_items
  add constraint invoice_items_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.invoice_taxes
  add constraint invoice_taxes_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.invoice_taxes
  add constraint invoice_taxes_invoice_fkey
  foreign key (invoice_id) references public.invoices (id) on delete cascade;

alter table public.invoice_taxes
  add constraint invoice_taxes_rate_fkey
  foreign key (tax_rate_id) references public.tax_rates (id) on delete set null;

alter table public.document_events
  add constraint document_events_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.document_events
  add constraint document_events_actor_fkey
  foreign key (actor_user_id) references public.users (id) on delete set null;

alter table public.estimates
  add constraint estimates_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.estimates
  add constraint estimates_client_fkey
  foreign key (client_id) references public.clients (id) on delete restrict;

alter table public.estimates
  add constraint estimates_client_same_company_fkey
  foreign key (client_id, company_id) references public.clients (id, company_id);

alter table public.estimates
  add constraint estimates_contact_fkey
  foreign key (client_contact_id) references public.client_contacts (id) on delete set null;

alter table public.estimates
  add constraint estimates_snapshot_fkey
  foreign key (company_profile_snapshot_id)
  references public.company_profile_snapshots (id) on delete restrict;

alter table public.estimates
  add constraint estimates_converted_invoice_fkey
  foreign key (converted_invoice_id) references public.invoices (id) on delete set null;

alter table public.estimates
  add constraint estimates_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.estimates
  add constraint estimates_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.estimate_items
  add constraint estimate_items_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.estimate_items
  add constraint estimate_items_estimate_fkey
  foreign key (estimate_id) references public.estimates (id) on delete cascade;

alter table public.estimate_items
  add constraint estimate_items_estimate_same_company_fkey
  foreign key (estimate_id, company_id) references public.estimates (id, company_id);

alter table public.estimate_items
  add constraint estimate_items_product_fkey
  foreign key (product_id) references public.products (id) on delete set null;

alter table public.estimate_items
  add constraint estimate_items_tax_rate_fkey
  foreign key (tax_rate_id) references public.tax_rates (id) on delete set null;

alter table public.estimate_items
  add constraint estimate_items_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.estimate_items
  add constraint estimate_items_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.credit_notes
  add constraint credit_notes_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.credit_notes
  add constraint credit_notes_client_fkey
  foreign key (client_id) references public.clients (id) on delete restrict;

alter table public.credit_notes
  add constraint credit_notes_invoice_fkey
  foreign key (invoice_id) references public.invoices (id) on delete restrict;

alter table public.credit_notes
  add constraint credit_notes_snapshot_fkey
  foreign key (company_profile_snapshot_id)
  references public.company_profile_snapshots (id) on delete restrict;

alter table public.credit_notes
  add constraint credit_notes_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.credit_notes
  add constraint credit_notes_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.credit_note_items
  add constraint credit_note_items_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.credit_note_items
  add constraint credit_note_items_note_fkey
  foreign key (credit_note_id) references public.credit_notes (id) on delete cascade;

alter table public.credit_note_items
  add constraint credit_note_items_invoice_item_fkey
  foreign key (invoice_item_id) references public.invoice_items (id) on delete set null;

alter table public.credit_note_items
  add constraint credit_note_items_tax_rate_fkey
  foreign key (tax_rate_id) references public.tax_rates (id) on delete set null;

alter table public.credit_note_items
  add constraint credit_note_items_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.credit_note_items
  add constraint credit_note_items_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.credit_note_applications
  add constraint credit_note_applications_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.credit_note_applications
  add constraint credit_note_applications_note_fkey
  foreign key (credit_note_id) references public.credit_notes (id) on delete cascade;

alter table public.credit_note_applications
  add constraint credit_note_applications_invoice_fkey
  foreign key (invoice_id) references public.invoices (id) on delete restrict;

alter table public.credit_note_applications
  add constraint credit_note_applications_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.recurring_invoice_schedules
  add constraint recurring_schedules_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.recurring_invoice_schedules
  add constraint recurring_schedules_client_fkey
  foreign key (client_id) references public.clients (id) on delete restrict;

alter table public.recurring_invoice_schedules
  add constraint recurring_schedules_template_fkey
  foreign key (template_invoice_id) references public.invoices (id) on delete cascade;

alter table public.recurring_invoice_schedules
  add constraint recurring_schedules_contact_fkey
  foreign key (send_to_contact_id) references public.client_contacts (id) on delete set null;

alter table public.recurring_invoice_schedules
  add constraint recurring_schedules_last_invoice_fkey
  foreign key (last_generated_invoice_id) references public.invoices (id) on delete set null;

alter table public.recurring_invoice_schedules
  add constraint recurring_schedules_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.recurring_invoice_schedules
  add constraint recurring_schedules_updated_by_fkey
  foreign key (updated_by) references public.users (id) on delete set null;

alter table public.document_links
  add constraint document_links_company_fkey
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.document_links
  add constraint document_links_revoked_by_fkey
  foreign key (revoked_by) references public.users (id) on delete set null;

alter table public.document_links
  add constraint document_links_created_by_fkey
  foreign key (created_by) references public.users (id) on delete set null;

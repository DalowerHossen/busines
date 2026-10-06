-- supabase/migrations/00049_enable_rls_documents.sql
-- Row level security for the document module.
--
-- Documents follow the same tenancy rule as the rest of the platform: read
-- access for the company and its authorised accountant, write access for the
-- owner and staff only. Clients reach a document through a signed link, which
-- is resolved by a security definer function rather than by a policy, so no
-- anonymous role ever gets direct table access.

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_taxes enable row level security;
alter table public.document_events enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_items enable row level security;
alter table public.credit_notes enable row level security;
alter table public.credit_note_items enable row level security;
alter table public.credit_note_applications enable row level security;
alter table public.recurring_invoice_schedules enable row level security;
alter table public.document_links enable row level security;

alter table public.invoices force row level security;
alter table public.invoice_items force row level security;
alter table public.invoice_taxes force row level security;
alter table public.document_events force row level security;
alter table public.estimates force row level security;
alter table public.estimate_items force row level security;
alter table public.credit_notes force row level security;
alter table public.credit_note_items force row level security;
alter table public.credit_note_applications force row level security;
alter table public.recurring_invoice_schedules force row level security;
alter table public.document_links force row level security;

select public.install_tenant_policies('invoices');
select public.install_tenant_policies('invoice_items');
select public.install_tenant_policies('estimates');
select public.install_tenant_policies('estimate_items');
select public.install_tenant_policies('credit_notes');
select public.install_tenant_policies('credit_note_items');
select public.install_tenant_policies('recurring_invoice_schedules');

-- The tax summary is rebuilt by the calculation engine, so the client layer
-- only ever reads it.
create policy invoice_taxes_select on public.invoice_taxes
  for select to authenticated
  using (public.has_company_access(company_id));

-- Evidence is readable by the company and appended by the server layer.
create policy document_events_select on public.document_events
  for select to authenticated
  using (public.has_company_access(company_id));

create policy document_events_insert on public.document_events
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy credit_note_applications_select on public.credit_note_applications
  for select to authenticated
  using (public.has_company_access(company_id));

create policy credit_note_applications_insert on public.credit_note_applications
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

-- Link tokens are sensitive. They are listed so the team can see what was
-- shared and revoke it, and they are created by the sending flow.
create policy document_links_select on public.document_links
  for select to authenticated
  using (public.has_company_access(company_id));

create policy document_links_insert on public.document_links
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy document_links_update on public.document_links
  for update to authenticated
  using (public.can_write_company_data(company_id))
  with check (public.can_write_company_data(company_id));

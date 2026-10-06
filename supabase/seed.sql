-- supabase/seed.sql
-- Idempotent English seed data for local development and controlled bootstrap.
-- Production deployments must replace the local Auth bootstrap through the
-- configured Supabase Auth provisioning flow before enabling sign-in.

-- The bootstrap user has no password in this seed. A local operator must set
-- credentials through Supabase Auth; no credential is stored in source.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'authenticated',
  'authenticated',
  'admin@kdsolutionit.local',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Platform Administrator"}'::jsonb,
  now(),
  now()
where not exists (
  select 1 from auth.users where id = '00000000-0000-0000-0000-000000000001'::uuid
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'authenticated',
  'authenticated',
  'owner@demo.kdsolutionit.local',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Demo Business Owner"}'::jsonb,
  now(),
  now()
where not exists (
  select 1 from auth.users where id = '00000000-0000-0000-0000-000000000002'::uuid
);

update public.users
set platform_role = 'super_admin',
    full_name = 'Platform Administrator',
    is_email_verified = true
where id = '00000000-0000-0000-0000-000000000001'::uuid
  and platform_role is distinct from 'super_admin';

insert into public.plans (
  id, tier_id, name, monthly_price_amount, yearly_price_amount, currency_code,
  max_clients, max_invoices_per_month, max_staff_seats, max_storage_mb,
  max_whatsapp_messages_per_month, allows_custom_branding, allows_api_access,
  allows_multi_currency, is_publicly_visible, sort_order
) values
  ('00000000-0000-0000-0000-000000000101', 'free', 'Free', 0, 0, 'USD', 10, 10, 1, 200, 0, false, false, false, true, 0),
  ('00000000-0000-0000-0000-000000000102', 'starter', 'Starter', 0, 0, 'USD', 100, 100, 3, 2048, 200, true, false, true, true, 1),
  ('00000000-0000-0000-0000-000000000103', 'professional', 'Professional', 0, 0, 'USD', 1000, 1000, 10, 10240, 2000, true, true, true, true, 2),
  ('00000000-0000-0000-0000-000000000104', 'business', 'Business', 0, 0, 'USD', null, null, 25, 51200, 10000, true, true, true, true, 3),
  ('00000000-0000-0000-0000-000000000105', 'enterprise', 'Enterprise', 0, 0, 'USD', null, null, null, null, null, true, true, true, false, 4)
on conflict (id) do nothing;

-- Platform settings are explicit, versioned seed values. Operators can
-- replace them per company without changing database code.
insert into public.system_settings (scope, company_id, key, value_plain)
select 'platform', null, settings.key, settings.value_plain
from (
  values
    ('invoice_late_fee_policy', '{"policy_version":"late-fee-2026-01","enabled":false,"type":"percent","rate_percent":0,"fixed_amount":0}'::jsonb),
    ('recurring_invoice_due_days', '{"policy_version":"invoice-terms-2026-01","days":30}'::jsonb),
    ('session_retention_days', '{"policy_version":"session-retention-2026-01","days":90}'::jsonb),
    ('backup_retention_days', '{"policy_version":"backup-retention-2026-01","days":30}'::jsonb),
    ('backup_encryption_key_version', '{"policy_version":"backup-encryption-2026-01","version":"v1"}'::jsonb),
    ('invoice_reminder_schedule', '{"policy_version":"invoice-reminders-2026-01","days_after_due":[0,7,14]}'::jsonb)
) as settings(key, value_plain)
where not exists (
  select 1 from public.system_settings existing
  where existing.scope = 'platform' and existing.company_id is null and existing.key = settings.key
);

-- English platform CMS pages.
insert into public.cms_pages (
  id, company_id, page_key, slug, title, excerpt, content, seo_title,
  seo_description, status, published_at
) values
(
  '00000000-0000-0000-0000-000000000201', null, 'home', '/', 'Smart billing for modern business',
  'Create invoices, collect payments, and understand your business in one place.',
  '{"sections":[{"type":"hero","headline":"Smart billing for modern business","body":"Create invoices, collect payments, and keep every business record organized.","primaryAction":"Start free"},{"type":"feature_list","items":["Professional invoices","Tenant-safe client records","Configurable payment workflows"]}]}'::jsonb,
  'Smart billing for modern business',
  'Professional invoicing, payments, accounting, and business operations for growing teams.',
  'published', now()
),
(
  '00000000-0000-0000-0000-000000000202', null, 'privacy', '/privacy', 'Privacy policy',
  'How the platform handles account and business data.',
  '{"sections":[{"type":"rich_text","heading":"Your data matters","body":"We use account and business data to provide secure billing and business operations. Access is limited by role and company boundaries."}]}'::jsonb,
  'Privacy policy',
  'Privacy information for platform users and business customers.',
  'published', now()
),
(
  '00000000-0000-0000-0000-000000000203', null, 'terms', '/terms', 'Terms of service',
  'The terms that govern use of the platform.',
  '{"sections":[{"type":"rich_text","heading":"Platform terms","body":"Use the platform lawfully, protect your account, and keep business records accurate. Payment and tax workflows remain subject to the configured policy version."}]}'::jsonb,
  'Terms of service',
  'Terms governing use of the billing and business operations platform.',
  'published', now()
)
on conflict (id) do nothing;

-- Transactional templates. Migration 00166 also provides these rows; the
-- guarded inserts make a database seeded from an older migration snapshot
-- converge to the same English platform catalog.
insert into public.email_templates (
  id, company_id, template_key, display_name, category, subject_template,
  body_html, body_text, variable_names
)
select templates.id, null, templates.template_key, templates.display_name,
       templates.category, templates.subject_template, templates.body_html,
       templates.body_text, templates.variable_names
from (
  values
    ('00000000-0000-0000-0000-000000000301'::uuid, 'welcome', 'Welcome', 'transactional', 'Welcome to {{company_name}}', '<p>Hello {{user_name}},</p><p>Your account is ready. Sign in here: <a href="{{login_url}}">{{login_url}}</a></p>', 'Hello {{user_name}}, your account is ready. Sign in here: {{login_url}}', array['company_name','user_name','login_url']::text[]),
    ('00000000-0000-0000-0000-000000000302'::uuid, 'invoice_sent', 'Invoice sent', 'transactional', 'Invoice {{invoice_number}} from {{company_name}}', '<p>Hello {{client_name}},</p><p>Your invoice <strong>{{invoice_number}}</strong> is {{amount}} {{currency}}.</p><p>View it here: <a href="{{invoice_url}}">{{invoice_url}}</a></p>', 'Hello {{client_name}}, your invoice {{invoice_number}} is {{amount}} {{currency}}. View it here: {{invoice_url}}', array['client_name','invoice_number','amount','currency','invoice_url','company_name']::text[]),
    ('00000000-0000-0000-0000-000000000303'::uuid, 'estimate_sent', 'Estimate sent', 'transactional', 'Estimate {{estimate_number}} from {{company_name}}', '<p>Hello {{client_name}},</p><p>Your estimate <strong>{{estimate_number}}</strong> is {{amount}} {{currency}}.</p><p>Review it here: <a href="{{estimate_url}}">{{estimate_url}}</a></p>', 'Hello {{client_name}}, your estimate {{estimate_number}} is {{amount}} {{currency}}. Review it here: {{estimate_url}}', array['client_name','estimate_number','amount','currency','estimate_url','company_name']::text[]),
    ('00000000-0000-0000-0000-000000000304'::uuid, 'invoice_overdue', 'Invoice overdue reminder', 'transactional', 'Payment reminder for invoice {{invoice_number}}', '<p>Hello {{client_name}},</p><p>Invoice <strong>{{invoice_number}}</strong> is overdue. The outstanding amount is {{amount}} {{currency}}.</p><p>Pay securely here: <a href="{{payment_url}}">{{payment_url}}</a></p>', 'Hello {{client_name}}, invoice {{invoice_number}} is overdue. The outstanding amount is {{amount}} {{currency}}. Pay securely here: {{payment_url}}', array['client_name','invoice_number','amount','currency','payment_url']::text[]),
    ('00000000-0000-0000-0000-000000000305'::uuid, 'payment_failed', 'Payment failed', 'transactional', 'Payment could not be completed for invoice {{invoice_number}}', '<p>Hello {{client_name}},</p><p>We could not complete the payment for invoice <strong>{{invoice_number}}</strong>. Please try again here: <a href="{{payment_url}}">{{payment_url}}</a></p>', 'Hello {{client_name}}, we could not complete the payment for invoice {{invoice_number}}. Please try again here: {{payment_url}}', array['client_name','invoice_number','payment_url']::text[]),
    ('00000000-0000-0000-0000-000000000306'::uuid, 'subscription_renewal_due', 'Subscription renewal due', 'subscription', 'Your subscription renewal is due', '<p>Hello {{user_name}},</p><p>Your subscription renewal is due on {{renewal_date}}.</p>', 'Hello {{user_name}}, your subscription renewal is due on {{renewal_date}}.', array['user_name','renewal_date']::text[]),
    ('00000000-0000-0000-0000-000000000307'::uuid, 'system_announcement', 'System announcement', 'system', '{{announcement_title}}', '<p>{{announcement_body}}</p>', '{{announcement_body}}', array['announcement_title','announcement_body']::text[]),
    ('00000000-0000-0000-0000-000000000308'::uuid, 'account_deletion_requested', 'Account deletion request', 'system', 'Account deletion request received', '<p>Your account deletion request has been received and is being processed.</p>', 'Your account deletion request has been received and is being processed.', array[]::text[])
) as templates(id, template_key, display_name, category, subject_template, body_html, body_text, variable_names)
where not exists (
  select 1 from public.email_templates existing
  where existing.company_id is null and lower(existing.template_key) = lower(templates.template_key)
);

-- Demo tenant and owner membership.
insert into public.companies (id, owner_user_id, name, slug)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'Demo Business',
  'demo-business'
)
on conflict (id) do nothing;

insert into public.company_memberships (
  id, company_id, user_id, role, permissions, is_active
) values (
  '00000000-0000-0000-0000-000000000401',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'owner', '{}', true
)
on conflict (id) do nothing;

insert into public.company_profiles (
  id, company_id, address_line1, city, state, postal_code, country_code,
  tax_id, contact_email, contact_phone, default_currency_code, invoice_prefix
) values (
  '00000000-0000-0000-0000-000000000402',
  '10000000-0000-0000-0000-000000000001',
  '100 Demo Street', 'Austin', 'TX', '78701', 'US',
  'DEMO-TAX-ID', 'owner@demo.kdsolutionit.local', '+1-555-0100', 'USD', 'DEMO'
)
on conflict (company_id) do nothing;

insert into public.subscriptions (
  id, company_id, plan_id, status, billing_cycle, current_period_start
) values (
  '00000000-0000-0000-0000-000000000403',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  'active', 'monthly', now()
)
on conflict (id) do nothing;

insert into public.system_settings (scope, company_id, key, value_plain)
select 'company', '10000000-0000-0000-0000-000000000001'::uuid,
       'invoice_late_fee_policy',
       '{"policy_version":"demo-late-fee-2026-01","enabled":true,"type":"percent","rate_percent":1.5,"fixed_amount":0}'::jsonb
where not exists (
  select 1 from public.system_settings
  where scope = 'company'
    and company_id = '10000000-0000-0000-0000-000000000001'::uuid
    and key = 'invoice_late_fee_policy'
);

insert into public.tax_rates (
  id, company_id, name, rate_percent, country_code, state_code, is_default
) values
  ('00000000-0000-0000-0000-000000000501', '10000000-0000-0000-0000-000000000001', 'Texas sales tax', 8.25, 'US', 'TX', true),
  ('00000000-0000-0000-0000-000000000502', '10000000-0000-0000-0000-000000000001', 'Zero-rated', 0, 'US', null, false)
on conflict (id) do nothing;

insert into public.expense_categories (id, company_id, name, color, is_default)
values
  ('00000000-0000-0000-0000-000000000511', '10000000-0000-0000-0000-000000000001', 'Software', '#2563EB', true),
  ('00000000-0000-0000-0000-000000000512', '10000000-0000-0000-0000-000000000001', 'Travel', '#7C3AED', true),
  ('00000000-0000-0000-0000-000000000513', '10000000-0000-0000-0000-000000000001', 'Office supplies', '#0891B2', true),
  ('00000000-0000-0000-0000-000000000514', '10000000-0000-0000-0000-000000000001', 'Professional services', '#059669', true)
on conflict (id) do nothing;

-- Starter chart of accounts for the demo tenant.
insert into public.chart_of_accounts (
  id, company_id, account_code, account_name, account_type, description
) values
  ('00000000-0000-0000-0000-000000000521', '10000000-0000-0000-0000-000000000001', '1000', 'Cash', 'asset', 'Operating cash account'),
  ('00000000-0000-0000-0000-000000000522', '10000000-0000-0000-0000-000000000001', '1100', 'Accounts receivable', 'asset', 'Amounts due from clients'),
  ('00000000-0000-0000-0000-000000000523', '10000000-0000-0000-0000-000000000001', '2000', 'Accounts payable', 'liability', 'Amounts due to suppliers'),
  ('00000000-0000-0000-0000-000000000524', '10000000-0000-0000-0000-000000000001', '3000', 'Owner equity', 'equity', 'Owner contributions'),
  ('00000000-0000-0000-0000-000000000525', '10000000-0000-0000-0000-000000000001', '4000', 'Service revenue', 'revenue', 'Revenue from services'),
  ('00000000-0000-0000-0000-000000000526', '10000000-0000-0000-0000-000000000001', '5000', 'Operating expenses', 'expense', 'General operating expenses')
on conflict (id) do nothing;

insert into public.clients (
  id, company_id, display_name, company_name_on_invoice, email,
  billing_address_line1, billing_city, billing_state, billing_postal_code,
  billing_country_code, default_currency_code
) values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Example Client', 'Example Client LLC', 'client@example.test',
  '200 Client Avenue', 'Austin', 'TX', '78702', 'US', 'USD'
)
on conflict (id) do nothing;

insert into public.company_profile_snapshots (
  id, company_id, company_name, address_line1, city, state, postal_code,
  country_code, tax_id, contact_email, contact_phone
) values (
  '00000000-0000-0000-0000-000000000601',
  '10000000-0000-0000-0000-000000000001',
  'Demo Business', '100 Demo Street', 'Austin', 'TX', '78701', 'US',
  'DEMO-TAX-ID', 'owner@demo.kdsolutionit.local', '+1-555-0100'
)
on conflict (id) do nothing;

insert into public.invoices (
  id, company_id, client_id, invoice_number, status,
  company_profile_snapshot_id, client_snapshot_display_name,
  client_snapshot_email, client_snapshot_billing_address_line1,
  client_snapshot_billing_city, client_snapshot_billing_state,
  client_snapshot_billing_postal_code, client_snapshot_billing_country_code,
  issue_date, due_date, currency_code, subtotal_amount, tax_total_amount,
  discount_total_amount, total_amount, amount_paid, amount_due,
  notes, created_by_user_id
) values (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  null, 'sent', '00000000-0000-0000-0000-000000000601',
  'Example Client', 'client@example.test', '200 Client Avenue',
  'Austin', 'TX', '78702', 'US', current_date - 5, current_date + 25,
  'USD', 1000, 82.50, 0, 1082.50, 0, 1082.50,
  'Demo invoice for local development', '00000000-0000-0000-0000-000000000002'
)
on conflict (id) do nothing;

insert into public.invoice_line_items (
  id, company_id, invoice_id, description, quantity, unit_price_amount,
  tax_rate_percent, discount_percent, line_total_amount, sort_order
) values (
  '00000000-0000-0000-0000-000000000602',
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'Consulting services', 10, 100, 8.25, 0, 1000, 0
)
on conflict (id) do nothing;

insert into public.expenses (
  id, company_id, category_id, vendor_name, description, currency_code,
  amount, expense_date, approval_status, submitted_by_user_id
) values (
  '00000000-0000-0000-0000-000000000603',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000511',
  'Example Software', 'Monthly development software', 'USD', 49.99,
  current_date, 'not_required', '00000000-0000-0000-0000-000000000002'
)
on conflict (id) do nothing;

insert into public.products (
  id, company_id, type, name, sku, currency_code, unit_price_amount,
  default_tax_rate_percent, track_inventory
) values (
  '00000000-0000-0000-0000-000000000701',
  '10000000-0000-0000-0000-000000000001',
  'product', 'Demo hardware item', 'DEMO-HW-001', 'USD', 25, 8.25, true
)
on conflict (id) do nothing;

insert into public.warehouses (
  id, company_id, name, code, city, state, country_code, is_default
) values (
  '00000000-0000-0000-0000-000000000702',
  '10000000-0000-0000-0000-000000000001',
  'Main warehouse', 'MAIN', 'Austin', 'TX', 'US', true
)
on conflict (id) do nothing;

insert into public.stock_movements (
  id, company_id, warehouse_id, product_id, movement_type, quantity_delta,
  quantity_before, quantity_after, unit_cost_amount, currency_code,
  reference_type, notes, performed_by_user_id
) values (
  '00000000-0000-0000-0000-000000000703',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000702',
  '00000000-0000-0000-0000-000000000701',
  'purchase_receipt', 25, 0, 25, 10, 'USD', 'seed', 'Opening demo stock',
  '00000000-0000-0000-0000-000000000002'
)
on conflict (id) do nothing;

insert into public.recurring_invoice_templates (
  id, company_id, client_id, frequency, next_run_date, currency_code,
  notes, is_active, created_by_user_id
) values (
  '00000000-0000-0000-0000-000000000801',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'monthly', current_date + 1, 'USD', 'Monthly demo services', true,
  '00000000-0000-0000-0000-000000000002'
)
on conflict (id) do nothing;

insert into public.recurring_invoice_template_line_items (
  id, company_id, recurring_invoice_template_id, description, quantity,
  unit_price_amount, tax_rate_percent, discount_percent, sort_order
) values (
  '00000000-0000-0000-0000-000000000802',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000801',
  'Monthly support', 1, 250, 8.25, 0, 0
)
on conflict (id) do nothing;

insert into public.recurring_expenses (
  id, company_id, category_id, description, currency_code, amount,
  frequency, next_run_date, is_active, created_by_user_id
) values (
  '00000000-0000-0000-0000-000000000803',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000511',
  'Monthly software subscription', 'USD', 49.99, 'monthly', current_date + 1,
  true, '00000000-0000-0000-0000-000000000002'
)
on conflict (id) do nothing;

-- A deterministic, balanced demo journal entry.
insert into public.journal_entries (
  id, company_id, entry_date, description, created_by_user_id
) values (
  '00000000-0000-0000-0000-000000000901',
  '10000000-0000-0000-0000-000000000001',
  current_date, 'Opening demo equity', '00000000-0000-0000-0000-000000000002'
)
on conflict (id) do nothing;

insert into public.journal_entry_lines (
  id, company_id, journal_entry_id, account_id, debit_amount, credit_amount, description
) values
  ('00000000-0000-0000-0000-000000000902', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000521', 1000, 0, 'Opening cash'),
  ('00000000-0000-0000-0000-000000000903', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000524', 0, 1000, 'Opening owner equity')
on conflict (id) do nothing;

-- Platform tax compliance policy seed is explicit and versioned. It is a
-- local review fixture, not legal advice or a permanent production default.
insert into public.platform_tax_compliance_settings (
  singleton_key, legal_name, legal_entity_type, tax_country_code, tax_year,
  tpso_threshold_amount, tpso_threshold_transactions, information_return_threshold,
  backup_withholding_rate, default_tax_policy_version, source_snapshot
)
select true, 'KD SOLUTION IT Demo Platform', 'corporation', 'US', 2026,
       20000, 200, 2000, 24, 'us-2026-01',
       '{"source":"https://www.irs.gov/businesses/small-businesses-self-employed/irs-e-file-for-business-and-self-employed-taxpayers","seed_status":"local-review-fixture"}'::jsonb
where not exists (select 1 from public.platform_tax_compliance_settings where singleton_key = true);

-- supabase/migrations/00166_email_template_seeds.sql
-- Platform-owned English transactional templates. Tenant templates can
-- override these rows later without mutating the platform version.

insert into public.email_templates (
  template_key,
  display_name,
  category,
  subject_template,
  body_html,
  body_text,
  variable_names
)
select
  'welcome',
  'Welcome',
  'transactional',
  'Welcome to {{company_name}}',
  '<p>Hello {{user_name}},</p><p>Your account is ready. Sign in here: <a href="{{login_url}}">{{login_url}}</a></p>',
  'Hello {{user_name}}, your account is ready. Sign in here: {{login_url}}',
  array['company_name', 'user_name', 'login_url']::text[]
where not exists (
  select 1 from public.email_templates where company_id is null and template_key = 'welcome'
);

insert into public.email_templates (
  template_key,
  display_name,
  category,
  subject_template,
  body_html,
  body_text,
  variable_names
)
select
  'invoice_sent',
  'Invoice sent',
  'transactional',
  'Invoice {{invoice_number}} from {{company_name}}',
  '<p>Hello {{client_name}},</p><p>Your invoice <strong>{{invoice_number}}</strong> is {{amount}} {{currency}}.</p><p>View it here: <a href="{{invoice_url}}">{{invoice_url}}</a></p>',
  'Hello {{client_name}}, your invoice {{invoice_number}} is {{amount}} {{currency}}. View it here: {{invoice_url}}',
  array['client_name', 'invoice_number', 'amount', 'currency', 'invoice_url', 'company_name']::text[]
where not exists (
  select 1 from public.email_templates where company_id is null and template_key = 'invoice_sent'
);

insert into public.email_templates (
  template_key,
  display_name,
  category,
  subject_template,
  body_html,
  body_text,
  variable_names
)
select
  'estimate_sent',
  'Estimate sent',
  'transactional',
  'Estimate {{estimate_number}} from {{company_name}}',
  '<p>Hello {{client_name}},</p><p>Your estimate <strong>{{estimate_number}}</strong> is {{amount}} {{currency}}.</p><p>Review it here: <a href="{{estimate_url}}">{{estimate_url}}</a></p>',
  'Hello {{client_name}}, your estimate {{estimate_number}} is {{amount}} {{currency}}. Review it here: {{estimate_url}}',
  array['client_name', 'estimate_number', 'amount', 'currency', 'estimate_url', 'company_name']::text[]
where not exists (
  select 1 from public.email_templates where company_id is null and template_key = 'estimate_sent'
);

insert into public.email_templates (
  template_key,
  display_name,
  category,
  subject_template,
  body_html,
  body_text,
  variable_names
)
select
  'invoice_overdue',
  'Invoice overdue reminder',
  'transactional',
  'Payment reminder for invoice {{invoice_number}}',
  '<p>Hello {{client_name}},</p><p>Invoice <strong>{{invoice_number}}</strong> is overdue. The outstanding amount is {{amount}} {{currency}}.</p><p>Pay securely here: <a href="{{payment_url}}">{{payment_url}}</a></p>',
  'Hello {{client_name}}, invoice {{invoice_number}} is overdue. The outstanding amount is {{amount}} {{currency}}. Pay securely here: {{payment_url}}',
  array['client_name', 'invoice_number', 'amount', 'currency', 'payment_url']::text[]
where not exists (
  select 1 from public.email_templates where company_id is null and template_key = 'invoice_overdue'
);

insert into public.email_templates (
  template_key,
  display_name,
  category,
  subject_template,
  body_html,
  body_text,
  variable_names
)
select
  'payment_failed',
  'Payment failed',
  'transactional',
  'Payment could not be completed for invoice {{invoice_number}}',
  '<p>Hello {{client_name}},</p><p>We could not complete the payment for invoice <strong>{{invoice_number}}</strong>. Please try again here: <a href="{{payment_url}}">{{payment_url}}</a></p>',
  'Hello {{client_name}}, we could not complete the payment for invoice {{invoice_number}}. Please try again here: {{payment_url}}',
  array['client_name', 'invoice_number', 'payment_url']::text[]
where not exists (
  select 1 from public.email_templates where company_id is null and template_key = 'payment_failed'
);

insert into public.email_templates (
  template_key,
  display_name,
  category,
  subject_template,
  body_html,
  body_text,
  variable_names
)
select
  'subscription_renewal_due',
  'Subscription renewal reminder',
  'subscription',
  'Your subscription renews on {{renewal_date}}',
  '<p>Hello {{user_name}},</p><p>Your {{plan_name}} subscription renews on {{renewal_date}} for {{amount}} {{currency}}.</p><p>Manage your subscription here: <a href="{{billing_url}}">{{billing_url}}</a></p>',
  'Hello {{user_name}}, your {{plan_name}} subscription renews on {{renewal_date}} for {{amount}} {{currency}}. Manage it here: {{billing_url}}',
  array['user_name', 'plan_name', 'renewal_date', 'amount', 'currency', 'billing_url']::text[]
where not exists (
  select 1 from public.email_templates where company_id is null and template_key = 'subscription_renewal_due'
);

insert into public.email_templates (
  template_key,
  display_name,
  category,
  subject_template,
  body_html,
  body_text,
  variable_names
)
select
  'system_announcement',
  'System announcement',
  'system',
  '{{announcement_title}}',
  '<p>Hello {{user_name}},</p><p>{{announcement_body}}</p>',
  'Hello {{user_name}}, {{announcement_body}}',
  array['announcement_title', 'user_name', 'announcement_body']::text[]
where not exists (
  select 1 from public.email_templates where company_id is null and template_key = 'system_announcement'
);

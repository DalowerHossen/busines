-- supabase/migrations/00077_create_email_templates.sql
-- Message templates and their revision history.
--
-- A template exists either at platform level, where it is the wording every
-- tenant starts from, or at tenant level, where a business has rewritten it.
-- The resolver always prefers the tenant copy and falls back to the platform
-- one, so a tenant can never end up with a missing message.

create table public.email_templates (
  id uuid primary key default public.generate_uuid_v7(),

  -- Null for the platform wording, set when a tenant has its own version.
  company_id uuid,

  -- Stable identifier used in code, for example invoice_sent or
  -- payment_received.
  template_key text not null,
  name text not null,
  description text,
  channel public.message_channel not null default 'email',

  subject text not null,
  body_html text not null,
  body_text text not null,
  preheader text,

  -- Names the editor offers, for example client_name or invoice_number. The
  -- renderer refuses a template that uses anything outside this list.
  available_variables text[] not null default array[]::text[],

  is_active boolean not null default true,
  is_system boolean not null default false,
  send_to_client boolean not null default true,

  version integer not null default 1,
  last_edited_by uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint email_templates_key_check
    check (template_key ~ '^[a-z][a-z0-9_]{2,60}$'),
  constraint email_templates_name_check
    check (length(btrim(name)) between 2 and 80),
  constraint email_templates_subject_check
    check (length(btrim(subject)) between 2 and 200),
  constraint email_templates_body_check
    check (length(btrim(body_html)) > 0 and length(btrim(body_text)) > 0),
  constraint email_templates_system_scope_check
    check (not is_system or company_id is null),
  constraint email_templates_version_check
    check (version > 0)
);

comment on table public.email_templates is
  'Platform wording for every message, and the tenant rewrites of it.';
comment on column public.email_templates.company_id is
  'Null marks the platform wording that every tenant inherits.';

create unique index email_templates_platform_unique
  on public.email_templates (template_key, channel)
  where company_id is null and deleted_at is null;

create unique index email_templates_tenant_unique
  on public.email_templates (company_id, template_key, channel)
  where company_id is not null and deleted_at is null;

create index email_templates_company_idx
  on public.email_templates (company_id)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Revision history
-- -----------------------------------------------------------------------------

-- Wording is a legal surface: what a client was told, and when, has to be
-- recoverable. Every save keeps the previous text.
create table public.email_template_versions (
  id uuid primary key default public.generate_uuid_v7(),
  template_id uuid not null,
  company_id uuid,

  version integer not null,
  subject text not null,
  body_html text not null,
  body_text text not null,

  changed_by uuid,
  change_note text,
  created_at timestamptz not null default now(),

  constraint email_template_versions_version_check check (version > 0)
);

comment on table public.email_template_versions is
  'The wording a template held before each edit, kept for evidence.';

create unique index email_template_versions_unique
  on public.email_template_versions (template_id, version);

create index email_template_versions_template_idx
  on public.email_template_versions (template_id, created_at desc);

create trigger email_template_versions_append_only
  before update or delete on public.email_template_versions
  for each row execute function public.block_audit_mutation();

-- -----------------------------------------------------------------------------
-- Platform wording
-- -----------------------------------------------------------------------------

insert into public.email_templates (
  template_key, name, description, subject, body_html, body_text,
  available_variables, is_system
)
values
  (
    'invoice_sent',
    'Invoice sent',
    'Sent to the client when an invoice is issued.',
    'Invoice {{invoice_number}} from {{company_name}}',
    '<p>Hello {{client_name}},</p><p>Invoice <strong>{{invoice_number}}</strong> '
      || 'for {{total_amount}} is ready. It is due on {{due_date}}.</p>'
      || '<p><a href="{{document_url}}">View and pay the invoice</a></p>'
      || '<p>Thank you for your business.<br />{{company_name}}</p>',
    'Hello {{client_name}},' || chr(10) || chr(10)
      || 'Invoice {{invoice_number}} for {{total_amount}} is ready. '
      || 'It is due on {{due_date}}.' || chr(10) || chr(10)
      || 'View and pay the invoice: {{document_url}}' || chr(10) || chr(10)
      || 'Thank you for your business.' || chr(10) || '{{company_name}}',
    array['client_name', 'company_name', 'invoice_number', 'total_amount',
          'due_date', 'document_url'],
    true
  ),
  (
    'invoice_reminder',
    'Payment reminder',
    'Sent before or after the due date while an invoice is unpaid.',
    'Reminder: invoice {{invoice_number}} is due on {{due_date}}',
    '<p>Hello {{client_name}},</p><p>This is a friendly reminder that invoice '
      || '<strong>{{invoice_number}}</strong> for {{balance_due}} is due on '
      || '{{due_date}}.</p><p><a href="{{document_url}}">Pay the invoice</a></p>'
      || '<p>{{company_name}}</p>',
    'Hello {{client_name}},' || chr(10) || chr(10)
      || 'This is a friendly reminder that invoice {{invoice_number}} for '
      || '{{balance_due}} is due on {{due_date}}.' || chr(10) || chr(10)
      || 'Pay the invoice: {{document_url}}' || chr(10) || chr(10)
      || '{{company_name}}',
    array['client_name', 'company_name', 'invoice_number', 'balance_due',
          'due_date', 'document_url'],
    true
  ),
  (
    'invoice_overdue',
    'Overdue notice',
    'Sent once an invoice has passed its due date.',
    'Invoice {{invoice_number}} is now overdue',
    '<p>Hello {{client_name}},</p><p>Invoice <strong>{{invoice_number}}</strong> '
      || 'for {{balance_due}} was due on {{due_date}} and is now overdue.</p>'
      || '<p><a href="{{document_url}}">Settle the invoice</a></p>'
      || '<p>If the payment is already on its way, please ignore this notice.</p>'
      || '<p>{{company_name}}</p>',
    'Hello {{client_name}},' || chr(10) || chr(10)
      || 'Invoice {{invoice_number}} for {{balance_due}} was due on {{due_date}} '
      || 'and is now overdue.' || chr(10) || chr(10)
      || 'Settle the invoice: {{document_url}}' || chr(10) || chr(10)
      || 'If the payment is already on its way, please ignore this notice.'
      || chr(10) || '{{company_name}}',
    array['client_name', 'company_name', 'invoice_number', 'balance_due',
          'due_date', 'document_url'],
    true
  ),
  (
    'payment_received',
    'Payment receipt',
    'Sent to the client once a payment has been recorded.',
    'Payment received for invoice {{invoice_number}}',
    '<p>Hello {{client_name}},</p><p>We have received {{payment_amount}} towards '
      || 'invoice <strong>{{invoice_number}}</strong>. Thank you.</p>'
      || '<p><a href="{{document_url}}">View the receipt</a></p>'
      || '<p>{{company_name}}</p>',
    'Hello {{client_name}},' || chr(10) || chr(10)
      || 'We have received {{payment_amount}} towards invoice {{invoice_number}}. '
      || 'Thank you.' || chr(10) || chr(10)
      || 'View the receipt: {{document_url}}' || chr(10) || chr(10)
      || '{{company_name}}',
    array['client_name', 'company_name', 'invoice_number', 'payment_amount',
          'document_url'],
    true
  ),
  (
    'estimate_sent',
    'Estimate sent',
    'Sent to the client when an estimate is shared for approval.',
    'Estimate {{estimate_number}} from {{company_name}}',
    '<p>Hello {{client_name}},</p><p>Estimate <strong>{{estimate_number}}</strong> '
      || 'for {{total_amount}} is ready for your review. It is valid until '
      || '{{valid_until}}.</p><p><a href="{{document_url}}">Review the estimate</a></p>'
      || '<p>{{company_name}}</p>',
    'Hello {{client_name}},' || chr(10) || chr(10)
      || 'Estimate {{estimate_number}} for {{total_amount}} is ready for your '
      || 'review. It is valid until {{valid_until}}.' || chr(10) || chr(10)
      || 'Review the estimate: {{document_url}}' || chr(10) || chr(10)
      || '{{company_name}}',
    array['client_name', 'company_name', 'estimate_number', 'total_amount',
          'valid_until', 'document_url'],
    true
  ),
  (
    'team_invitation',
    'Team invitation',
    'Sent when an owner invites a colleague to the workspace.',
    'You have been invited to join {{company_name}}',
    '<p>Hello,</p><p>{{inviter_name}} has invited you to join '
      || '<strong>{{company_name}}</strong> as {{role_name}}.</p>'
      || '<p><a href="{{action_url}}">Accept the invitation</a></p>'
      || '<p>The invitation expires on {{expires_on}}.</p>',
    'Hello,' || chr(10) || chr(10)
      || '{{inviter_name}} has invited you to join {{company_name}} as '
      || '{{role_name}}.' || chr(10) || chr(10)
      || 'Accept the invitation: {{action_url}}' || chr(10) || chr(10)
      || 'The invitation expires on {{expires_on}}.',
    array['company_name', 'inviter_name', 'role_name', 'action_url', 'expires_on'],
    true
  ),
  (
    'document_access_code',
    'Document access code',
    'Sent when an owner requires a code before a document opens.',
    'Your access code for {{company_name}}',
    '<p>Hello {{client_name}},</p><p>Your access code is '
      || '<strong>{{access_code}}</strong>. It expires in {{expires_in_minutes}} '
      || 'minutes.</p><p>If you did not request this code, you can ignore this '
      || 'message.</p>',
    'Hello {{client_name}},' || chr(10) || chr(10)
      || 'Your access code is {{access_code}}. It expires in '
      || '{{expires_in_minutes}} minutes.' || chr(10) || chr(10)
      || 'If you did not request this code, you can ignore this message.',
    array['client_name', 'company_name', 'access_code', 'expires_in_minutes'],
    true
  );

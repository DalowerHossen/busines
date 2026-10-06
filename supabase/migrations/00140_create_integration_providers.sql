-- supabase/migrations/00140_create_integration_providers.sql
-- The catalogue of everything the platform can be connected to.
--
-- A provider row describes an integration: what it is called, what fields it
-- needs, which of those fields are secret, and which environment variable the
-- platform falls back to when nobody has filled the field in. The admin panel
-- builds its forms from this table, so a new provider can be offered without
-- touching the interface code.

create table public.integration_providers (
  id uuid primary key default public.generate_uuid_v7(),

  provider_key text not null,
  name text not null,
  category text not null,
  summary text not null,

  -- Who may configure it: the platform team, a tenant, or either.
  configurable_by text not null default 'platform',

  -- The fields the form asks for. Each entry is an object with a key, a
  -- label, a type, whether it is required, whether it is secret and the
  -- environment variable it falls back to.
  field_schema jsonb not null default '[]'::jsonb,

  supports_test_mode boolean not null default true,
  supports_connection_test boolean not null default true,
  -- Where a connection test sends its request, for the providers that have
  -- a cheap read only endpoint for exactly this purpose.
  test_endpoint text,

  documentation_url text,
  logo_slug text,
  is_built_in boolean not null default true,
  is_active boolean not null default true,
  sort_order smallint not null default 100,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint integration_providers_key_check
    check (provider_key ~ '^[a-z][a-z0-9_]{2,40}$'),
  constraint integration_providers_name_check
    check (length(btrim(name)) between 2 and 80),
  constraint integration_providers_category_check
    check (category in ('payment', 'payout', 'email', 'messaging', 'storage',
                        'analytics', 'marketing', 'banking', 'intelligence',
                        'security', 'automation', 'accounting')),
  constraint integration_providers_scope_check
    check (configurable_by in ('platform', 'tenant', 'both')),
  constraint integration_providers_schema_check
    check (jsonb_typeof(field_schema) = 'array'),
  constraint integration_providers_summary_check
    check (length(btrim(summary)) between 10 and 300)
);

comment on table public.integration_providers is
  'Everything the platform can connect to, and the fields each connection needs.';

comment on column public.integration_providers.field_schema is
  'The form definition the admin panel renders, including which fields are secret.';

create unique index integration_providers_key_unique
  on public.integration_providers (provider_key);

create index integration_providers_category_idx
  on public.integration_providers (category, sort_order)
  where is_active;

-- -----------------------------------------------------------------------------
-- The providers the platform ships with
-- -----------------------------------------------------------------------------

insert into public.integration_providers (
  provider_key, name, category, summary, configurable_by, field_schema,
  supports_test_mode, test_endpoint, documentation_url, logo_slug, sort_order
)
values
  ('stripe', 'Stripe', 'payment',
   'Card payments, wallets and subscription billing in most countries.',
   'both',
   '[{"key": "secret_key", "label": "Secret key", "type": "secret", "required": true, "env_var": "STRIPE_SECRET_KEY"},
     {"key": "publishable_key", "label": "Publishable key", "type": "text", "required": true, "env_var": "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"},
     {"key": "webhook_secret", "label": "Webhook signing secret", "type": "secret", "required": true, "env_var": "STRIPE_WEBHOOK_SECRET"},
     {"key": "connect_account_id", "label": "Connect account", "type": "text", "required": false, "env_var": null}]'::jsonb,
   true, 'https://api.stripe.com/v1/balance',
   'https://stripe.com/docs/api', 'stripe', 10),

  ('paypal', 'PayPal', 'payment',
   'Wallet and card payments with buyer protection, widely recognised.',
   'both',
   '[{"key": "client_id", "label": "Client identifier", "type": "text", "required": true, "env_var": "NEXT_PUBLIC_PAYPAL_CLIENT_ID"},
     {"key": "client_secret", "label": "Client secret", "type": "secret", "required": true, "env_var": "PAYPAL_CLIENT_SECRET"},
     {"key": "webhook_id", "label": "Webhook identifier", "type": "text", "required": true, "env_var": "PAYPAL_WEBHOOK_ID"}]'::jsonb,
   true, 'https://api-m.paypal.com/v1/identity/oauth2/userinfo',
   'https://developer.paypal.com/api/rest/', 'paypal', 20),

  ('paddle', 'Paddle', 'payment',
   'Merchant of record billing that handles sales tax on your behalf.',
   'platform',
   '[{"key": "api_key", "label": "API key", "type": "secret", "required": true, "env_var": "PADDLE_API_KEY"},
     {"key": "client_token", "label": "Client token", "type": "text", "required": true, "env_var": "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN"},
     {"key": "webhook_secret", "label": "Webhook secret", "type": "secret", "required": true, "env_var": "PADDLE_WEBHOOK_SECRET"}]'::jsonb,
   true, 'https://api.paddle.com/event-types',
   'https://developer.paddle.com/', 'paddle', 30),

  ('nmi', 'NMI', 'payment',
   'Direct card processing through an NMI gateway account.',
   'both',
   '[{"key": "security_key", "label": "Security key", "type": "secret", "required": true, "env_var": "NMI_SECURITY_KEY"},
     {"key": "tokenization_key", "label": "Tokenization key", "type": "text", "required": false, "env_var": "NMI_TOKENIZATION_KEY"}]'::jsonb,
   true, 'https://secure.nmi.com/api/query.php',
   'https://docs.nmi.com/', 'nmi', 40),

  ('two_checkout', '2Checkout', 'payment',
   'Global card acceptance from Verifone, useful where Stripe is unavailable.',
   'both',
   '[{"key": "merchant_code", "label": "Merchant code", "type": "text", "required": true, "env_var": "TWO_CHECKOUT_MERCHANT_CODE"},
     {"key": "secret_key", "label": "Secret key", "type": "secret", "required": true, "env_var": "TWO_CHECKOUT_SECRET_KEY"},
     {"key": "buy_link_secret", "label": "Buy link secret", "type": "secret", "required": false, "env_var": "TWO_CHECKOUT_BUY_LINK_SECRET"}]'::jsonb,
   true, null, 'https://verifone.cloud/docs/2checkout', 'two-checkout', 50),

  ('bkash', 'bKash', 'payment',
   'Mobile wallet payments and payouts for customers in Bangladesh.',
   'both',
   '[{"key": "app_key", "label": "App key", "type": "text", "required": true, "env_var": "BKASH_APP_KEY"},
     {"key": "app_secret", "label": "App secret", "type": "secret", "required": true, "env_var": "BKASH_APP_SECRET"},
     {"key": "username", "label": "Merchant username", "type": "text", "required": true, "env_var": "BKASH_USERNAME"},
     {"key": "password", "label": "Merchant password", "type": "secret", "required": true, "env_var": "BKASH_PASSWORD"}]'::jsonb,
   true, null, 'https://developer.bka.sh/', 'bkash', 60),

  ('nagad', 'Nagad', 'payment',
   'Mobile wallet payments and payouts through the Nagad network.',
   'both',
   '[{"key": "merchant_id", "label": "Merchant identifier", "type": "text", "required": true, "env_var": "NAGAD_MERCHANT_ID"},
     {"key": "private_key", "label": "Merchant private key", "type": "secret", "required": true, "env_var": "NAGAD_PRIVATE_KEY"},
     {"key": "public_key", "label": "Nagad public key", "type": "secret", "required": true, "env_var": "NAGAD_PUBLIC_KEY"}]'::jsonb,
   true, null, 'https://nagad.com.bd/', 'nagad', 70),

  ('resend', 'Resend', 'email',
   'Transactional email delivery for invoices, reminders and receipts.',
   'platform',
   '[{"key": "api_key", "label": "API key", "type": "secret", "required": true, "env_var": "RESEND_API_KEY"},
     {"key": "from_address", "label": "Sending address", "type": "text", "required": true, "env_var": "MAIL_FROM_ADDRESS"}]'::jsonb,
   false, 'https://api.resend.com/domains',
   'https://resend.com/docs', 'resend', 80),

  ('smtp', 'SMTP server', 'email',
   'Any standards compliant mail server, for self hosted installations.',
   'both',
   '[{"key": "host", "label": "Host", "type": "text", "required": true, "env_var": "SMTP_HOST"},
     {"key": "port", "label": "Port", "type": "number", "required": true, "env_var": "SMTP_PORT"},
     {"key": "username", "label": "Username", "type": "text", "required": true, "env_var": "SMTP_USERNAME"},
     {"key": "password", "label": "Password", "type": "secret", "required": true, "env_var": "SMTP_PASSWORD"},
     {"key": "use_tls", "label": "Use TLS", "type": "boolean", "required": false, "env_var": "SMTP_USE_TLS"}]'::jsonb,
   false, null, 'https://datatracker.ietf.org/doc/html/rfc5321', 'smtp', 90),

  ('twilio', 'Twilio', 'messaging',
   'Text message reminders and one time codes in most countries.',
   'both',
   '[{"key": "account_sid", "label": "Account identifier", "type": "text", "required": true, "env_var": "TWILIO_ACCOUNT_SID"},
     {"key": "auth_token", "label": "Authentication token", "type": "secret", "required": true, "env_var": "TWILIO_AUTH_TOKEN"},
     {"key": "sender_number", "label": "Sending number", "type": "text", "required": true, "env_var": "TWILIO_SENDER_NUMBER"}]'::jsonb,
   true, 'https://api.twilio.com/2010-04-01/Accounts',
   'https://www.twilio.com/docs', 'twilio', 100),

  ('telegram_bot', 'Telegram', 'messaging',
   'Invoice notices and internal alerts delivered through a Telegram bot.',
   'both',
   '[{"key": "bot_token", "label": "Bot token", "type": "secret", "required": true, "env_var": "TELEGRAM_BOT_TOKEN"},
     {"key": "default_chat_id", "label": "Default chat", "type": "text", "required": false, "env_var": "TELEGRAM_CHAT_ID"}]'::jsonb,
   false, 'https://api.telegram.org/bot/getMe',
   'https://core.telegram.org/bots/api', 'telegram', 110),

  ('whatsapp_cloud', 'WhatsApp', 'messaging',
   'Payment reminders through the WhatsApp Business cloud interface.',
   'both',
   '[{"key": "phone_number_id", "label": "Phone number identifier", "type": "text", "required": true, "env_var": "WHATSAPP_PHONE_NUMBER_ID"},
     {"key": "access_token", "label": "Access token", "type": "secret", "required": true, "env_var": "WHATSAPP_ACCESS_TOKEN"}]'::jsonb,
   true, null, 'https://developers.facebook.com/docs/whatsapp', 'whatsapp', 120),

  ('cloudflare_r2', 'Cloudflare R2', 'storage',
   'Object storage for invoice documents and uploads, with no egress fees.',
   'both',
   '[{"key": "account_id", "label": "Account identifier", "type": "text", "required": true, "env_var": "R2_ACCOUNT_ID"},
     {"key": "access_key_id", "label": "Access key", "type": "text", "required": true, "env_var": "R2_ACCESS_KEY_ID"},
     {"key": "secret_access_key", "label": "Secret key", "type": "secret", "required": true, "env_var": "R2_SECRET_ACCESS_KEY"},
     {"key": "bucket", "label": "Bucket", "type": "text", "required": true, "env_var": "R2_BUCKET"}]'::jsonb,
   false, null, 'https://developers.cloudflare.com/r2/', 'cloudflare', 130),

  ('aws_s3', 'Amazon S3', 'storage',
   'Object storage on Amazon Web Services, including compatible services.',
   'both',
   '[{"key": "region", "label": "Region", "type": "text", "required": true, "env_var": "S3_REGION"},
     {"key": "access_key_id", "label": "Access key", "type": "text", "required": true, "env_var": "S3_ACCESS_KEY_ID"},
     {"key": "secret_access_key", "label": "Secret key", "type": "secret", "required": true, "env_var": "S3_SECRET_ACCESS_KEY"},
     {"key": "bucket", "label": "Bucket", "type": "text", "required": true, "env_var": "S3_BUCKET"},
     {"key": "endpoint", "label": "Custom endpoint", "type": "text", "required": false, "env_var": "S3_ENDPOINT"}]'::jsonb,
   false, null, 'https://docs.aws.amazon.com/s3/', 'amazon-s3', 140),

  ('google_analytics', 'Google Analytics', 'analytics',
   'Visitor and conversion measurement for the marketing pages.',
   'platform',
   '[{"key": "measurement_id", "label": "Measurement identifier", "type": "text", "required": true, "env_var": "NEXT_PUBLIC_GA_MEASUREMENT_ID"},
     {"key": "api_secret", "label": "Measurement protocol secret", "type": "secret", "required": false, "env_var": "GA_API_SECRET"}]'::jsonb,
   false, null, 'https://developers.google.com/analytics', 'google-analytics', 150),

  ('google_tag_manager', 'Google Tag Manager', 'analytics',
   'One container for every marketing and measurement tag.',
   'platform',
   '[{"key": "container_id", "label": "Container identifier", "type": "text", "required": true, "env_var": "NEXT_PUBLIC_GTM_CONTAINER_ID"}]'::jsonb,
   false, null, 'https://developers.google.com/tag-platform/tag-manager', 'google-tag-manager', 160),

  ('meta_pixel', 'Meta Pixel', 'marketing',
   'Facebook and Instagram advertising measurement with server side events.',
   'platform',
   '[{"key": "pixel_id", "label": "Pixel identifier", "type": "text", "required": true, "env_var": "NEXT_PUBLIC_META_PIXEL_ID"},
     {"key": "conversions_api_token", "label": "Conversions access token", "type": "secret", "required": false, "env_var": "META_CONVERSIONS_API_TOKEN"}]'::jsonb,
   false, null, 'https://developers.facebook.com/docs/meta-pixel', 'meta', 170),

  ('tiktok_pixel', 'TikTok Pixel', 'marketing',
   'Advertising measurement for campaigns running on TikTok.',
   'platform',
   '[{"key": "pixel_id", "label": "Pixel identifier", "type": "text", "required": true, "env_var": "NEXT_PUBLIC_TIKTOK_PIXEL_ID"},
     {"key": "access_token", "label": "Events access token", "type": "secret", "required": false, "env_var": "TIKTOK_ACCESS_TOKEN"}]'::jsonb,
   false, null, 'https://business-api.tiktok.com/', 'tiktok', 180),

  ('linkedin_insight', 'LinkedIn Insight', 'marketing',
   'Business to business advertising measurement on LinkedIn.',
   'platform',
   '[{"key": "partner_id", "label": "Partner identifier", "type": "text", "required": true, "env_var": "NEXT_PUBLIC_LINKEDIN_PARTNER_ID"}]'::jsonb,
   false, null, 'https://www.linkedin.com/help/lms', 'linkedin', 190),

  ('microsoft_clarity', 'Microsoft Clarity', 'analytics',
   'Session replay and heat maps, to see where people get stuck.',
   'platform',
   '[{"key": "project_id", "label": "Project identifier", "type": "text", "required": true, "env_var": "NEXT_PUBLIC_CLARITY_PROJECT_ID"}]'::jsonb,
   false, null, 'https://clarity.microsoft.com/', 'clarity', 200),

  ('sentry', 'Sentry', 'security',
   'Error and performance monitoring for the application and the workers.',
   'platform',
   '[{"key": "dsn", "label": "Data source name", "type": "text", "required": true, "env_var": "NEXT_PUBLIC_SENTRY_DSN"},
     {"key": "auth_token", "label": "Release token", "type": "secret", "required": false, "env_var": "SENTRY_AUTH_TOKEN"}]'::jsonb,
   false, null, 'https://docs.sentry.io/', 'sentry', 210),

  ('turnstile', 'Cloudflare Turnstile', 'security',
   'Bot protection on the sign up, sign in and payment forms.',
   'platform',
   '[{"key": "site_key", "label": "Site key", "type": "text", "required": true, "env_var": "NEXT_PUBLIC_TURNSTILE_SITE_KEY"},
     {"key": "secret_key", "label": "Secret key", "type": "secret", "required": true, "env_var": "TURNSTILE_SECRET_KEY"}]'::jsonb,
   false, 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
   'https://developers.cloudflare.com/turnstile/', 'cloudflare', 220),

  ('plaid', 'Plaid', 'banking',
   'Bank feeds that bring statement lines in for reconciliation.',
   'both',
   '[{"key": "client_id", "label": "Client identifier", "type": "text", "required": true, "env_var": "PLAID_CLIENT_ID"},
     {"key": "secret", "label": "Secret", "type": "secret", "required": true, "env_var": "PLAID_SECRET"},
     {"key": "environment", "label": "Environment", "type": "text", "required": true, "env_var": "PLAID_ENVIRONMENT"}]'::jsonb,
   true, null, 'https://plaid.com/docs/', 'plaid', 230),

  ('receipt_ocr', 'Receipt reading', 'intelligence',
   'Reads the supplier, date and total from a photographed receipt.',
   'platform',
   '[{"key": "api_key", "label": "API key", "type": "secret", "required": true, "env_var": "OCR_API_KEY"},
     {"key": "endpoint", "label": "Endpoint", "type": "text", "required": true, "env_var": "OCR_ENDPOINT"}]'::jsonb,
   true, null, 'https://kdsolutionit.com/docs/receipt-reading', 'ocr', 240),

  ('zapier', 'Zapier', 'automation',
   'Connects the platform to thousands of other business applications.',
   'both',
   '[{"key": "api_key", "label": "API key", "type": "secret", "required": true, "env_var": "ZAPIER_API_KEY"}]'::jsonb,
   false, null, 'https://platform.zapier.com/', 'zapier', 250),

  ('custom_gateway', 'Custom payment gateway', 'payment',
   'Any provider that is not listed, described entirely by its configuration.',
   'both',
   '[{"key": "base_url", "label": "Base address", "type": "text", "required": true, "env_var": null},
     {"key": "api_key", "label": "API key", "type": "secret", "required": true, "env_var": null},
     {"key": "api_secret", "label": "API secret", "type": "secret", "required": false, "env_var": null},
     {"key": "adapter_config", "label": "Adapter configuration", "type": "json", "required": true, "env_var": null}]'::jsonb,
   true, null, 'https://kdsolutionit.com/docs/custom-gateway', 'custom', 260);

-- Some connections are a single identifier dropped into a page, with nothing
-- to call and therefore nothing to test. Those are marked here so the admin
-- panel does not offer a test button that could never do anything.
update public.integration_providers
   set supports_connection_test = false
 where provider_key in ('google_analytics', 'google_tag_manager', 'meta_pixel',
                        'tiktok_pixel', 'linkedin_insight', 'microsoft_clarity',
                        'sentry');

-- The fields of one provider, in the order the form shows them.
create or replace function public.integration_fields(p_provider_key text)
returns table (
  field_key text,
  label text,
  field_type text,
  is_required boolean,
  is_secret boolean,
  env_var text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select entry ->> 'key',
         entry ->> 'label',
         entry ->> 'type',
         coalesce((entry ->> 'required')::boolean, false),
         (entry ->> 'type') = 'secret',
         entry ->> 'env_var'
    from public.integration_providers as p
    cross join lateral jsonb_array_elements(p.field_schema) as entry
   where p.provider_key = p_provider_key;
$$;

comment on function public.integration_fields(text) is
  'Returns the form fields one provider needs, including which are secret.';

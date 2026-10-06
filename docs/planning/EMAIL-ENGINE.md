# Transactional email engine

This phase adds the server-side transactional email boundary used by
welcome, invoice/estimate, status/reminder, subscription, and system mail.
The database already provides versioned `email_templates`, queued
`message_deliveries`, and provider delivery-event tables. Migration `00165`
adds hashed/encrypted suppression records and migration `00166` seeds the
English transactional templates. The application entry point is
`sendPlatformMail`; it returns a safe result and records a provider failure
without throwing the caller's business action.

## Supported provider contracts

### Resend Email API

`ResendApiAdapter` uses the documented `POST https://api.resend.com/emails`
contract with Bearer API-key authentication and the documented `from`, `to`,
`subject`, `html`, `text`, and optional `reply_to` fields. Recipient count is
bounded to the documented API maximum of 50. The response ID is the durable
provider message identifier.

### Resend SMTP

`SmtpEmailAdapter` implements the documented Resend SMTP settings without a
third-party mail library:

- host and port are configuration; the Resend defaults are `smtp.resend.com`
  and port `587`;
- the documented username is `resend` and the API key is the password;
- port 587 uses EHLO, STARTTLS, EHLO, AUTH LOGIN, MAIL FROM, RCPT TO, DATA,
  and QUIT; port 465 can be configured for implicit TLS;
- multipart/alternative output includes both plain-text and HTML bodies;
- header injection is rejected and SMTP response bodies are not included in
  errors.

A verified sending domain remains a provider prerequisite. The engine does
not silently rewrite an unverified From address.

Authoritative references reviewed:

- <https://resend.com/docs/api-reference/emails/send-email>
- <https://resend.com/docs/send-with-smtp>
- <https://resend.com/docs/dashboard/domains/introduction>

## Template and failure policy

`renderEmailTemplate` renders subject, HTML, and text fields from the database
snapshot. Variable values are HTML-escaped in the HTML body, preventing a
client name or invoice field from injecting markup. The subject and text
versions are rendered separately and all three output fields are required.

`sendTemplatedPlatformMail` and `sendPlatformMail` return `sent: false` for
provider, configuration, or template failures. They attempt to record a
sanitized failure code through `EmailFailureLogger`; even if that logger
fails, the original business action is not blocked. Raw provider error bodies,
API keys, SMTP passwords, and recipient values are never put into the error
result.

`asCommunicationEmailAdapter` lets the existing consent-aware communication
router use an email adapter as the final fallback channel with a fixed subject.
A worker must claim the `message_deliveries` company/idempotency key before
calling a provider. `processClaimedEmail` provides that queue contract. The
provider call and delivery status update are separate from the business
transaction. Retryability is returned as metadata so the queue can retry only
provider/network failures and not invalid templates or credentials.

Resend webhook verification uses the raw body plus `svix-id`,
`svix-timestamp`, and `svix-signature` with the documented `whsec_` signing
secret. The normalized event parser handles sent, delivered, delayed, failed,
bounced, complained, opened, clicked, and suppressed email events. Hard
bounces, complaints, and provider suppressions can be written to the
HMAC-lookup suppression store; plaintext addresses are not used as lookup
keys.

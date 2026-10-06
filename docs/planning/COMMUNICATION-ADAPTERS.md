# Communication adapters and routing

This phase implements the server-side communication foundation for WhatsApp,
SMS, Telegram, and Viber. The database queue, templates, consent records,
automation rules, campaign rows, and webhook inbox already exist in
migrations `00080` through `00092`; this phase adds the provider adapters,
signature verification, normalized inbound events, consent-aware fallback
routing, template rendering, and monotonic delivery-state transitions.

## Provider contracts used

The request shapes are limited to the documented official APIs:

- WhatsApp Cloud API Messages: the Graph API `/{version}/{phone-number-id}/messages`
  endpoint with Bearer access token, `messaging_product`, individual recipient,
  text message, or approved template message. Text body validation follows
  Meta's documented 4096-character limit. Webhook POSTs use the documented
  `X-Hub-Signature-256` HMAC validation and GET subscription challenge.
- Twilio Programmable Messaging: the documented Messages resource at
  `/2010-04-01/Accounts/{AccountSid}/Messages.json` using Basic authentication
  and `Body`, `To`, `From` or `MessagingServiceSid`, and optional
  `StatusCallback` form fields. Twilio's documented `X-Twilio-Signature`
  validation signs the callback URL plus sorted form values.
- Telegram Bot API: the documented `sendMessage` and `setWebhook` methods,
  with `chat_id` and `text`, and the documented
  `X-Telegram-Bot-Api-Secret-Token` webhook header.
- Viber REST Bot API: the documented `/pa/send_message` and
  `/pa/set_webhook` methods, `X-Viber-Auth-Token` authorization, and
  `X-Viber-Content-Signature` HMAC webhook validation.

Authoritative references reviewed:

- <https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages/>
- <https://developers.facebook.com/docs/whatsapp/cloud-api/messages/template-messages>
- <https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components>
- <https://www.twilio.com/docs/messaging/api/message-resource>
- <https://www.twilio.com/docs/usage/security#validating-requests>
- <https://core.telegram.org/bots/api>
- <https://developers.viber.com/docs/api/rest-bot-api/>

Provider versions, credentials, tokens, and webhook secrets are constructor
inputs and must come from trusted server-side secret resolution. They are not
read from browser payloads, source code, or ordinary error messages.

## Delivery and consent rules

`sendWithFallback` only attempts a candidate when:

1. the channel has a non-empty configured address;
2. the address is enabled;
3. the client has a valid opt-in timestamp; and
4. an adapter is connected for the channel.

An opt-out at or after the opt-in timestamp blocks delivery. A missing,
malformed, or future opt-in also blocks delivery. Fallback channels are
unique, ordered, and attempted only after the previous candidate is skipped or
fails. Every attempt is returned with a safe reason; provider response bodies,
credentials, and contact data are never copied into thrown error messages.

The `message_deliveries` database unique idempotency key is the duplicate-send
boundary. The router derives a channel-specific key for each attempt. The
`sendClaimedMessage` contract requires a worker to claim that key atomically,
record `sending`, call the adapter, then record `sent` or `failed`. Twilio's
Messages API does not provide a provider idempotency header in the documented
create-message contract, so a retry must not call the provider after a
successful claim has already been recorded.

## WhatsApp template boundary

The database retains platform or tenant templates and Meta approval state.
The adapter sends only an approved template with a provider template ID. The
implementation does not invent a Meta template-create or approval endpoint;
submission and approval synchronization must use the official Business
Manager/Graph API configuration when that integration is enabled.

## Webhook boundary

Provider webhooks are verified against the raw request body before parsing.
After verification, `parseProviderWebhook` normalizes provider-specific
payloads to one inbound event shape. The caller must persist the provider
channel/event ID using the unique webhook inbox key before applying state.
Delivery status is advanced through `advanceMessageStatus`, which rejects
out-of-order regressions and never replaces a terminal read/cancelled state.

The adapters intentionally do not persist directly. The later server-action
and worker phases will connect these contracts to `message_deliveries`,
`message_delivery_events`, `communication_webhook_events`, campaign rows, and
existing audit logs using the repository's Supabase/encryption clients.

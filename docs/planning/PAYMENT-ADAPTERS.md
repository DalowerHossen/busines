# Payment adapter implementation

This module keeps provider-specific API contracts behind a normalized,
server-only interface in `src/lib/payments/`.

## Security invariants

- Browser code sends only provider-issued tokens or checkout identifiers to a
  server action. Raw PAN, CVV, bank-account, and ACH fields are not accepted by
  the normalized request type.
- NMI uses Collect.js or the Payment Component in the browser, then sends the
  one-time `payment_token` under `payment_details.payment_token` to the NMI
  REST Payment API. The private security key is server-only.
- Provider credentials are injected into adapter constructors. No credential is
  stored in source, a migration, a database seed, or a client bundle.
- Provider errors expose only a stable generic message. Response bodies are not
  copied into logs or thrown error messages.
- Every retry receives an idempotency or duplicate-prevention key: Stripe
  `Idempotency-Key`, PayPal `PayPal-Request-Id`, Paddle `Idempotency-Key`,
  Adyen `Idempotency-Key`, Nium `x-request-id`, NMI duplicate checking, and a
  locally unique `ExternalReference` for 2Checkout because its documented REST
  API does not provide a generic idempotency header.

## Implemented provider contracts

| Adapter   | Official API operations                                                                   | Webhook rule                                                                             |
| --------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Stripe    | PaymentIntents, capture, refunds                                                          | Verify `Stripe-Signature` against the raw body.                                          |
| PayPal    | OAuth 2.0, Orders create/capture, capture refunds                                         | Use PayPal's webhook verification endpoint.                                              |
| Paddle    | Billing transactions, subscription cancellation, adjustments                              | Verify raw body with `Paddle-Signature`; persist `event_id` and compare `occurred_at`.   |
| NMI       | Collect.js token -> REST sale; legacy capture/refund operations for existing transactions | Verify the configured HMAC signature before parsing the event.                           |
| 2Checkout | REST v6 order, order lookup, order refund                                                 | Verify IPN/INS `HASH` using the documented SHA-256 or SHA3-256 HMAC field serialization. |
| Adyen     | Checkout `/payments`, capture, refund                                                     | Verify the standard notification HMAC over Adyen's seven signed fields.                  |
| Nium      | Separate payout, payin, FX quote, FX conversion, and status operations                    | Verify the configured signed event and use `x-request-id` for replay deduplication.      |

Nium is deliberately not returned by `createPaymentAdapter`: it is a payout,
payin, wallet, and FX rail rather than a card checkout gateway.

## Custom and local configurations

`CustomGatewayAdapter` and `LocalRailAdapter` require a trusted configuration
object. The configuration must provide the provider's documented HTTPS base URL,
relative operation paths, request body templates, response paths, authentication
scheme, provider idempotency header, and webhook HMAC fields. Templates expose
only normalized values such as `$amountMinor`, `$currency`,
`$paymentMethodToken`, `$destinationToken`, and `$idempotencyKey`; raw card and
bank-account fields are not available as template variables.

The local rail adapter additionally requires a payout operation and payout
response mapping. `ManualBankTransferAdapter` never makes an external request:
it creates a deterministic pending reference from the local idempotency key and
only marks it captured when a trusted reconciliation action calls capture.

A custom configuration must be loaded from encrypted, administrator-controlled
settings at runtime. It must not be hard-coded in source, migrations, or seed
content.

## Webhook processing contract

An adapter returns a verified `VerifiedWebhookEvent`. Application code must
then call `claimWebhookEvent` with an atomic store backed by the unique
`(gateway, gateway_event_id)` constraint. Duplicate claims are acknowledged
without reapplying business state. For providers that include event timestamps,
an older event is retained for audit but must not roll a transaction backward.

## Official references

- [Stripe API](https://docs.stripe.com/api) and [Stripe webhook handling](https://docs.stripe.com/webhooks/handling-payment-events)
- [PayPal Orders API](https://developer.paypal.com/docs/api/orders/v1/) and [request idempotency](https://developer.paypal.com/api/rest/requests)
- [Paddle API reference](https://developer.paddle.com/api-reference/overview) and [webhooks](https://developer.paddle.com/webhooks/about/how-webhooks-work/)
- [NMI Collect.js](https://secure.nmi.com/merchants/resources/integration/download.php?document=collectjs&tid=09e035de4f36891bcd87e89a456d2082), [REST sale](https://docs.nmi.com/reference/create-sale-v5), and [transaction events](https://docs.nmi.com/reference/transaction-events)
- [2Checkout APIs](https://docs.2checkout.com/2checkout-apis), [API authentication](https://docs.2checkout.com/get-started-with-the-2checkout-api/get-started-with-the-2checkout-api/authentication-and-use-cases/api-authentication), and [IPN](https://docs.2checkout.com/2checkout-apis/2checkout-apis/webhooks/instant-payment-notification-ipn)
- [Adyen API Explorer](https://docs.adyen.com/api-explorer/) and [API idempotency](https://docs.adyen.com/development-resources/api-idempotency)
- [Nium developer documentation](https://docs.nium.com/docs/developers), [FX](https://docs.nium.com/docs/foreign-exchange), and [notifications](https://docs.nium.com/docs/developers/notifications-and-webhooks)

Live or sandbox API calls are intentionally not made by this repository
implementation without merchant credentials.

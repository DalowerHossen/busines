# Ecommerce Connectors

Phase 30 provides server-side Shopify and WooCommerce order synchronisation, verified webhook intake, normalized order contracts, and a hosted-checkout bridge. The implementation is provider-neutral at the platform boundary and uses only provider-issued identifiers and provider-hosted payment pages.

## Provider contracts

### Shopify Admin GraphQL

`ShopifyAdminClient` sends `POST /admin/api/{version}/graphql.json` to the configured HTTPS shop origin. It authenticates with `X-Shopify-Access-Token` and uses the documented Admin GraphQL `orders` query.

Order synchronization uses:

- the `orders` connection;
- `first`, `after`, and `pageInfo.hasNextPage/endCursor` cursor pagination;
- `sortKey: UPDATED_AT` and `reverse: false`;
- an optional `updated_at:>=...` query filter;
- a maximum page size of 250, matching the GraphQL connection limit used by the adapter.

The query requests the documented order money sets, customer/address fields, line items, product and variant IDs, and line tax lines. Amounts remain decimal strings until persistence. GraphQL errors and mutation user errors are converted into sanitized permanent provider errors.

Shopify order webhook subscriptions use the Admin GraphQL `webhookSubscriptionCreate` mutation with `WebhookSubscriptionTopic` and the documented `uri` field. Supported order topics are `ORDERS_CREATE`, `ORDERS_PAID`, `ORDERS_UPDATED`, `ORDER_EDITED`, `ORDERS_FULFILLED`, and `ORDERS_CANCELLED`.

### WooCommerce REST API v3

`WooCommerceClient` sends requests to the configured HTTPS origin under `/wp-json/wc/v3`. It uses HTTPS Basic Auth with the WooCommerce consumer key and consumer secret. It never puts credentials into a browser request or a log message.

Order synchronization uses `GET /wp-json/wc/v3/orders` with the documented parameters:

- `page` and `per_page` pagination;
- `orderby=modified` and `order=asc` for a stable incremental walk;
- optional `modified_after` filtering;
- `X-WP-Total` and `X-WP-TotalPages` response headers for page metadata.

WooCommerce monetary values are read and retained as strings. The adapter accepts only documented order and line-item fields. Provider order errors are sanitized and classified as retryable for network, timeout, conflict, rate-limit, and server responses; authentication, permission, validation, and malformed-response errors are permanent.

## Webhook verification and idempotency

Webhook handlers must receive the untouched request body. They verify the body before JSON parsing, persistence, or business processing:

- Shopify: base64 HMAC-SHA256 of the raw body with the app/client secret, compared with `X-Shopify-Hmac-Sha256`.
- WooCommerce: base64 HMAC-SHA256 of the raw body with the configured webhook secret, compared with `X-WC-Webhook-Signature`.

The Shopify event key is `X-Shopify-Webhook-Id`. The WooCommerce event key is `X-WC-Webhook-Delivery-Id`. Topics are read from `X-Shopify-Topic` and `X-WC-Webhook-Topic` respectively.

`EcommerceWebhookEventClaimStore` is the application persistence contract. Its implementation must atomically claim `(connection_id, provider_event_id)` using the unique key already provided by `ecommerce_webhook_events`. A failed claim is a duplicate and must not be processed again. A verified event is persisted with `signature_verified=true` only after successful verification.

## Normalized order mapping

`normalizeShopifyOrder` and `normalizeWooCommerceOrder` produce the fields required by `ecommerce_orders` and `ecommerce_order_line_items`:

- provider order and line IDs remain strings;
- provider product, variant, and SKU identifiers are retained for product mapping;
- quantity and all money amounts are decimal strings;
- order status is normalized to `pending`, `paid`, `fulfilled`, `cancelled`, `refunded`, or `failed`;
- customer and billing/shipping addresses are snapshots;
- the provider payload is retained as an object for the existing raw-payload column;
- decimal arithmetic uses `decimal.js`; JavaScript floating-point money arithmetic is not used.

Application persistence must upsert an order by `(connection_id, external_order_id)` and its lines by `(order_id, external_line_id)`. Mapping and invoice/payment linkage remain platform responsibilities and are intentionally separate from provider adapters.

## Direct checkout bridge

The direct-checkout bridge creates the existing `direct_checkout_sessions` record before contacting a provider. Its store contract requires an atomic lookup/create operation for `(company_id, idempotency_key)`, provider-session attachment, and failure marking. A duplicate idempotency key returns the existing session rather than creating another provider checkout.

### API-key boundaries

- Browser-facing checkout creation authenticates with the publishable key hash and the request `Origin` must match a configured allowed origin.
- Secret keys are server-only and are verified against their one-way SHA-256 hash for trusted server operations.
- Key status and expiry are checked before either operation.
- Success and cancel URLs must be HTTPS and must use an allowed origin.
- Only key prefixes and hashes belong in the database; plaintext keys are provisioning-time values and are not returned by connector code.

### Shopify checkout

`ShopifyStorefrontClient` sends the documented `cartCreate` mutation to `/api/{version}/graphql.json` with `X-Shopify-Storefront-Access-Token`. It passes Storefront merchandise IDs and quantities, optionally passes the documented buyer identity email, and returns the provider cart `id` plus its `checkoutUrl`. The buyer is handed off to Shopify-hosted web checkout. The platform never accepts card, CVV, bank-account, or ACH data.

The Shopify direct-checkout provider requires each mapped line to contain a Storefront merchandise ID in the mapped external variant field. It does not guess a product-to-variant conversion.

### WooCommerce checkout

`WooCommerceClient.createHostedCheckout` uses the documented REST order-creation contract at `POST /wp-json/wc/v3/orders` with HTTPS Basic Auth, `status=pending`, `set_paid=false`, documented currency, billing email when available, and documented product/variation line items. It requires the returned documented order `payment_url` to be an HTTPS URL and hands that provider-hosted payment URL to the buyer.

The adapter does not submit payment data, invent a gateway payload, or use a non-documented idempotency header. Platform idempotency is enforced by the existing direct-checkout session before the REST order request. A WooCommerce installation must expose a valid hosted payment URL for this bridge; otherwise the response is rejected rather than falling back to a platform card form.

### Signed callbacks

`checkoutCallbackHeaders` signs the exact JSON callback body with the decrypted endpoint signing secret using HMAC-SHA256 and emits a `v1={base64}` signature in `X-Checkout-Signature`, together with the event ID in `X-Checkout-Event-Id`. Callback delivery uses the existing `direct_checkout_webhook_endpoints` record and its retry policy. Signing secrets are never returned or persisted in plaintext by this module.

## Verification

The provider adapters accept an injected `fetch` implementation for deterministic tests. No live credentials are required for verification. `npm run verify:ecommerce` covers the base64 and hexadecimal HMAC primitives with tamper cases. The full `npm run verify` additionally runs the language, placeholder, TypeScript, ESLint, and Prettier checks.

Official references:

- [Shopify Admin GraphQL orders](https://shopify.dev/docs/api/admin-graphql/latest/queries/orders)
- [Shopify webhookSubscriptionCreate](https://shopify.dev/docs/api/admin-graphql/latest/mutations/webhookSubscriptionCreate)
- [Shopify Storefront Cart](https://shopify.dev/docs/api/storefront/latest/objects/Cart)
- [Shopify Storefront cartLinesAdd](https://shopify.dev/docs/api/storefront/latest/mutations/cartLinesAdd)
- [WooCommerce REST API v3](https://developer.woocommerce.com/docs/apis/rest-api/v3/)
- [WooCommerce REST API orders](https://woocommerce.github.io/woocommerce-rest-api-docs/)
- [WooCommerce webhook signatures](https://developer.woocommerce.com/docs/apis/rest-api/v3/webhooks/)

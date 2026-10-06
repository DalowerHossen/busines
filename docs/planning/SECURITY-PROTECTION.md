# Security and Bot Protection

Phase 31 adds the reusable protection layer required by FF3. It is deliberately split into edge-safe request classification and server-only verification. A route handler must still call `protectRequest` for every authentication, payment, checkout, API, signup, password-reset, and contact mutation; middleware is not a substitute for server-side validation.

## Request flow

1. `src/middleware.ts` creates a per-request nonce, forwards it as `x-nonce`, applies the nonce-based Content Security Policy, and adds baseline security headers.
2. Middleware classifies the request User-Agent. Known AI crawlers are allowed on ordinary public pages so `robots.txt` remains the policy boundary for public indexing, but are blocked from authentication, API, checkout, payment, and other sensitive paths. Automation signatures on sensitive paths receive a Turnstile challenge signal.
3. The route handler calls `protectRequest` with the request snapshot, route class, database-backed `RateLimitStore`, route policy, honeypot payload, and Turnstile token.
4. `protectRequest` blocks known abusive crawlers, checks the composite rate-limit bucket, rejects a tripped honeypot, and verifies Turnstile before business logic. Rate-limit keys include route, method, hashed IP, account identifier, normalized User-Agent, and an optional request fingerprint; they are not IP-only.
5. For state-changing browser requests, the route also verifies the HMAC-bound CSRF token and same-origin `Origin` using `csrf.ts`.

## Cloudflare Turnstile

`CloudflareTurnstileValidator` uses the official server-side Siteverify contract:

- `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`;
- `application/x-www-form-urlencoded` `secret` and `response` fields;
- optional `remoteip` and official `idempotency_key` fields;
- optional expected action and hostname checks after Cloudflare returns success;
- a maximum 2,048-character token and UUID validation for idempotency keys.

The secret is server-only. The browser receives only `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Provider responses and failure messages are sanitized; network, timeout, rate-limit, and server failures are retryable, while invalid tokens and action/hostname mismatches are rejected without exposing provider internals.

## Honeypots and form timing

Public signup, login, password-reset, contact, and payment forms should render a visually hidden `website` field and a client-side `form_started_at` timestamp. The server calls `assessHoneypot` and then removes those fields with `stripHoneypotFields` before validation or persistence. A filled honeypot, invalid timestamp, or submission faster than the configured minimum is rejected as suspicious. These signals are intentionally not trusted as the only control.

## Brute-force lockout and signup reputation

`login-abuse.ts` provides a server-only, hashed identifier contract for login velocity and temporary lockout. The store must atomically count failures, apply the configured failure window and lockout duration, clear failures after a successful login, and never retain passwords. `email-reputation.ts` normalizes only the email domain and delegates disposable-domain and reputation decisions to an injected checker; no guessed third-party reputation endpoint is embedded in the platform. Both boundaries are ready for authentication and signup route handlers without putting provider credentials in the browser.

`SecurityObservationSink` is an optional server-side sink on `protectRequest`. It records bot blocks, Turnstile pass/fail, honeypot trips, rate-limit blocks, and rate-limit-store outages for the later super-admin security monitoring dashboard. A monitoring outage never changes an already computed protection decision.

## Rate limits

`00167_security_rate_limit_buckets.sql` adds an atomic PostgreSQL bucket function. `createSupabaseRateLimitStore` calls it through the server-only Supabase client. The function locks one hashed bucket row, resets expired windows, increments accepted requests, and returns `allowed`, `remaining`, and `reset_at`. It is executable only by `service_role`; browser roles cannot read or manipulate abuse counters.

Suggested policies are:

| Policy        | Route family                       | Limit |      Window |
| ------------- | ---------------------------------- | ----: | ----------: |
| `auth`        | login, signup, reset, verification |     5 |  60 seconds |
| `contact`     | public contact submission          |     3 | 300 seconds |
| `payment`     | payment and checkout mutations     |    10 |  60 seconds |
| `api`         | tenant API mutations               |    60 |  60 seconds |
| `public-read` | public content                     |   120 |  60 seconds |

Authentication, payment, and API policies fail closed when the rate-limit store is unavailable. A public-read policy may explicitly opt into fail-open behavior, but a store failure must remain observable by the caller's monitoring layer.

## CSP and response headers

The middleware nonce is included in `script-src` with `strict-dynamic`; `object-src`, `base-uri`, `form-action`, and `frame-ancestors` are restricted. Styles remain compatible with the current Next.js rendering setup. Turnstile's documented challenge origin is present in `connect-src` and `frame-src`. No `unsafe-eval` is enabled.

Baseline headers include `nosniff`, `DENY` framing, strict referrer policy, HSTS, Permissions Policy, Cross-Origin Opener/Resource Policy, `Origin-Agent-Cluster`, and `X-Permitted-Cross-Domain-Policies`. Tokenized `/i/*`, `/pay/*`, authentication, and sensitive paths are marked noindex and no-referrer.

## Robots and disclosure

`public/robots.txt` allows ordinary public SEO crawlers to index public content, disallows application and tokenized paths, and disallows known AI training crawlers including GPTBot, CCBot, ClaudeBot, Google-Extended, Bytespider, and PerplexityBot. `public/.well-known/security.txt` publishes the security contact, policy, canonical URL, and expiry date.

Robots directives are advisory. Middleware and route-level controls remain responsible for protecting credentials, account data, payments, and non-public content.

## Edge and WAF deployment contract

The existing production Nginx configuration remains the first coarse-grained layer: TLS termination, request body size limit, general throttling, and stricter auth throttling. Netlify or Cloudflare front doors should mirror these rules:

- cache only public static assets; bypass cache for auth, API, payment, checkout, and tokenized routes;
- enforce HTTPS and forward the original host and client IP through trusted proxy headers only;
- rate-limit login, signup, reset, payment, and webhook paths independently;
- challenge or block known automation and AI crawler User-Agents on non-public paths;
- reject oversized bodies before they reach a function;
- keep provider webhook routes available to their signature-verification handler and do not replace raw bodies with parsed or transformed payloads.

The edge is not an authorization boundary. Every origin handler repeats authentication, CSRF, honeypot, Turnstile, rate-limit, and signature checks as applicable.

## OWASP self-audit checklist

- [x] Input and token length validation before provider calls.
- [x] Secret keys server-only; no client bundle or log path accepts them.
- [x] Parameterized database RPC and service-role-only rate-limit mutation.
- [x] Composite abuse keys and fail-closed sensitive policies.
- [x] Nonce-based CSP with no `unsafe-eval`.
- [x] Same-origin and HMAC-bound CSRF contract.
- [x] Honeypot fields treated as an additional signal, not authentication.
- [x] Sanitized provider errors and explicit retry classification.
- [x] Robots, tokenized-route noindex controls, and vulnerability disclosure metadata.
- [ ] A production WAF rule set must be applied in the selected deployment account before launch.

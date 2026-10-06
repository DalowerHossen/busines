# Supabase clients and security boundary

Phase 20 establishes the application-side boundary over the Phase 17-19
Postgres policies and functions.

## Client selection

- `src/lib/supabase/browser.ts` creates the singleton publishable-key client
  for Client Components. It persists only the Supabase Auth session.
- `src/lib/supabase/server.ts` creates a request-scoped `@supabase/ssr`
  client using Auth cookies. Server Components use `getUser()`, not an
  unverified session payload, for authentication.
- `src/lib/supabase/admin.ts` is `server-only` and uses the service-role key.
  It is allowed only in repositories, provider callbacks, and scheduled
  workers that repeat authorization, tenant, validation, and idempotency
  checks.
- `src/lib/supabase/middleware.ts` refreshes the cookie session at the Edge
  boundary. `src/middleware.ts` also redirects unauthenticated requests from
  authenticated product prefixes to the login page.
- `src/lib/supabase/realtime.ts` validates UUIDs and table/channel identifiers
  before creating company-filtered Realtime subscriptions. RLS remains the
  authoritative authorization check.
- `src/lib/supabase/tenant.ts` exposes a server-side tenant guard that calls
  the database authorization helpers before a repository builds a query.

## Secret handling

`src/lib/security/encryption.ts` implements AES-256-GCM with a 12-byte nonce,
separate authentication tag, and a versioned envelope. `key-vault.ts` stores
only that envelope in `system_settings.value_encrypted`; `ENCRYPTION_KEY`
remains server-only. Database value resolution is company scope first, then
platform scope, then an explicitly supplied environment fallback.

Error messages never include key material or provider responses. Raw payment
card data is not accepted by these helpers.

## Request protection and audit

- CSRF state-changing routes must pass both same-origin and HMAC token checks.
- Rate limits use the atomic `consume_security_rate_limit` database function.
  Login-abuse storage is available only through a service-role-backed store.
- `recordAuditEvent` redacts credential-like fields before writing the existing
  `audit_logs` table. Phase 19 database triggers remain the row-mutation audit
  layer.
- `assertTenantAccess` is an application preflight, never a replacement for
  RLS. The server/admin client is not exposed through a generic API route.

The middleware, encryption, tenant, and audit helpers are deliberately
provider-neutral. No undocumented third-party request contract is introduced
by this phase.

<!-- docs/ENVIRONMENT-VARIABLES.md -->

# Environment variables reference

The source of truth for every variable name is `.env.example` at the
repository root. This document explains the rules around them; keep both
files in sync when a variable is added, renamed, or removed.

## Public vs. server-only

- Only variables that are genuinely safe to ship to the browser are
  prefixed `NEXT_PUBLIC_`. Today that is limited to the site URL, the
  Supabase project URL and anon key, the optional CDN asset base URL, and
  publishable/client-side keys for payment gateways that require one
  (Stripe publishable key, PayPal client id, and similar).
- `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `ENCRYPTION_KEY` must
  never be exposed to the client under any circumstance. They are read only
  in Server Components, Server Actions, and Route Handlers.
- Every payment gateway secret key, webhook signing secret, and OAuth
  client secret is server-only.

## Resolution order

Configuration values that a company can override from the dashboard follow
this precedence, highest first:

1. A value stored in the database for that specific company (for example, a
   company's own branding, a per-company fee override, or a per-company
   gateway credential).
2. The corresponding environment variable, used as the platform-wide
   default.
3. A hard-coded default in code, used only when neither of the above is
   set, and only for genuinely optional settings.

## `ENCRYPTION_KEY` is permanent

`ENCRYPTION_KEY` encrypts secrets stored in the database (for example,
per-company gateway credentials). It must be generated once during initial
setup and never rotated, because rotating it makes every previously
encrypted value unreadable. Back it up securely outside the database.

## Storage provider

`STORAGE_PROVIDER` defaults to `google_drive`. Supabase Postgres never
stores file binaries, only metadata (file id, link, mime type, size). See
`docs/planning/ARCHITECTURE-DECISIONS.md` section 7 for the full rationale
and `docs/SETUP.md` for the Google Drive service account setup steps. The
same pluggable interface also supports Cloudflare R2, S3, Backblaze B2, and
local disk (local disk is development-only, never for production).

## Payment gateways

Every gateway is implemented behind one generic adapter interface. Add a
gateway's environment variables only when that gateway is actually enabled
for the platform or for a specific company; an unused gateway's variables
can stay blank. Supported gateways today: Stripe, PayPal, Paddle, NMI,
2Checkout, Adyen for Platforms, Nium, and two configurable local payment
rails, plus a manual/custom gateway slot for anything else. Public-facing
copy never names a specific gateway or country-specific brand - see
`docs/planning/ARCHITECTURE-DECISIONS.md` section 4.

## Adding a new variable

1. Add it to `.env.example` with a realistic placeholder value and a
   comment explaining what it is for.
2. Add it to this document under the relevant section.
3. If it is a secret, confirm it is not prefixed `NEXT_PUBLIC_`.
4. If a deployment target needs it (Netlify, Vercel, Docker, VPS), add it to
   that target's secret store and note it in the matching
   `docs/DEPLOYMENT-*.md` guide if it is not obvious.

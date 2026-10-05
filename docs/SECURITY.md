<!-- docs/SECURITY.md -->

# Security practices

This document describes how KD SOLUTION IT is built to be secure. For how
to report a vulnerability, see `.github/SECURITY.md`. The detailed,
numbered security requirements live in `docs/planning/FEATURE-REGISTRY.md`
(groups Y, Z, AA) and `docs/planning/GAP-ADDITIONS-FF.md` (group FF); this
page is a practitioner-facing summary, not the source of truth for scope.

## Secrets management

- `.env` is never committed; `.env.example` documents every variable with a
  placeholder value only.
- `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ENCRYPTION_KEY`, and every
  payment gateway secret key are server-only and never reach the browser
  bundle.
- `ENCRYPTION_KEY` is generated once and never rotated; it encrypts
  per-company gateway credentials stored in the database.
- `.github/dependabot.yml` and `.github/workflows/security-scan.yml` scan
  for vulnerable dependencies and committed secrets on every push and
  weekly on a schedule.

## Access control

- Six account roles exist: `super_admin`, `reseller`, `owner`, `staff`,
  `accountant`, `affiliate`. Every role's exact permissions are defined in
  `docs/planning/ARCHITECTURE-DECISIONS.md` section 1.
- Clients never get an account. They access invoices and payment pages
  through HMAC-signed, no-login tokenised links with an optional email-OTP
  gate (owner-configurable, default off), per
  `docs/planning/ARCHITECTURE-DECISIONS.md` section 2.
- Every database query is scoped by `company_id` and excludes soft-deleted
  rows (`deleted_at IS NULL`). Row Level Security policies enforce this at
  the database layer in addition to application-layer checks.
- The affiliate role is fully blind: it can see only its own clicks,
  signups, commission, and payouts, never which company or client it
  referred.

## Payment security

- Card payments can be switched on or off per company, independently of
  3-D Secure.
- 3-D Secure is an explicit toggle, default off, with a global
  (`super_admin`) default and a per-company override. It is never forced.
  See `docs/planning/ARCHITECTURE-DECISIONS.md` section 5 and
  `docs/planning/GAP-ADDITIONS-FF.md` FF4 for the correction history.
- Every payment gateway integration goes through one generic adapter
  interface so a gateway outage or policy change never requires touching
  application code outside that adapter.
- Public-facing pages and marketing copy never name a specific country or
  provider payment brand; see `docs/planning/ARCHITECTURE-DECISIONS.md`
  section 4.

## Bot, scraping, and abuse protection

- `robots.txt` blocks known AI-training crawlers (GPTBot, CCBot, ClaudeBot,
  and similar) from the public site.
- Cloudflare Turnstile challenges protect login, signup, and payment
  routes.
- Rate limiting is applied at the edge (Nginx, see
  `docker/nginx/nginx.prod.conf`) and in application middleware.
- Honeypot fields and automation-signature detection reduce bot signups.

## Infrastructure security

- `next.config.mjs`, `netlify.toml`, and `vercel.json` all apply the same
  baseline security headers (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`).
- Tokenised client document and payment routes (`/i/*`, `/pay/*`) additionally
  send `Referrer-Policy: no-referrer` and
  `X-Robots-Tag: noindex, nofollow, noarchive` on every deployment target.
- `docker/nginx/nginx.prod.conf` terminates TLS with modern ciphers only and
  applies the same headers again at the reverse-proxy layer for defence in
  depth on self-hosted deployments.

## Code-level enforcement

- `npm run check:language` fails the build if any non-English text is found
  in code, comments, or documentation.
- `npm run check:placeholders` fails the build on any `TODO`, `FIXME`,
  "coming soon", or similar unfinished-work marker.
- ESLint (`.eslintrc.json`) forbids the TypeScript `any` type and casting to
  `any`, forbids `console.log` (allows `console.warn`/`console.error`), and
  forbids deep relative imports.
- `.husky/pre-commit` runs lint-staged on every commit; `.husky/pre-push`
  runs the full `npm run verify` suite before code leaves the machine.

## Backups and recovery

- `docker/scripts/backup.sh` and `docker/scripts/restore.sh` provide a
  tested logical backup and restore path for the Supabase Postgres database.
- `.github/workflows/database-backup.yml` performs an independent daily
  backup verification in CI.
- Uploaded files live in Google Drive, which has its own versioning and
  trash-retention independent of the application's own backup schedule.

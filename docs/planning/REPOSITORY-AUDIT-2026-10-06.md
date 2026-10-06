# Repository audit — 2026-10-06

## Audit purpose

This audit reconciles the canonical product requirements, the Bengali requirements reference, the master feature registry, the phase plan, the progress tracker, and the current repository tree. It deliberately distinguishes a schema or contract from a production feature wired to authenticated routes, database access, authorization, background jobs, and end-to-end tests.

The QR business-card module remains historical and superseded. Invoice QR codes remain in scope for the invoicing phase.

## Verification snapshot

The following checks pass with dependencies installed:

- `npm run verify`: language scan, unfinished-marker scan, TypeScript, ESLint, and Prettier.
- `npm run verify:ecommerce`, `npm run verify:security`, `npm run verify:mor`, `npm run verify:accounting`, and `npm run verify:core`.
- `npm run verify:phase17` through `npm run verify:phase24` and `npm run verify:phase46` through `npm run verify:phase48`, plus `npm run verify:phase35` through `npm run verify:phase45`.
- `npm run build` with a complete local preview environment.

These checks prove that the current contracts, components, smoke scripts, migration compatibility checks, and static build are internally consistent. They do not prove live Supabase integration, production credentials, browser flows, or real payment/email/storage execution.

The current dependency audit reports zero vulnerabilities in the full tree after the Vitest and PostCSS dependency repairs. The security workflow remains the release gate.

## Current implementation inventory

- 303 source files under `src/` after the Phase 24 currency/FX batch.
- 172 sequential Supabase migration files; 00169 and 00170 are the Phase 17 and Phase 18 RLS boundaries, and 00172 is the Phase 21 storage mapping migration.
- 26 App Router page files, plus the generated sitemap, favicon, not-found, and root layout files.
- 160 library and feature files, mostly provider-neutral contracts and pure domain logic.
- 29 verification/helper scripts under `scripts/`, including Phase 17 through Phase 24 coverage checks.
- 1 API route handler (the Phase 21 private storage download boundary).
- 0 actual Server Action implementations (`use server` appears only in a convention comment).
- 3 rollback-safe SQL/provider-boundary tests under `supabase/tests/`; 0 Vitest, integration, or Playwright test files.
- Smoke scripts exist for the completed contract and UI batches, but they are not replacements for database, browser, or provider integration tests.

## Database and server-wiring findings

- Phase 17 and Phase 18 now enable and force RLS for all 158 current public schema tables. The policies cover core/CRM/invoicing/payments, accounting, inventory, communication, ecommerce, KYC, wallet, reseller, accountant, affiliate, admin, content, projects, contracts, loyalty, and tax domains, with a rollback-safe cross-tenant isolation test. Application session/repository wiring was added in Phase 20; database policy coverage remains the final authorization boundary and must not be bypassed by the service-role client.
- `supabase/seed.sql` is intentionally empty. Plans, English CMS content, email templates, tax defaults, expense categories, and a demo tenant are not seeded.
- Phase 20 now supplies Supabase browser/server/admin/middleware/realtime clients and Phase 21 supplies the server-only storage boundary; no general repository/query/mutation layer is wired to the tables yet.
- The security, payment, communication, ecommerce, email, MoR, accounting, tax, and core libraries expose useful contracts and adapters, but no route/action currently calls them against the database.
- `src/middleware.ts` applies bot classification and security headers, but it does not refresh a Supabase session or enforce authenticated route protection.
- `src/config/permissions.ts` and the security-library documentation describe server-side authorization as a future boundary; that boundary is not yet connected to requests.
- The rate-limit library expects the database RPC, while the general route/action integration and policy coverage remain unfinished.

## Product-surface findings

The current routes are the auth/onboarding shell, the Phase 46 dashboard and notification center, plus the Phase 44 and Phase 45 public pages. There are no CRM, product, invoice, payment, report, team, KYC, wallet, settings, admin, client-access, public API, webhook, or server-action routes.

Phase 45 now supplies About, Contact, Guides, Terms, Privacy, Refund, Security, DPA, Accessibility, Blog, Status, API documentation, a generated sitemap, a favicon, and a branded not-found page. Its public copy is intentionally static; CMS editing, ticket submission, live API routes, and incident management remain later server/admin work. The navigation map still contains application routes that do not yet have page files.

Authentication and onboarding components accept callback props but the current route pages do not provide real Supabase callbacks. Login, signup, reset, OAuth, verification, two-factor, and onboarding are presentational/form contracts until the server clients, actions, session refresh, and redirects are implemented.

The requirements call for Recharts, which remains absent; Phase 46 uses an accessible CSS bar visualization with screen-reader text rather than adding a chart dependency. Phase 21 supplies a concrete Google Drive adapter, provider factory, tenant folder mapping, official Drive v3 upload/share/delete boundary, and application-gated private download route. Phase 22 supplies server-side React-PDF rendering, embedded fonts, A4/Letter pagination, exact-byte SHA-256 hashing, snapshot preparation, and browser print CSS. Phase 23 supplies bounded CSV/XLSX parsing, formula and macro defenses, magic-byte validation, HTML/SVG sanitization, image/PDF optimization, and secure CSV serialization. Phase 24 supplies decimal-safe Money arithmetic, currency minor-unit conversion, configurable invoice rounding, versioned tax-rule references, English number-to-words, and immutable direct/inverse FX conversion. Phase 46 supplies dashboard, tenant-scoped search, command palette, and notification-center contracts; live database/auth wiring remains later. Invoice QR generation and the public tokenized client-access page remain absent.

`public/robots.txt` now has a generated `/sitemap.xml` target and the App Router has a favicon route. OpenGraph image generation, JSON-LD implementation, health endpoint, and an automated runtime dead-link audit are still absent.

## Phase reconciliation

The tracker labels 47 of 75 phase rows `Done`, Phase 48 `In Progress`, and 27 `Not Started`:

- Done rows: 1–47 (47 rows). These include the migration/schema batches, Phase 17 and Phase 18 RLS hardening, provider-neutral contract batches, decimal-safe currency/FX services, dashboard/search/notification contracts, UI foundation, auth shell, onboarding shell, public marketing batches, and the tenant-safe clients module.
- Phase 48 is `In Progress`: catalogue, inventory, supplier and purchasing verification boundaries are present; product and inventory domain hardening remains the active implementation batch.
- Not started rows: 49–75 (27 rows).
- The tracker header now records 28 not-started rows plus the active Phase 48 row; Phases 18, 19, 20, 21, 22, 23, 24, 46, and 47 are complete.
- P3 has seven historical QR-business-card requirements and is superseded, not pending delivery. Invoice QR codes remain a later invoicing requirement.

The completed rows are not equivalent to full product completion: many are intentionally contract, schema, adapter, or UI-foundation batches whose production wiring is scheduled later. Full acceptance therefore still requires all 29 not-started rows plus integration and hardening work that the completed foundation rows explicitly deferred.

## Remaining delivery order

1. **Phases 48–65:** authenticated product modules, client access, invoicing, payments, accounting, time tracking, team/KYC, wallet/MoR, ecommerce settings, reports, settings, reseller/affiliate, and super-admin UI. Phase 46 supplies the dashboard/search/notification shell; Phase 24 supplies the decimal-safe currency/FX boundary used by these modules; Phase 23 supplies bounded CSV/XLSX parsing, formula and macro defenses, magic-byte validation, HTML/SVG sanitization, image/PDF optimization, and secure CSV serialization; Phase 22 supplies server-side React-PDF rendering, embedded fonts, exact-byte hashes, snapshot preparation, and print CSS; Phase 21 supplies the Google Drive adapter and private-link boundary; Phases 17–20 supply forced RLS/isolation coverage, database hardening, seed/cron work, Supabase clients, encryption/key-vault wiring, tenant boundary, and database-backed security integration.
2. **Phases 66–70:** authenticated API routes, provider webhooks, public API/direct checkout, tenant server actions, admin server actions, and complete middleware/security wiring.
3. **Phases 71–75:** unit/integration/E2E tests, asset/mobile/accessibility QA, documentation refresh, clean production build/deployment verification, dead-link audit, and final release gate.

Cross-cutting acceptance still includes configurable/versioned tax and fee rules, MoR responsibility, provider-official request contracts, idempotent payment retry, no raw card storage, company-scoped authorization, English-only UI/code/comments/errors/seed data, responsive accessibility, and keeping QR Business Card out of scope.

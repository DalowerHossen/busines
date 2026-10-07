# Repository audit — 2026-10-06

## Audit purpose

This audit reconciles the canonical product requirements, the Bengali requirements reference, the master feature registry, the phase plan, the progress tracker, and the current repository tree. It deliberately distinguishes a schema or contract from a production feature wired to authenticated routes, database access, authorization, background jobs, and end-to-end tests.

The QR business-card module remains historical and superseded. Invoice QR codes remain in scope for the invoicing phase.

## Verification snapshot

Last re-verified on 2026-10-06 after the duplicate-lineage repair described
below. The following checks pass on a clean checkout with dependencies
installed:

- `npm run verify`: language scan, unfinished-marker scan, schema integrity,
  TypeScript, Phase 48 coverage, the Vitest suite, ESLint and Prettier.
- `npm run check:schema`: unique migration numbers, one creator per table,
  row level security on every table, and no query against a table the schema
  does not define.
- `npm run test`: 79 unit assertions across 9 files.
- `npm run build`: a full production build using only the values shipped in
  `.env.example`, with no real credentials present.
- The remaining `verify:*` smoke scripts: ecommerce, security, MoR,
  accounting, core, and Phases 22 to 24, 35 to 46, and 48.

These checks prove that the schema applies as one coherent lineage, that the
contracts and components are internally consistent, and that the application
builds without production secrets. They do not prove live Supabase
integration, browser flows, or real payment, email and storage execution.

## Duplicate lineage repair

The repository previously carried two independent generations of the product
side by side. The older generation has been removed and the newer one is now
the only lineage:

- `supabase/migrations/` held 404 files over 232 sequence numbers, 172 of
  which were used twice. 47 tables, including `users`, `companies`,
  `clients`, `invoices` and `payments`, were created by two different
  migrations with incompatible columns, so the schema could never be applied
  to an empty database. The 172 files of the older lineage were removed and
  237 files now carry one unique number each.
- Five tables that only the removed lineage created but that live code still
  queried were ported into the surviving lineage as migrations 00233 to
  00236: `product_bundles`, `product_bundle_items`, `system_settings`,
  `storage_provider_folders` and `security_rate_limit_buckets`.
- `document_number_counters` was the last table without row level security;
  migration 00237 closes that gap. All 230 tables now enable and force it.
- The older generation's client module (`src/lib/clients/`, the mock driven
  `/clients` route tree and the `/api/clients/import|export` handlers) was
  removed. `/dashboard/clients` and `src/features/clients/` are the live
  implementation, and the import and export surfaces live in
  `/dashboard/settings/import` and `src/lib/export/`.
- The two environment modules were merged into `src/lib/env/`. The removed
  `src/env/server.ts` rejected `STORAGE_PROVIDER=google_drive`, which is the
  documented default, so a build from `.env.example` failed.
- The two service-role Supabase clients and the two browser clients were
  merged into `src/lib/supabase/service.ts` and `src/lib/supabase/client.ts`.
- Server environment validation is now lazy, so a production build no longer
  requires the full set of runtime secrets on the build machine.

## Current implementation inventory

- 1479 source files under `src/`.
- 237 sequential Supabase migrations defining 230 tables, every one of them
  with row level security enabled and forced.
- 148 App Router page files plus the generated sitemap, robots, favicon,
  not-found, error and loading boundaries.
- 30 API route handlers, including the four cron endpoints.
- 202 files containing Server Action implementations.
- 9 Vitest files with 79 assertions, covering pure domain logic only.
- 32 scripts under `scripts/`, including the schema integrity gate.

## Database and server-wiring findings

- Row level security is enabled and forced on all 230 public tables, with
  per domain policies installed through `install_tenant_policies` and the
  `has_company_access` / `can_write_company_data` helpers. Tables that only
  trusted server code may touch (`system_settings`,
  `storage_provider_folders`, `security_rate_limit_buckets`,
  `document_number_counters`) additionally revoke all privileges from `anon`
  and `authenticated`.
- `src/middleware.ts` refreshes the Supabase session, redirects
  unauthenticated requests away from protected routes, classifies bots and
  applies the security headers.
- The service-role client is reached through one module and is used only by
  cron workers, provider callbacks and the secret store.
- `supabase/seed.sql` carries the platform seed data.
- The SQL isolation tests that targeted the removed lineage were deleted.
  Database level isolation tests against the surviving schema are still
  outstanding and remain the most valuable missing safety net.

## Product-surface findings

The application covers the dashboard, clients, products and inventory,
invoices, estimates, expenses, payments, payouts, banking, contracts,
projects, subscriptions, loyalty, marketing, marketplace, messaging,
reports, settings, team, developer portal, reseller, affiliate, accountant
and admin surfaces, plus the public marketing site, the tokenized client
portal and the public API.

Known requirement gaps that remain open: Recharts is still absent and the
dashboard uses an accessible CSS bar visualization instead; invoice QR code
generation is not implemented; the bKash and Nagad local rails are present
as adapters but are far thinner than the Stripe and Adyen paths; and the
`src/lib/money.ts` and `src/lib/core/money.ts` layers still express money in
two shapes, even though they now share one stored scale and one accepted
amount pattern.

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

## Recheck on 2026-10-07 — starting state

The requested first-pass diagnostics found 237 migration files with 237 unique
sequence prefixes, and `scripts/check-schema-integrity.mjs` is present. The
specific expected scripts `check-navigation.mjs`, `check-duplicate-exports.mjs`,
`check-dead-code.mjs`, `check-file-headers.mjs`, and `check-env-contract.mjs` are
absent; related scripts currently use different names. `src/lib/validators/`
still contains 12 files, and `(app)/layout.tsx` still has one `Alex Morgan`
occurrence. The worktree was clean on the fixed session branch
`arena/d89bb1cd-busines`; prior local commits `e045f81` and `348ede8` are not in
the recent history. Therefore, the surviving 237-migration repair is present,
but it would be inaccurate to say the entire prior repair set is intact. This
baseline has been checkpointed before beginning the seed/database work.

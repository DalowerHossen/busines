# docs/planning/PHASE-PLAN.md

# Delivery Phase Plan -- KD SOLUTION IT (PayProject)

This is a living plan. The owner excluded the QR business card module (P3) from the current scope on 2026-10-06; invoice QR codes remain in scope. On 2026-10-06, the owner requested a Merchant of Record tax/compliance extension immediately after Phase 27; it is recorded as completed Phase 28 in the tracker. The owner then requested the communications adapter extension before the planned email phase; it is recorded as Phase 28B. Phase 29 email, Phase 30 ecommerce connectors, Phase 31 security protection, Phase 32 KYC/MoR/wallet/evidence contracts, Phase 33 accounting/reconciliation/OCR contracts, Phase 34 core platform contracts, Phase 35 stores/providers plus automatic card-tier fees, Phase 36 validators part 1, Phase 37 validators part 2, Phase 38 UI primitives part 1, Phase 39 UI primitives part 2, Phase 40 role-aware layouts, Phase 41 shared components, Phase 42 auth pages, and Phase 43 onboarding/company provider, Phase 44 public marketing pages part 1, and Phase 45 public pages part 2 are now complete; Phase 17 RLS part 1 and Phase 18 RLS part 2 plus isolation tests are also complete for the current schema. Phases 19, 20, 21, 22, 23, 24, and 46 are complete; Phase 47 is the next unresolved delivery row because Phases 25–45 are already complete in the tracker. Phase 24 provides the decimal-safe currency, invoice-calculation, number-to-words, and historical FX boundary; Phase 46 provides the dashboard, tenant-scoped global search, command palette, and notification center. Provider-specific FX fetching remains an official-provider integration concern and is not guessed here. Phase numbers are stable once a phase has started
(check PROGRESS-TRACKER.md), but an unstarted phase MAY be merged with its
neighbor or split further during execution if that produces cleaner,
still-complete delivery batches -- the owner does not need to approve a
re-shuffle of NOT-STARTED phases, only approve starting each phase in order.
Target batch size: roughly 25-40 files per phase (larger than the original
20-30 guideline where logically related files must not be split across a
commit boundary, e.g. a full migration group).

Total phases as currently enumerated: 75 (adjacent NOT-STARTED phases may be
merged during execution to reduce round-trips; PROGRESS-TRACKER.md is always
the authoritative current count). Estimated total files: ~1700-1900.

## Group 1 -- Foundation (Phases 1-4)

1. Root config, tooling, CI/CD, Husky, Docker/Nginx scaffold, root docs
2. Supabase project config, storage/Drive adapter interface skeleton, env schema + fail-fast boot validation
3. TypeScript domain types -- part 1 (core, auth, invoice-family, payment-family)
4. TypeScript domain types -- part 2 + central config/constants (nav-map, permissions, currencies, countries, plans, gateway registry)

## Group 2 -- Database (Phases 5-16)

5. Migrations: extensions, enums (incl. 6 roles), users, companies, company_profiles, snapshots, plans, subscriptions, system_settings, sessions, 2FA
6. Migrations: clients, groups/tags/reminders/credit-balance/notes/attachments, client access tokens (T1)
7. Migrations: invoices, items, attachments, comments, installments, numbering function + advisory lock
8. Migrations: estimates, recurring invoices, credit notes, debit notes, invoice templates
9. Migrations: payments, saved payment methods, refunds, chargebacks, consent-evidence tables (V1-V3), dispute evidence tables (V4-V6)
10. Migrations: expenses, income, tax rates, chart of accounts, journal entries, recurring expenses, bills, bank-feed tables
11. Migrations: products, categories, bundles, warehouses, stock movements/transfers, suppliers, purchase orders
12. Migrations: WhatsApp, SMS/Telegram/Viber channel tables, email templates, notifications
13. Migrations: e-commerce connections/orders/webhook log, direct-checkout API keys (FF1)
14. Migrations: KYC, virtual wallet, wallet transactions, payout requests, payment holds, platform fees, MoR agreements
15. Migrations: affiliate, reseller + sub-tenant linkage, accountant_company_access, coupons, audit logs
16. Migrations: CMS, blog, FAQ, branding, announcement bar, status/incidents, API keys, outgoing webhooks, support tickets, GDPR requests, backups, exchange rates, time-tracking/projects, contracts/e-sign, BNPL, loyalty

## Group 3 -- Database Hardening (Phases 17-19)

17. RLS policies -- part 1 (core/CRM/invoicing/estimates/payments)
18. RLS policies -- part 2 (accounting/inventory/wallet/KYC/reseller/accountant/affiliate/admin) + tenant-isolation automated tests
19. DB functions/triggers (numbering, stock update, balance calc, late fee, audit trigger, updated_at trigger) + seed data (plans, super admin, CMS English content, email templates, tax rates, expense categories, demo tenant) + Supabase Edge cron functions

## Group 4 -- Core Libraries (Phases 20-30)

20. Supabase clients (browser/server/admin/middleware/realtime), encryption (AES-256 + key-vault), rate limiter, CSRF, audit logger
21. Google Drive storage adapter (service account, folder-per-company, upload/share/signed-link) + provider interface
22. Server-side PDF generator (US/Amazon-grade invoice layout, fonts, multi-page, hash) + print CSS engine
23. CSV/Excel parser, file validator (magic-byte), HTML sanitizer, media optimization (image/PDF compression)
24. Currency/number/invoice calculator, number-to-words, decimal-safe money utils, multi-currency/FX
25. Payment gateway adapters -- part 1 (Stripe, PayPal, Paddle)
26. Payment gateway adapters -- part 2 (NMI, 2Checkout, Adyen for Platforms, Nium)
27. Custom/pluggable gateway registry (JSON-driven config) + local payment-rail adapters + manual/bank payment
28. WhatsApp client/templates/automation/webhooks + SMS/Telegram/Viber adapters + channel-routing engine
29. Email engine (sendPlatformMail, Resend client, all transactional templates, bounce handler, queue processor, deliverability config)
30. E-commerce connectors (Shopify/WooCommerce order sync) + direct-checkout bridge (FF1: Shopify payment app, WooCommerce plugin, Checkout SDK)

## Group 5 -- Core Libraries continued (Phases 31-34)

31. Bot/AI protection layer (middleware, honeypot, Turnstile, security headers/CSP, anti-scraping) (FF3)
32. KYC/MoR/wallet/payout/fee engine + consent-evidence engine + dispute-evidence-pack generator (V1-V6, P8, T4)
33. Accounting engine (journal, P&L, balance sheet, cash flow, COGS), bank reconciliation matcher, receipt-OCR hook
34. Misc core libs: global search, backup/restore, exchange-rate fetch, impersonation, feature-flag/entitlement engine, background job queue

## Group 6 -- App Shell & State (Phases 35-37)

35. Hooks + Zustand stores + providers (auth/company/branding/subscription/notification/theme/impersonation/maintenance/announcement)
36. Zod validators -- part 1 (auth, invoice, estimate, recurring, credit/debit note, payment, client, consent)
37. Zod validators -- part 2 (product, expense, accounting, inventory, supplier/PO, whatsapp, team, company profile, api-key, webhook, support, coupon, kyc, payout, ecommerce, domain, email-template, branding, plan, cms, blog, faq, settings, contact, gateway-config)

## Group 7 -- UI Foundation (Phases 38-41)

38. UI primitives part 1 (custom-themed, not default shadcn look)
39. UI primitives part 2
40. Layouts -- sidebar/topbar/mobile-nav/breadcrumb/command-palette, role-aware (owner/staff/admin/reseller/accountant/affiliate)
41. Shared components -- tables, empty/error/loading states, file uploader (Drive-backed), image uploader, data-table toolbar, confirm dialogs

## Group 8 -- Public & Auth (Phases 42-45)

42. Auth pages + components (login/signup/forgot/reset/verify/2FA/OAuth, branded panel)
43. Onboarding wizard + CompanyProvider wiring
44. Public marketing pages part 1 (homepage, features, pricing preview, testimonials, FAQ teaser, e-commerce merchant onboarding landing FF1.6)
45. Public pages part 2 (about, contact, terms, privacy, refund, security, DPA, accessibility, blog, status page, API docs page) -- each page a visually distinct layout per FF5.1

## Group 9 -- Core App Modules (Phases 46-54)

46. Dashboard overview + global search + command palette + notification center
47. Clients module (CRUD, CSV import/export, statement, timeline, merge/dedupe, tags/groups)
48. Products/services module + bundles + price lists + inventory/warehouse/suppliers/purchase orders
49. Invoicing module -- core (form, line items, calc, numbering, attachments)
50. Invoicing module -- status/timeline/public tracker/QR/PDF/email send/bulk actions/batch send + summary dashboard (U3, U4)
51. Estimates + recurring + credit/debit notes + public approval + e-signature + contracts module
52. Client token-access pages (/i/[token] hub, OTP gate, expired-link page) (T1-T2)
53. Payments module -- checkout UI (gateway selection, card toggle, 3DS toggle UI, hosted checkout, payment links, BNPL option)
54. Accounting module (expenses, journal, COA, P&L, balance sheet, cash flow, bank import/reconciliation, receipt OCR UI) + time-tracking/project billing module

## Group 10 -- Team, Compliance, Settings (Phases 55-58... continued below)

55. Team management + roles/permissions + accountant multi-company access + KYC module (Drive-backed uploads, manual review UI)
56. Wallet/Payout module (merchant-side) + MoR status + fee breakdown + WhatsApp automation
57. E-commerce integration settings (Shopify/WooCommerce connect + direct-payment plugin/API-key settings) + reports module (sales/expense/client/tax/aging + CSV/PDF)
58. Settings module (company/branding/gateway keys/domain/notification/security policy) + reseller module + affiliate module (blind dashboard)

## Group 11 -- Developer & Growth Surfaces (Phases 59-61)

59. API/webhook developer module (keys, docs, playground, OpenAPI spec, Postman collection)
60. Marketing/social automation scaffolding (content calendar, scheduler skeleton, SEO/analytics pixel admin settings, social sharing)
61. Template marketplace + integration ecosystem (Zapier/Make/Chrome extension) scaffolding + loyalty/review automation

## Group 12 -- Super Admin (Phases 62-65)

62. Super admin -- overview/users/plans/subscriptions/coupons/fees
63. Super admin -- KYC review/payouts/gateways/dispute center/analytics/security monitoring dashboard (FF3.10)
64. Super admin -- CMS/blog/email templates/support tickets/audit logs
65. Super admin -- system settings/SMTP/branding/maintenance/security policy controls (3DS toggle, card toggle, gateway toggles, storage/Drive settings)

## Group 13 -- API Routes & Server Actions (Phases 66-70)

66. API routes part 1 (auth, invoices, clients, payments)
67. API routes part 2 (gateway webhooks: Stripe/PayPal/Paddle/NMI/2Checkout/Adyen/Nium/local-rail/WhatsApp/e-commerce)
68. API routes part 3 (public v1 REST API, reports, admin, direct-checkout endpoints for Shopify/WooCommerce)
69. Server actions part 1 (tenant-facing)
70. Server actions part 2 (admin-facing) + middleware/instrumentation/security-header wiring

## Group 14 -- Quality & Ship (Phases 71-75)

71. Unit tests
72. Integration tests
73. E2E tests part 1
74. E2E tests part 2 + remaining SVG/image assets
75. Documentation (README, SETUP, deployment guides x4, API docs, SECURITY.md, planning-doc refresh) + final QA pass (lint/build/Bengali-scan/placeholder-scan/dead-link-scan/mobile-320px checklist) + Netlify deploy verification

Note: 75 is the as-planned count. It can shrink if adjacent small phases are
merged during execution (e.g. merging two UI-primitive phases into one larger
batch) -- that is allowed without extra owner approval since no scope is
removed. The authoritative, up-to-date count always lives in
PROGRESS-TRACKER.md, not in this paragraph.

# Validators part 2

Phase 37 extends the strict Zod boundary layer to the remaining platform domains. The schemas are grouped by responsibility in `src/lib/validators/`:

- `catalog.ts`: product and bundle catalog, expenses and recurring expenses, income, tax rates, chart of accounts, journal entries, bank matching/reconciliation, receipt OCR metadata, warehouses, inventory adjustments/transfers, suppliers, and purchase orders.
- `organization.ts`: team membership permissions, accountant access, company profile, branding, locale/invoice/notification/SMTP settings, contact forms, and company status.
- `integrations.ts`: provider-neutral WhatsApp messages, API keys, webhook endpoints/replay, ecommerce connection and sync inputs, hosted/direct checkout contracts, custom domains, email templates, gateway configuration, and file metadata.
- `platform.ts`: support tickets, coupons, KYC submissions/reviews, payout destinations/requests, plans/subscription changes, CMS pages, blog posts, FAQs, redirects, and legal document acceptance.

## Security and domain rules

- Schemas are strict and reject fields that are not part of the documented internal contract. External provider payloads remain opaque raw bodies plus headers; the code does not guess provider-specific request shapes.
- HTTPS is required for webhook endpoints. Direct-checkout allowed origins cannot contain a path, query, or hash.
- Decimal amounts stay strings and journal lines require exactly one non-zero side. Journal totals must balance using `decimal.js`, never binary floating-point arithmetic.
- Billable expenses require a client, warehouse transfers require distinct source and destination warehouses, and KYC rejection requires a reason.
- SMTP password input remains optional to support saving other settings without destroying a stored credential. Secret values are not returned to a browser schema or sent to provider adapters by these validators.
- Coupon discount type, currency, plan targeting, and validity dates are checked together. Plan limits distinguish `null` unlimited values from numeric ceilings.
- Payout and outbound-message mutations require idempotency keys. Validation does not replace the server-side idempotency store, authorization, tenant checks, entitlement checks, or official provider adapter behavior.

Run `npm run verify:phase37` for deterministic coverage across every validator group. The Phase 36 schemas remain exported from `@/lib/validators`, so consumers can use one validation boundary for both validator phases.

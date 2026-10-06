# Validators part 1

Phase 36 adds strict Zod boundary schemas under `src/lib/validators/` for the first domain group: authentication, invoice documents, estimates, recurring invoices, credit and debit notes, payments, clients, and consent records.

## Boundary rules

- Every action-facing object is strict. Unknown keys are rejected instead of silently passing through to a server action.
- IDs are UUID-shaped, timestamps require an ISO date-time with an explicit offset, currencies and countries are normalized to uppercase, and email addresses are normalized to lowercase.
- Monetary inputs remain decimal strings. Invoice and payment amounts cannot be negative, and positive transaction amounts cannot be zero.
- Dates are checked for domain ordering: invoice due date cannot precede issue date, estimate expiry cannot precede issue date, recurring end date cannot precede the next run date, and payment list end dates cannot precede start dates.
- Payment mutations require a restricted idempotency key. This is validation only; the server must still persist and enforce idempotency before calling a gateway.
- Saved payment methods accept gateway-issued references and display-safe metadata only. Raw card numbers, security codes, and other unknown fields are rejected by strict schemas.
- Payment consent requires all three affirmative confirmations and captures the exact consent text, terms/refund-policy version pairing, timestamp, and optional request metadata. The server remains responsible for deriving the record hash and verifying tenant/document ownership.
- Client-side schema checks are not authorization. Server actions and route handlers must authenticate, enforce company membership/role, re-check entitlements, and validate the same payload before any write or provider call.

## Schema groups

- `auth.ts`: sign-in, signup, password reset/change, email verification, two-factor code, company switching, team invitations, and authenticated session snapshots.
- `invoice.ts`: line items, invoice/estimate drafts, sending/voiding, recurring invoices, credit/debit notes, tokenized client access, and snapshots/comments.
- `payment.ts`: gateway-safe payment creation/capture/refund, saved payment methods, chargebacks, list filters, and idempotent payment mutations.
- `client.ts`: client records, groups, tags, reminders, notes, credit-balance adjustments, and bounded imports.
- `consent.ts`: payment consent, immutable hash format, cookie consent, and communication opt-in consent.
- `common.ts`: reusable UUID, ISO date-time, country/currency, decimal amount, money, address, pagination, text, IP, and idempotency primitives.

The public barrel is `src/lib/validators/index.ts`; consumers should import schemas from `@/lib/validators` rather than duplicate rules in a component.

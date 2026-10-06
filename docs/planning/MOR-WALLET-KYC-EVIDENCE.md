# MoR, Wallet, KYC, Payout, and Evidence Engine

Phase 32 adds the server-side contracts for the platform Merchant of Record path, manual KYC gating, the virtual-wallet ledger, fee and payout policy, and dispute evidence. Database migrations `00103` through `00113` already provide the tenant-scoped persistence boundaries; these libraries do not duplicate those tables.

## KYC and MoR eligibility

`src/lib/mor/kyc.ts` validates only storage-provider metadata for KYC files. The platform stores a provider file ID, allow-listed MIME type, file size, and optional SHA-256 digest; raw identity documents and raw tax/card data are never represented in these contracts. The existing five-megabyte and PDF/JPEG/PNG/WebP restrictions are enforced before an upload is persisted.

Manual approval requires all three existing document types: `id_front`, `id_back`, and `business_registration`. A reviewer identity, review timestamp, and accepted document status are required for approval. Rejections require a reason. `kycSubmissionHash` can snapshot the submission's document hashes without storing document contents.

`resolveSettlementRouting` enforces the locked MoR rule:

- KYC approval is required before a platform settlement path can be selected.
- An active, versioned `mor_agreements` snapshot and accepted terms hash are required.
- A risk suspension or configured payment amount limit falls back to the merchant's own gateway.
- If KYC or the agreement is not eligible and no own gateway is configured, the request fails closed.
- Gateway identifiers are internal values; raw payment instruments are not accepted.

The own-gateway path remains the default. The platform-MoR path is an explicit, auditable decision and does not bypass the completed tokenized/hosted payment adapters.

## Decimal-safe fee and wallet accounting

`money.ts` uses `decimal.js` and four-decimal strings. No wallet, fee, payout, hold, or settlement calculation uses JavaScript floating-point arithmetic.

`resolveFeeRule` chooses the current active company override before the current platform rule using the configured effective window. `calculatePlatformFee` snapshots percentage, minimum, fixed, currency, and resulting charged fee values. There are no silently embedded permanent tax or fee rates.

`wallet.ts` produces serialized balance transitions from an explicitly locked wallet snapshot. It validates non-negative resulting `available`, `held`, and `pending` buckets, increments the account version, carries a reference and idempotency key, and supports payment-hold creation and hold release. A hold moves funds from `available` to `held`; release moves them back, so the total wallet balance is unchanged. The `WalletLedgerStore` implementation must run the read, row lock, idempotency lookup, append, and balance update in one database transaction; the existing unique `(company_id, idempotency_key)` index remains the duplicate-posting guard. Internal bucket movements can have a zero total economic delta while still changing the held and available buckets.

Corrections must be compensating postings. Wallet balances are not edited from a request handler, and a client cannot choose an arbitrary balance or ledger amount.

## Payout processing

`requestPayout` requires a verified, non-disabled destination, matching currency, a non-zero idempotency key, a configured minimum payout threshold, and enough available wallet balance. It calculates the platform payout fee from the versioned fee rule and returns the requested, fee, and net amounts. `PayoutRequestStore` must claim the existing company/idempotency unique key atomically before a provider call.

`approvePayoutRequest` enforces maker-checker separation: the reviewer must be a different user from the requester, and only requested or under-review requests can become approved. `executePayout` refuses to run before approval, marks a request processing before calling the injected payout rail with a provider-issued destination reference and the same idempotency key, and only marks paid when the rail explicitly returns paid. Failed terminal statuses are persisted as failed; asynchronous statuses remain processing for webhook reconciliation. Encrypted destination details never enter this module.

## Consent, delivery, and tamper-evident evidence

`evidence.ts` implements the V1-V4 evidence contracts:

- `capturePaymentConsent` requires every pre-payment confirmation, exact consent text, versioned terms, versioned refund policy, UTC timestamp, and the available request context. It returns an immutable SHA-256 record hash.
- `validateDeliveryAcceptance` checks the existing delivery, service completion, client acceptance-link, signature-file, and delivery-proof fields.
- `appendDisputeAuditEvent` canonicalizes each event and links it to the previous hash. `verifyDisputeAuditChain` rejects reordered, altered, missing, or substituted events.
- `buildDisputeEvidencePack` creates a deterministic canonical JSON artifact and an escaped review HTML rendering containing the invoice snapshot, consent snapshot, delivery proof, email proof, attachment proof, PDF hash, and audit timeline. It supports the existing `generic`, `stripe`, and `paypal` formats and records content hashes for later gateway upload.
- `storeDisputeEvidencePack` writes the private canonical artifact through the existing storage adapter. A future PDF renderer can use the same deterministic bundle without changing the evidence or persistence contract.

Evidence values are recursively sanitized for card numbers, PAN, CVV/CVC, security codes, bank-account numbers, and ACH account numbers before canonicalization or HTML rendering. A dispute pack can prove payment authorization and consent without ever collecting raw payment credentials.

`disputes.ts` covers the calculations that the existing `chargebacks`, `payments`, and evidence schemas can support without inventing new persistence fields. Reserve percentage is supplied by versioned policy, and the result exposes target, additional, and releasable reserve amounts. Dispute rate is calculated from chargeback count divided by eligible captured-payment count using decimal arithmetic and compared with a configurable alert threshold. Evidence retention decisions use a versioned retention policy, an explicit legal hold, active-dispute status, and a configurable calendar-month window; an expired, non-held, resolved pack is only marked eligible for deletion, never deleted by this library.

## Verification and operational boundaries

The implementations are pure/provider-neutral where possible and accept repository, storage, and payout-rail interfaces for deterministic tests. `scripts/verify-mor.ts` exercises KYC approval, fee calculation, KYC-gated MoR routing, wallet hold/release transitions, and idempotent payout request construction.

Database adapters must keep tenant `company_id` filters, RLS, append-only evidence rows, encrypted payout destinations, and maker-checker review identities. UI, API routes, cron hold release, provider webhook handlers, and the super-admin dispute dashboard consume these contracts in their later planned phases.

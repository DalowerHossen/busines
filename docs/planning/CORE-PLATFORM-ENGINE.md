# Core platform engine

Phase 34 adds provider-neutral contracts for global search, encrypted JSON backup/restore, exchange-rate snapshots, super-admin impersonation, feature flags and entitlements, and a generic background-job queue. The contracts are under `src/lib/core/`; no provider SDK or guessed external request shape is included.

## Global search

`searchGlobalDocuments` scores pre-indexed, display-safe `SearchDocument` records by normalized token matches across title, subtitle, and search text. A tenant search requires the actor to have the requested company membership and returns only that company. A platform-wide search is accepted only for `super_admin`; a tenant role cannot widen its scope by changing a request parameter. Results use internal relative URLs, stable ordering, a bounded query, and a bounded result limit.

The repository adapter that builds documents must apply `deleted_at is null`, RLS, role permissions, and per-entity visibility before calling the scorer. Search documents must never contain provider credentials, raw payment instruments, or private file contents.

## Encrypted backup and restore

`buildJsonBackupPayload` produces a deterministic, versioned tenant or platform JSON shape from repository-selected collections. Collections and rows are sorted for stable hashes. Sensitive fields such as passwords, access tokens, API key hashes, encrypted setting values, private keys, PAN, CVV/CVC, and encrypted payout account details are omitted and listed in `redactedFieldNames`.

`BackupCipher` is the encryption boundary. A production implementation must use the existing trusted key-management/encryption policy and return authenticated ciphertext; this phase does not guess a cloud KMS or storage API. `createEncryptedBackup` hashes the canonical plaintext, encrypts it with an explicit key version, and persists only `BackupArtifact` metadata plus ciphertext through `BackupArtifactStore`. `restoreEncryptedBackup` decrypts, verifies the SHA-256 digest, checks company and schema ownership, and parses the versioned payload. Backup rows and binaries remain outside the application request's direct response.

The existing `backups` migration stores provider file ID, content hash, key version, status, expiry, and timestamps. Queue workers can use this contract for scheduled database backups; a restore adapter must run drills in an isolated environment before any production restore.

## Exchange rates

`ExchangeRateProvider` receives only an uppercase supported currency pair and an as-of timestamp. An official provider adapter must implement the provider's documented API separately and return a normalized immutable snapshot. `fetchAndStoreExchangeRate` validates the source, effective/fetched timestamps, positive rate, and database-compatible currency pair before calling the existing `exchange_rates` append boundary.

`resolveExchangeRate` selects the latest snapshot at or before the requested timestamp through the store; same-currency conversion uses a deterministic identity rate. Phase 24 adds the decimal-safe `Money` boundary, currency-aware target-scale conversion, direct/inverse conversion, and `freezeFxConversion` for immutable historical results. The legacy `convertAmount` helper remains a four-decimal generic conversion for existing provider-neutral callers; invoice, payment, wallet, payout, and accounting code must use the currency-aware money functions instead. Historical callers must supply the transaction's effective timestamp rather than the latest live rate, so historical invoice and accounting values are not rewritten by a later fetch.

## Impersonation

`startImpersonation` requires a `super_admin`, explicit consent timestamp, a reason, a target different from the actor, a tenant company, and a bounded configurable duration. Sessions are always read-only and receive a server-derived expiry. `ImpersonationSessionStore` must atomically persist the session and its `started` audit event.

`assertImpersonationActive` fails closed after expiry or stop. `rejectImpersonatedMutation` records a `blocked_mutation` event before rejecting a write. `stopImpersonation` persists a stopped or expired session and audit event. The UI can use the immutable actor, target, company, read-only, and expiry fields for the required banner; the server must still enforce the session on every request.

## Feature flags and entitlements

`evaluateEntitlement` is the server-side decision contract. A feature must have an enabled plan entitlement, an active/trialing subscription, and an effective feature flag unless an explicit trusted platform-admin bypass is used. Flags support effective windows, company allowlists, and deterministic rollout buckets. Usage limits are evaluated with integer units; the decision returns a reason and remaining capacity, and `assertEntitled` returns sanitized denial errors.

Feature definitions and plan matrices should be resolved from the existing editable `system_settings` and `plans` boundaries, with configuration versions recorded by the repository. A client-side flag is presentation only and never replaces `assertEntitled` on a server action or route.

## Background jobs

`enqueueJob` validates a bounded job type, run time, attempt policy, idempotency key, tenant scope, and JSON-safe payload. Secrets, authorization material, cookies, raw bodies, payment credentials, and private keys are rejected from job payloads. `JobQueueStore.findByIdempotency` and `enqueue` must be backed by one unique transaction so a double request creates one job.

`JobQueueStore.claimNext` must atomically claim queued/retrying work with a lease. `runClaimedJob` passes a lease token to the handler, records success, or applies bounded exponential retry only for an explicit `JobExecutionError`. Unknown failures are sanitized and terminal; a handler is never retried forever. The store must verify the lease token on every state transition. Existing email, communication, webhook, GDPR, and backup workers can implement this interface without sharing provider credentials or queue-specific logic.

## Verification

`scripts/verify-core.ts` provides deterministic checks for tenant/platform search boundaries, backup redaction and round-trip integrity, official-provider exchange-rate boundaries and decimal conversion, read-only impersonation and audit events, feature entitlements and usage limits, idempotent job enqueue, retry backoff, and successful job completion. Run it with `npm run verify:core`.

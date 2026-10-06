# Accounting engine, reconciliation, and receipt OCR

Phase 33 adds provider-neutral application contracts over the accounting and bank-feed tables from migrations `00051` through `00066`. The migration group already owns tenant-scoped expense, income, chart-of-accounts, journal, bill, bank-account, bank-transaction, matching-rule, and reconciliation-log persistence. This phase does not create a second accounting schema.

## Double-entry journal

`src/lib/accounting/journal.ts` validates the existing `journal_entries` and `journal_entry_lines` boundary before a store can append a posting:

- Every line belongs to an active chart-of-accounts row in the same company.
- Each line has exactly one non-zero side, and total debits equal total credits using `decimal.js` arithmetic.
- Monetary values are canonical non-floating-point decimal strings; no JavaScript financial arithmetic is used.
- Entry dates are calendar dates, references are trimmed, and the currency is an explicit three-letter code.
- A locked accounting period rejects new entries. The `JournalEntryStore` adapter is expected to append the header and lines in one database transaction and to preserve the existing append/lock semantics; corrections are compensating entries rather than edits.

The contract returns a normalized posting and deliberately does not expose raw database errors. Tenant filtering and row-level authorization remain responsibilities of the repository adapter and existing RLS boundary.

## Financial statements and COGS

`src/lib/accounting/statements.ts` calculates reports from posted journal entries only:

- Profit and loss uses revenue credit-normal balances and expense debit-normal balances. It returns revenue, configurable COGS-account totals, operating expenses, total expenses, and net profit.
- The balance sheet calculates asset, liability, and contributed-equity balances as of a date, adds the selected current-period profit to equity, and exposes an `isBalanced` check for assets versus liabilities plus equity.
- Cash flow uses configured cash accounts and counterpart-account classifications for operating, investing, and financing activity. Ambiguous multi-category entries fail closed rather than silently misclassifying a movement.
- Every report requires a company ID and rejects entries from a different company or currency. Inclusive date ranges are validated before aggregation.

The reports are calculation contracts rather than display components. A report repository should query only `deleted_at is null` rows and apply the company's fiscal-year configuration before calling these functions.

## Bank-feed matching and reconciliation

`src/lib/accounting/reconciliation.ts` provides deterministic suggestions over imported `bank_transactions`:

- Signed bank amounts are compared with decimal-safe exact equality; candidate company IDs must match.
- Description matching is normalized, case-insensitive text matching. Existing `bank_matching_rules` support normalized description contains matching or exact signed-amount matching; rules are scoped to the same company and active state.
- Suggestions include explainable match dimensions and a confidence score. The caller supplies the minimum confidence threshold. Equal-confidence top matches are ambiguous and are not auto-selected.
- `reconcileBankTransaction` refuses already reconciled rows, cross-company candidates, amount mismatches, and invalid timestamps. `BankReconciliationStore.persist` must lock the bank row, update it, and append `bank_reconciliation_logs` atomically so a double click cannot create two reconciliations.

No bank account number or provider credential is accepted by the matcher. The existing masked bank-account shape remains the only display-safe account identity.

## Receipt OCR hook

`src/lib/accounting/ocr.ts` is an adapter boundary, not a guessed provider implementation. `ReceiptOcrAdapter.extract` receives a tenant ID and storage-provider file reference plus validated MIME, size, and SHA-256 metadata; it never receives or stores a raw payment instrument. A concrete OCR adapter must be added only from the selected provider's official API contract.

The hook validates the provider ID, request ID, calendar receipt date, currency, confidence, and extracted decimal amounts. Extraction remains a reviewable result and is not automatically posted as an expense. `ReceiptOcrStore.findByContentHash` makes repeated uploads deterministic and returns the existing result as a duplicate instead of calling the OCR provider again. Store adapters must enforce the company/hash uniqueness race atomically.

The result includes optional vendor, date, subtotal, tax, total, confidence, and normalized line items. Missing fields remain null; the hook never invents a value or silently turns low-confidence OCR into an accounting posting.

## Verification

`scripts/verify-accounting.ts` covers balanced and unbalanced journals, locked periods, P&L, COGS, balance-sheet equality, operating/financing cash flow, deterministic bank matching and reconciliation, OCR extraction, and duplicate receipt suppression. The package script is `npm run verify:accounting`.

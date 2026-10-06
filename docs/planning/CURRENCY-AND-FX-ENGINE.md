# Currency, money, invoice calculation, and FX engine

Phase 24 provides the decimal-safe financial primitives used by invoice, payment, wallet, payout, and accounting work. The implementation is provider-neutral: it does not guess an external exchange-rate endpoint or request shape. A later provider adapter must implement the official API contract for its selected source and return an `ExchangeRateSnapshot`.

## Decimal-safe money

`src/lib/core/money.ts` is the single arithmetic boundary for `Money` values:

- Amounts are strict decimal strings and never JavaScript floating-point values.
- Currency codes are checked against the central supported-currency registry.
- Currency minor-unit metadata controls final normalization, including zero-decimal currencies such as JPY, KRW, IDR, and VND.
- Banker's rounding (`half_even`) is the default, with explicit `half_up`, `half_down`, `up`, `down`, `ceiling`, and `floor` modes.
- Same-currency arithmetic rejects currency mismatches rather than silently converting.
- `toMinorUnits` and `fromMinorUnits` use `bigint`, so payment and allocation code does not pass through an unsafe integer `number`.
- `allocateMoney` distributes any remainder deterministically and preserves the exact total.

The output amount is normalized to the target currency's minor-unit scale only at a money boundary. Intermediate invoice calculations remain decimal-safe until the configured rounding point.

## Invoice calculation

`calculateInvoice` receives line quantities, unit prices, discount percentages, and tax percentages as decimal strings. Tax is supplied by the caller together with an optional versioned tax-rule reference; no permanent tax rate or jurisdiction rule is embedded in the calculator.

The caller chooses `line` or `total` rounding and the rounding mode. Line rounding rounds each line's subtotal, discount, taxable amount, tax, and total before aggregation. Total rounding retains decimal-safe intermediate values and rounds the aggregate totals once; the displayed line values can therefore intentionally differ from the aggregate tax total under that policy. The result preserves the currency, policy, tax-rule reference, and every calculated component for an auditable snapshot.

## Number to words

`numberToWords` produces deterministic English words for invoice copy and `moneyToWords` renders a normalized money amount with currency-specific major and minor-unit labels. These functions accept decimal strings only and do not use locale-dependent floating-point formatting.

## Historical FX

`ExchangeRateProvider`, `ExchangeRateStore`, and `ExchangeRateSnapshot` remain the provider-neutral boundaries. `resolveExchangeRate` selects a stored snapshot at or before an explicit as-of timestamp. `convertMoney` supports direct and inverse use of a validated snapshot and rounds only in the target currency. `freezeFxConversion` returns the source amount, target amount, applied direction/rate, exact snapshot, rounding policy, and conversion timestamp so later live rates cannot rewrite a historical result. `calculateFxGainLoss` compares the booked reporting-currency amount with a settled amount converted through the frozen snapshot and returns a signed, currency-safe gain/loss result.

Rates are validated as positive, database-compatible decimal values with distinct supported currency pairs, immutable source/effective/fetched timestamps, and stable sanitized errors. Same-currency conversion uses an explicit identity result and does not require an external rate.

## Verification

Run `npm run verify:phase24` for deterministic coverage of banker versus half-up rounding, zero-decimal and minor-unit conversion, exact allocation, currency mismatch rejection, invoice line-versus-total rounding, versioned tax references, English number-to-words, direct/inverse FX conversion, signed FX gain/loss, and validated historical snapshots. The general `npm run verify` check remains required before the next phase.

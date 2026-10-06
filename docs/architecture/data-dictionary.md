# Data dictionary

Only the columns whose meaning is not obvious from the name, and the
invariants that go with them. Everything else is what it looks like.

## Money and currency

| Column                       | Meaning                                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `*_amount numeric(18,4)`     | Money is always numeric. Four decimals are stored; two are shown. Floating point appears nowhere near a balance.                        |
| `amount_minor bigint`        | The same amount in the smallest unit of its currency, for providers that insist on it. A zero decimal currency stores the whole number. |
| `currency_exponent smallint` | How many decimals the currency actually has. It is two for most and zero for some, which is why it is stored rather than assumed.       |
| `balance_due`                | Generated, never written. Total less what has been paid.                                                                                |

## Tenancy and lifecycle

| Column                  | Meaning                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `company_id`            | The tenant. Null means the row belongs to the platform itself, which is why policies test for null explicitly rather than treating it as missing. |
| `deleted_at`            | Soft delete. Every read filters it; nothing is ever truly removed, so an accident is recoverable and an audit trail stays whole.                  |
| `status` on `companies` | `onboarding` until the five required steps are done, then `active`. `read_only` keeps a business able to read its records after it stops paying.  |

## Invoices

| Column                        | Meaning                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `company_profile_snapshot_id` | The business details frozen at the moment of issue. A later logo or address change does not rewrite an invoice already sent.               |
| `invoice_number`              | Assigned when the invoice is issued, never before. A draft has none, which is why the column is nullable and the issued check enforces it. |
| `is_locked`                   | Set once money or a client has seen it. A locked invoice is revised, not edited.                                                           |

## Settlement and payout

| Column                            | Meaning                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `settlements.gross_amount`        | What the payer was actually charged. The three parts below always add back up to it, enforced by a check constraint.     |
| `settlements.gateway_fee_amount`  | What the card network and collecting partner took. Not ours.                                                             |
| `settlements.platform_fee_amount` | What this platform kept, by the terms in force at that moment.                                                           |
| `settlements.hold_until`          | The single source of truth for when the seller can have the money. The wallet entry follows it, not the other way round. |
| `wallets.pending_balance`         | Credited and visible, but inside the hold window.                                                                        |
| `wallets.reserved_balance`        | Requested as a payout and not yet sent.                                                                                  |

## Credentials

| Column                                                         | Meaning                                                                                                                                   |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `*_encrypted`                                                  | Ciphertext produced before the value reached the database. The database never sees a key in the clear and cannot return one to a browser. |
| `masked_hints` / `token_hint`                                  | The last few characters, enough to recognise a key and useless to anybody reading over a shoulder.                                        |
| `previous_bundle_encrypted` with `previous_bundle_valid_until` | A rotation grace window, so a request already in flight when the key changed still completes.                                             |

## Proof and consent

| Column                             | Meaning                                                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `invoice_work_evidence.sealed_at`  | Set when the invoice is paid. Sealed proof cannot be edited or removed, which is the only reason it is worth anything in a dispute. |
| `checkout_consents.statement_hash` | A digest of the exact words the payer agreed to, so nobody can argue later about what the page said.                                |
| `checkout_consents` as a whole     | Append only, enforced by a trigger.                                                                                                 |

## Files

| Column                        | Meaning                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `files.storage_key`           | The key this application chose. Stable across stores.                                                          |
| `files.external_object_id`    | The identifier the store chose, when it names its own objects. A cloud drive does; an object store does not.   |
| `storage_targets.path_prefix` | For a connected drive this holds the folder identifier, which is how one tenant's documents stay in one place. |

## Measurement and consent

| Column                                     | Meaning                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `analytics_destinations.public_identifier` | Public by design; it appears in the page source of every site that uses it.              |
| `analytics_destinations.consent_category`  | Nothing loads until the visitor has agreed to this category.                             |
| `cookie_consents.expires_at`               | A decision is honoured for a year and then asked for again, rather than assumed forever. |

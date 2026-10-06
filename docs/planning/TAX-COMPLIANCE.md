# Merchant of Record tax and compliance design

This platform operates as the Merchant of Record (MoR). It therefore keeps
platform-level evidence for sales-tax collection, remittance, filing policy,
payee identity, withholding, and U.S. information returns. A company payee
can still have its own state registrations, but a current platform policy
snapshot determines the collection and reporting treatment used for each
transaction.

## Source-backed policy boundaries

The application does not treat tax law as a permanent code constant. A
super-admin must create an immutable, source-linked policy version before a
tax year can be prepared.

The 2026 federal policy inputs captured by this phase are:

- IRS Form 1099-K payment-card reporting is separate from third-party
  settlement organization reporting. The 2026 TPSO threshold is more than
  $20,000 and more than 200 transactions. Gross reportable transactions are
  retained as the reporting basis; fees, refunds, and credits are not used to
  silently reduce the Form 1099-K gross amount.
- IRS information-return instructions identify a general $2,000 threshold for
  many payments made after 2025, including the 2026 Form 1099-NEC/MISC rules,
  with form- and payment-specific exceptions. Thresholds are policy data, not
  assumptions in the payment code.
- Backup withholding is represented as a versioned policy rate. The 2026
  federal input is 24 percent and the resulting withholding entry is kept as
  separate evidence from the payment amount.
- Form W-9 is the U.S.-person identity document. W-8BEN is for a foreign
  individual, W-8BEN-E is for a foreign entity, and W-8ECI/W-8IMY are retained
  for applicable foreign payee cases. The platform stores encrypted identity
  values and safe fingerprints only.
- IRS IRIS is a filing boundary, not a fake export endpoint. Beginning with
  tax year 2026 / filing season 2027, IRS IRIS is the intake system for
  information returns and electronic filing requires the appropriate EIN/TCC
  configuration. A generated package is never marked filed or accepted merely
  because a CSV or review report was created.
- State marketplace-facilitator, remote-seller, registration, notice,
  collection, remittance, and seller-reporting rules vary by jurisdiction.
  Each jurisdiction row therefore contains an effective date, thresholds,
  collection/facilitator flags, filing metadata, and an authoritative source
  URL and revision.

Authoritative references reviewed for this implementation:

- <https://www.irs.gov/newsroom/irs-issues-faqs-on-form-1099-k-threshold-under-the-one-big-beautiful-bill-dollar-limit-reverts-to-20000>
- <https://www.irs.gov/instructions/i1099k>
- <https://www.irs.gov/instructions/i1099mec>
- <https://www.irs.gov/publications/p1099>
- <https://www.irs.gov/businesses/small-businesses-self-employed/am-i-required-to-file-a-form-1099-or-other-information-return>
- <https://www.irs.gov/pub/irs-dft/iw9--dft.pdf>
- <https://www.irs.gov/pub/irs-pdf/fw8ben.pdf>
- <https://www.irs.gov/pub/irs-pdf/fw8bene.pdf>
- <https://www.irs.gov/government-entities/indian-tribal-governments/irs-electronic-filing-and-e-services>
- <https://www.streamlinedsalestax.org/for-businesses/marketplace-facilitator>
- <https://www.streamlinedsalestax.org/for-businesses/marketplace-sellers>

## Data and security model

- `platform_tax_compliance_settings` stores the current super-admin policy and
  encrypted filer identifiers. `tax_jurisdiction_rules` versions each state
  or local rule and retains its review/source metadata.
- `payee_tax_profiles` stores the classification, document type, validity,
  safe TIN suffix, review state, and external source-file metadata. EIN/TIN,
  foreign tax IDs, GIINs, and registration numbers are ciphertext only.
  Plaintext TINs are not accepted by the reporting builder's input contract.
- `tax_transaction_records` freezes the tax engine version, taxable/exempt
  amounts, jurisdiction, rate, collection mode, and source snapshot at the
  time of calculation. `tax_return_periods` holds remittance and filing
  evidence by jurisdiction and period.
- `tax_withholding_entries` is an append-only evidence ledger for backup
  withholding. Reversals use compensating entries; the original evidence is
  not edited.
- `tax_document_runs`, `tax_document_rows`, and `tax_compliance_events` keep
  immutable run policy, validation, row hashes, export metadata, and an audit
  chain. Ordinary logs and validation errors contain no raw taxpayer IDs.

The database migrations do not create tenant-facing policy access. The
application service `assertSuperAdmin` is the first server-side guard; RLS and
admin server actions will be wired in the database-hardening and API phases.

## One-click U.S. package

`buildUsTaxDocumentPackage` is the reviewable one-click preparation boundary:

1. Select a tax year and immutable policy version.
2. Validate the filer and current payee identity documents.
3. Aggregate payment-card, TPSO, nonemployee-compensation, and configured
   miscellaneous payment categories into 1099-K, 1099-NEC, and 1099-MISC rows.
4. Apply identity validity and withholding validation gates.
5. Produce a deterministic review HTML report, CSV data export, manifest, row
   issues, and SHA-256 content fingerprint.
6. Persist the run and audit event using the migration-backed tables.

The current package is intentionally a data/review package rather than an
invented IRS submission implementation. The manifest always says
`filingStatus: not_filed`; an IRIS adapter with a configured TCC, official
submission format, acknowledgement handling, and accepted/rejected state
machine is a separate integration. Recipient copies and official IRS form
rendering must be added only after the official form specifications and the
platform's PDF/storage phase are available. Foreign payees are not emitted as
U.S. 1099 recipients; their W-8 status is retained for withholding review and
an applicable Form 1042-S workflow requires its own authoritative rules and
integration.

## Configuration validation checklist

A policy version must supply:

- tax year and immutable policy version;
- source URLs and review metadata;
- Form 1099-K payment-card/TPSO treatment and thresholds;
- Form 1099-NEC/MISC thresholds and categories;
- backup withholding rate;
- IRIS/TCC readiness state;
- state or jurisdiction collection, facilitator, nexus, remittance, filing,
  notice, and seller-reporting rules.

No default in the TypeScript library is a substitute for the persisted
super-admin policy. The included 2026 defaults are an explicit seed for local
review and must be snapshotted before production use.

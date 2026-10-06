# The data model

Two hundred odd tables is too many to draw on one page and still be read, so
they are grouped here by the question each group answers. Within a group,
the arrow means "points at".

## Who is who

```
companies ──< users
         ──< company_profiles        (frozen onto each issued invoice)
         ──< tenant_security_policies
         ──< accountant_company_access >── users (role: accountant)
resellers ──< companies              (white label parent)
affiliates ──< affiliate_clicks, affiliate_commissions
```

A `company` is a tenant. A `user` belongs to exactly one company, except a
`super_admin`, who belongs to none, and an `accountant`, who reaches several
through the join table. A client is not a user and never has an account;
they arrive through a signed link.

## What is sold and billed

```
clients ──< invoices ──< invoice_items
                     ──< invoice_taxes
                     ──< document_events        (sent, opened, viewed)
                     ──< invoice_work_evidence  (proof of the work)
products ──< invoice_items
estimates ──< estimate_items
recurring_profiles ──> invoices
```

An issued invoice carries a snapshot of the business profile, so changing a
logo or an address never rewrites history.

## Money arriving

```
payment_intents ──> payments ──< payment_allocations ──> invoices
payments ──> settlements ──> wallets ──< wallet_transactions
settlements ──> payouts (through attach_settlements_to_payout)
refunds, disputes ──> payments
checkout_consents ──> invoices      (what the payer agreed to)
settlement_policies                  (the fee, the hold, the promise)
```

This chain is the commercial heart of the platform: a payment becomes a
settlement, a settlement becomes a wallet balance under a hold, and a
released balance becomes a payout.

## Work and stock

```
projects ──< project_tasks, time_entries, project_milestones
time_entries ──> timesheets ──> approval
retainer_agreements ──< retainer_periods
products ──< stock_levels ──> warehouses
          ──< stock_movements
```

## Money leaving

```
vendors ──< supplier_bills, purchase_orders ──< purchase_order_items
expenses ──> expense_categories
```

## The books

```
ledger_accounts ──< journal_lines >── journal_entries
invoices, payments, expenses ──> journal_entries (posted automatically)
```

Every journal entry has at least two lines and the two sides are equal; the
database refuses anything else.

## Files

```
storage_targets ──< files ──< file_variants
                           ──< file_access_logs
upload_sessions ──> files
storage_quotas
```

A tenant that connects its own drive gets its own `storage_targets` row and
every new file goes there; the platform store stays as the fallback.

## Communication

```
message_templates ──> messages ──< message_events
reminder_rules, reminder_settings ──> invoice_reminders
payment_promises ──> invoices
marketing_campaigns ──< campaign_steps, campaign_recipients
social_channels ──< social_posts ──< social_post_targets
```

## The platform itself

```
platform_settings, platform_domains, platform_health_checks
integration_providers ──< integration_credentials ──< integration_connection_tests
analytics_destinations
site_pages, url_redirects
experiments ──< experiment_variants ──< experiment_assignments
subscription_plans ──< subscriptions ──> companies
```

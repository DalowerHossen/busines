# docs/planning/FEATURE-REGISTRY.md

# Master Feature Registry -- KD SOLUTION IT (PayProject)

Numbering scheme: `<Section>.<Local#>`. This supersedes all earlier
inconsistent global numbering (1-1336) used in draft conversations -- those
numbers overlapped in places and are not used as the source of truth anymore.
Status values: Pending (not built yet), Done, Superseded (see note).
Everything below is IN SCOPE. Nothing from prior drafts was dropped; items
found missing in the latest deep-analysis pass are in GAP-ADDITIONS-FF.md
(section FF) and are equally in scope.

## A. Brand & Design System

A.1 KD SOLUTION IT branding | A.2 Custom design system (not default shadcn look)
A.3 Branded sidebar + topbar | A.4 Logo component + favicon
A.5 CSS custom-property branding (instant, no rebuild)
A.6 Z-index scale rule (toast 80 > dropdown 75 > modal 70 > overlay 60)
A.7 Responsive 320-1920px | A.8 Touch targets >= 44px
A.9 Hover + transition micro-interactions | A.10 Toast notification system
A.11 Empty-state SVG illustrations (no external images)
A.12 Branded loading skeletons | A.13 Print stylesheet (invoice/report)
A.14 Dark/light theme toggle

## B. Public Site (all CMS-editable)

B.1 Homepage hero + CTA | B.2 Product screenshot-style preview
B.3 Feature grid section | B.4 Pricing preview section
B.5 Testimonials section | B.6 FAQ teaser + full FAQ page
B.7 Footer company links | B.8 About page | B.9 Contact page (ticket fallback)
B.10 Terms page | B.11 Privacy page | B.12 Refund page
B.13 Problem-solving guide page | B.14 support@kdsolutionit.com shown site-wide
B.15 SEO meta + OpenGraph per page | B.16 sitemap.xml + robots.txt
B.17 Branded 404 + error pages

## C. Authentication

C.1 Supabase email/password auth | C.2 Branded auth screen + company panel
C.3 Email verification flow | C.4 Forgot/reset password
C.5 Password strength indicator | C.6 Custom SMTP for auth mail
C.7 Role-based redirect after login | C.8 Middleware route protection
C.9 Session refresh

## D. Onboarding & Company Profile

D.1 Plan selection at signup | D.2 Free plan pre-selected
D.3 Company onboarding wizard | D.4 CompanyProvider auto-fill
D.5 Company profile snapshot (frozen per invoice, company_profile_snapshots)
D.6 Invoice prefix setup | D.7 Multi-currency support
D.8 Logo applies to NEW invoices only (old invoices keep their snapshot)

## E. Dashboard

E.1 Revenue overview cards | E.2 Due/outstanding summary
E.3 Recent invoices list | E.4 Revenue chart (Recharts)
E.5 Quick-action shortcuts | E.6 Global search

## F. Client (CRM)

F.1 Client CRUD | F.2 Inline new-client dialog | F.3 Client search + filter
F.4 Client activity timeline | F.5 Client statement
F.6 Client CSV import/export

## G. Product / Service

G.1 Product-service CRUD | G.2 Product search dropdown
G.3 Inline new-item add | G.4 Price + tax setting

## H. Invoicing (core)

H.1 Invoice create/edit/delete | H.2 Invoice duplicate
H.3 Dynamic line items | H.4 Discount + tax calculation
H.5 Decimal-safe money math | H.6 Auto invoice numbering (gapless, per company)
H.7 Status: draft/sent/viewed/paid/overdue
H.8 Public tracker /i/[token] (no login)
H.9 Invoice QR code | H.10 PDF download (logo + frozen snapshot)
H.11 Send-to-client email with link | H.12 Invoice timeline feed
H.13 Notes + internal notes | H.14 Payment terms / due date
H.15 Partial payment | H.16 Bulk actions | H.17 Invoice attachments

## I. Estimates & Other Documents

I.1 Estimate CRUD | I.2 Estimate -> invoice convert
I.3 Public estimate approval | I.4 Credit note
I.5 Recurring invoice (cron-driven)

## J. Payment

J.1 Stripe integration | J.2 PayPal integration | J.3 Paddle integration
J.4 Manual/bank payment | J.5 Own gateway keys (default path)
J.6 Platform-gateway opt-in with terms checkbox (MoR path, KYC-gated)
J.7 Webhook raw-body verification | J.8 Webhook idempotency + rate limit
J.9 Payment receipt | J.10 Refund handling

## K. Reports

K.1 Sales report | K.2 Expense report | K.3 Client report
K.4 Tax summary report | K.5 VAT in/out + net payable
K.6 Report TOTAL row | K.7 Period/date filter
K.8 CSV export per report | K.9 PDF export per report

## L. Team & KYC

L.1 Team invite (pending -> active) | L.2 Role & permission
L.3 Member remove | L.4 KYC ID front upload | L.5 KYC ID back upload
L.6 File validation (5MB max, image/PDF) | L.7 Upload preview
L.8 Manual admin review (anti-fraud, no OCR)

## M. Settings

M.1 Company profile settings | M.2 Logo upload | M.3 Branding settings
M.4 Gateway key settings (AES-256 encrypted) | M.5 Custom domain add
M.6 Domain verification | M.7 Billing/subscription upgrade
M.8 One-click JSON backup download | M.9 Notification preference

## N. Super Admin

N.1 Admin overview | N.2 User management (search/filter)
N.3 Manual verify user | N.4 Suspend/activate | N.5 Soft delete user
N.6 Self-change block guard (cannot demote/delete self, cannot delete super_admin)
N.7 Plan CRUD (slug=free reserved) | N.8 Plan edit input coercion fix (no false "validation failed")
N.9 Subscription edit + sync to company | N.10 Coupon management
N.11 Platform fee config | N.12 Payout processing | N.13 KYC review approve/reject
N.14 Gateway configuration | N.15 Revenue analytics | N.16 Audit log viewer
N.17 CMS editor (all public pages) | N.18 Email template manager
N.19 Support ticket inbox | N.20 Platform branding control
N.21 System settings + SMTP | N.22 Blank-password SMTP save (keeps saved password)
N.23 Maintenance mode

## O. Email Engine

O.1 sendPlatformMail central function | O.2 Resend SMTP (smtp.resend.com:587 TLS)
O.3 Welcome mail | O.4 Invoice/estimate mail | O.5 Status/reminder mail
O.6 Subscription mail | O.7 Mail failure = log only, never blocks the action
O.8 Branded email header, all mail from support@kdsolutionit.com

## P. Security & Data

P.1 Multi-tenant company*id scope everywhere | P.2 Supabase RLS policy on every table
P.3 Soft delete (deleted_at) everywhere | P.4 Audit log everywhere
P.5 AES-256 secret encryption | P.6 Rich-text sanitization
P.7 Client + server Zod validation on every form | P.8 DB transaction + rollback
P.9 Rate limiting | P.10 Server-only ENV rule (only 7 NEXT_PUBLIC* vars)

## Q. Deploy & Ops

Q.1 Netlify deploy config | Q.2 .env.example template
Q.3 scripts/backup.sh (pg_dump) | Q.4 scripts/restore.sh (pg_restore)
Q.5 Supabase migrations + seed | Q.6 Cron: recurring invoices
Q.7 Cron: overdue + reminder | Q.8 Path comment per file | Q.9 One commit per file

## P2. WhatsApp Automation

P2.1 Meta Cloud API client | P2.2 WhatsApp template manager
P2.3 Send invoice via WhatsApp | P2.4 Event-based automation rules
P2.5 Bulk campaign | P2.6 Delivery/read tracking | P2.7 Inbound WhatsApp webhook

## P3. QR Business Card (SUPERSEDED — excluded from current scope)

Status: SUPERSEDED by the owner on 2026-10-06. These historical requirements are retained for traceability, but no QR business card implementation is planned.

P3.1 QR card builder | P3.2 vCard QR generation | P3.3 Card design customization
P3.4 Public share URL | P3.5 Online card verification | P3.6 Verified badge
P3.7 Scan analytics

## P4. E-commerce Integration

P4.1 Shopify connection | P4.2 WooCommerce connection
P4.3 Store API key encryption | P4.4 Order webhook sync
P4.5 Order -> auto invoice | P4.6 Auto invoice email
P4.7 Sync log + retry | P4.8 Product mapping

## P5. Inventory & Warehouse

P5.1 Stock level tracking | P5.2 Multi-warehouse | P5.3 Stock movement ledger
P5.4 Auto stock decrement on invoice | P5.5 Low-stock alert
P5.6 Stock adjustment | P5.7 Product bundle

## P6. Supplier & Purchase

P6.1 Supplier CRUD | P6.2 Purchase order creation | P6.3 PO -> stock receive
P6.4 Supplier bill | P6.5 Payable tracking

## P7. Expense & Accounting

P7.1 Expense CRUD | P7.2 Expense category | P7.3 Recurring expense
P7.4 Receipt upload | P7.5 Chart of accounts | P7.6 Double-entry journal
P7.7 Profit & Loss | P7.8 Balance sheet | P7.9 Cash flow statement
P7.10 Bank CSV import

## P8. Virtual Wallet & MoR

P8.1 Merchant-of-Record mode | P8.2 KYC-gated MoR access
P8.3 Own-gateway mandatory without KYC | P8.4 Virtual wallet balance
P8.5 Wallet transaction ledger | P8.6 Platform fee deduction
P8.7 Hold period (configurable days) | P8.8 Hold-release cron
P8.9 Payout request | P8.10 Bank / local-rail payout
P8.11 Chargeback handling | P8.12 3DS toggle (see ARCHITECTURE-DECISIONS.md #5 -- SUPERSEDES old "3DS OTP processing")

## P9. Affiliate Program

P9.1 Affiliate registration | P9.2 Referral tracking link
P9.3 Commission calculation | P9.4 Affiliate dashboard (blind, own stats only)
P9.5 Commission payout request | P9.6 Admin affiliate approval

## P10. Public API & Webhooks

P10.1 RESTful v1 API | P10.2 API key generate/revoke | P10.3 API permission scope
P10.4 API rate limit | P10.5 API usage log | P10.6 Outgoing webhook endpoint
P10.7 Event subscription | P10.8 HMAC signing secret
P10.9 Delivery retry + log | P10.10 API documentation page

## P11. Client Access (tokenized -- renamed from "Client Portal")

P11.1 Signed access-token link (no separate login) | P11.2 Token-based hub of invoices
P11.3 Online payment via token link | P11.4 Receipt download
P11.5 Payment history (token-scoped) | P11.6 Estimate approval via token link

## P12. Blog & Status

P12.1 Blog list + detail | P12.2 Super-admin blog editor
P12.3 Draft/publish + schedule | P12.4 Cover image + SEO
P12.5 Category/tag | P12.6 Status page (uptime) | P12.7 Incident management

## P13. Per-Tenant Branding

P13.1 Tenant's own logo | P13.2 Tenant's own color/font
P13.3 Auto-fill branding into invoices | P13.4 Branded PDF header/footer
P13.5 Branded client email | P13.6 Branded portal + public pages
P13.7 Live branding preview

## P14. US-Style Professional Invoice (Amazon-acceptable)

P14.1 US invoice layout | P14.2 Amazon-acceptable format
P14.3 Bill To / Ship To | P14.4 Invoice No + Date + Terms
P14.5 Qty x Unit Price x Amount | P14.6 Sharp decimal unit price
P14.7 Configurable decimal precision | P14.8 Subtotal/Tax/Shipping/Total
P14.9 Amount in words | P14.10 Remit-To / bank info block
P14.11 Tax ID / EIN field | P14.12 PO number reference
P14.13 Terms & Conditions block | P14.14 Multiple layout templates
P14.15 Print-perfect A4/Letter

## P15. Account Security

P15.1 2FA for all account roles (TOTP) | P15.2 QR setup + backup codes
P15.3 2FA recovery | P15.4 Google OAuth login | P15.5 GitHub OAuth login
P15.6 Active session management

## P16. GDPR & Compliance

P16.1 Data export request | P16.2 Account delete request
P16.3 Consent management | P16.4 Cookie banner | P16.5 Data retention policy

## P17. Monitoring & Testing

P17.1 Sentry error monitoring | P17.2 Performance tracing
P17.3 Vitest unit tests | P17.4 Integration tests | P17.5 Playwright E2E tests
P17.6 GitHub Actions CI | P17.7 Health-check endpoint

## P18. Hosting Flexibility

P18.1 Docker self-hosting | P18.2 docker-compose (dev/prod)
P18.3 Nginx reverse proxy + SSL | P18.4 VPS deploy guide
P18.5 Vercel-compatible build | P18.6 Any-domain DNS pointing

## R1. Trial, Plan Limits & Monetization

R1.1 14-day free trial | R1.2 Trial -> Free auto-downgrade (never locks)
R1.3 Never-lock downgrade policy | R1.4 Plan limit enforcement
R1.5 Usage meter + quota bar | R1.6 Limit-reached upgrade prompt
R1.7 Coupon redemption at checkout | R1.8 Prorated upgrade/downgrade
R1.9 Failed-payment dunning | R1.10 Renewal reminder mail
R1.11 Free invoice generator (no login)

## R2. Notification & Realtime

R2.1 In-app notification center | R2.2 Bell + unread count
R2.3 Supabase Realtime updates | R2.4 Email queue processor
R2.5 Bounce/complaint handling | R2.6 Unsubscribe management
R2.7 Email/WhatsApp opt-in consent

## R3. Billing Lifecycle

R3.1 Payment reminder schedule | R3.2 Late fee auto-calculation
R3.3 Installment/payment plan | R3.4 Debit note | R3.5 Proforma invoice
R3.6 Advance/deposit invoice | R3.7 Client credit balance
R3.8 Write-off / bad debt | R3.9 Separate numbering series (EST/CN/PO)
R3.10 Exchange rate auto-update | R3.11 Multi-currency conversion display

## R4. Tax & Compliance

R4.1 Tax rate management | R4.2 Compound/multi-tax | R4.3 US state sales tax
R4.4 VAT/GST number field | R4.5 Tax-exempt client | R4.6 Fiscal year setting
R4.7 Rounding rule config

## R5. Report Expansion

R5.1 AR aging report | R5.2 AP aging report | R5.3 Product-wise sales
R5.4 Client-wise profit | R5.5 Inventory valuation / COGS
R5.6 Scheduled email report | R5.7 Saved filter preset

## R6. Inventory Expansion

R6.1 Warehouse stock transfer | R6.2 SKU / barcode support
R6.3 Sales return (RMA) | R6.4 Purchase return | R6.5 Packing slip / delivery note

## R7. Team, Permission & Multi-Company

R7.1 Granular permission matrix | R7.2 Company activity log
R7.3 Multi-company switcher | R7.4 Client tag / group
R7.5 Timezone + date format | R7.6 Expense approval flow

## R8. Super Admin Expansion

R8.1 User impersonation | R8.2 Announcement bar | R8.3 Audit log export
R8.4 Storage quota monitor | R8.5 Broadcast email | R8.6 Changelog page
R8.7 Platform health dashboard | R8.8 Tenant support-ticket submission

## R9. Navigation & UX Integrity (owner emphasis)

R9.1 Central navigation map | R9.2 Breadcrumb everywhere
R9.3 Active-state highlight | R9.4 Mobile drawer / bottom nav
R9.5 Command palette (Cmd/Ctrl+K) | R9.6 Keyboard shortcuts
R9.7 Zero dead-link audit | R9.8 Consistent back/cancel behavior
R9.9 Onboarding checklist / tour | R9.10 WCAG a11y + focus ring
R9.11 Error boundary + retry | R9.12 Confirmation dialog pattern

## R10. Security Hardening

R10.1 CSRF protection | R10.2 Security headers + CSP
R10.3 Brute-force lockout | R10.4 Suspicious login alert
R10.5 Upload magic-byte verification | R10.6 suspended / rate-limit pages

## R11. Performance & SEO

R11.1 ISR / revalidate caching | R11.2 Code splitting + lazy load
R11.3 Image optimization | R11.4 JSON-LD structured data
R11.5 PWA manifest | R11.6 Analytics + consent gating

## R12. Developer Experience

R12.1 API playground | R12.2 Webhook test/ping | R12.3 Sandbox/test mode
R12.4 Demo seed data

## R13. Extra Cron Jobs

R13.1 Cron: session cleanup | R13.2 Cron: DB backup
R13.3 Cron: data deletion | R13.4 Cron: estimate expiry

## S1. Gateway Framework (pluggable)

S1.1 NMI gateway integration | S1.2 NMI Three-Step Redirect | S1.3 NMI Direct Post
S1.4 NMI tokenization | S1.5 NMI recurring billing
S1.6 Pluggable gateway adapter interface | S1.7 Admin-addable custom gateway
S1.8 JSON-driven gateway config schema | S1.9 Gateway enable/disable toggle
S1.10 Gateway sandbox/test mode | S1.11 Gateway health + error log
S1.12 Default gateway priority order

## S2. Local Payment Rails

S2.1 Local-rail payment acceptance (generic-labeled in UI; see Architecture #4)
S2.2 Second local-rail payment acceptance
S2.3 Local-rail payout | S2.4 Super-admin global toggle
S2.5 Tenant-level toggle | S2.6 Manual transaction verification
S2.7 Country-based gateway visibility

## S3. English-Only Interface

S3.1 English-only UI policy | S3.2 Bengali-detection lint guard
S3.3 Central strings file

## S4. Client Subscription Billing (owner's own clients)

S4.1 Client subscription plan | S4.2 Auto-charge recurring billing
S4.3 Saved card vault (tokenized) | S4.4 Autopay authorization
S4.5 Pause / resume / cancel | S4.6 Proration calculation
S4.7 Failed-charge retry | S4.8 Subscription MRR report

## S5. Payment Experience

S5.1 Standalone payment link | S5.2 Hosted checkout page
S5.3 Partial refund | S5.4 Multi-invoice allocation
S5.5 Surcharge / convenience fee | S5.6 Auto receipt email
S5.7 Apple Pay / Google Pay

## S6. MoR Risk & Settlement

S6.1 Merchant onboarding flow | S6.2 MoR agreement acceptance (versioned)
S6.3 Risk scoring | S6.4 Velocity/limit rules | S6.5 Fraud alert
S6.6 AML / sanctions screening | S6.7 Transaction monitoring
S6.8 Settlement report | S6.9 Payout schedule + fee
S6.10 Chargeback evidence upload | S6.11 Dispute timeline
S6.12 Negative-balance recovery | S6.13 PCI-safe (no card storage)
S6.14 Reconciliation dashboard

## S7. Document Integrity & Workflow

S7.1 Sent-invoice lock (immutable) | S7.2 Revision history
S7.3 Invoice approval workflow | S7.4 Draft autosave
S7.5 Duplicate detection | S7.6 Trash + restore UI
S7.7 Yearly number reset option | S7.8 E-signature (estimate approval)
S7.9 Bulk email send | S7.10 Email open tracking

## S8. Support & Help

S8.1 Help center + search | S8.2 In-app help widget
S8.3 Ticket priority + SLA | S8.4 Canned response
S8.5 Email-to-ticket | S8.6 NPS / feedback collection

## S9. Marketing & Growth

S9.1 Referral program (customer-facing) | S9.2 Newsletter signup
S9.3 Lead capture form | S9.4 Demo / contact sales
S9.5 UTM tracking | S9.6 Integration directory page
S9.7 Partner page | S9.8 Press / brand kit

## S10. Legal & Trust

S10.1 Company legal info in footer | S10.2 Security page | S10.3 DPA page
S10.4 Sub-processor list | S10.5 Cookie policy | S10.6 Accessibility statement
S10.7 security.txt | S10.8 Terms version + acceptance log
S10.9 Platform subscription invoice/receipt | S10.10 SaaS VAT/tax invoice

## S11. Platform Engineering

S11.1 Background job queue | S11.2 Async export center
S11.3 Cron monitoring + alert | S11.4 Feature flag
S11.5 Config/secret management | S11.6 Data retention + archive
S11.7 Migration versioning

## T1. Tokenized Client Access (no login)

T1.1 Signed access token (HMAC) | T1.2 Per-document unique link
T1.3 Token expiry setting | T1.4 Token revoke/reissue
T1.5 Optional email-OTP gate (default off, per-owner toggle)
T1.6 Client hub link (all invoices) | T1.7 Link open/view log
T1.8 IP + user-agent audit | T1.9 Token rate-limit + brute guard
T1.10 Indexing block (noindex) | T1.11 Expired-link re-request page
T1.12 Client-facing branded shell

## T2. Client Email Journey (sole channel)

T2.1 Send invoice (with link) | T2.2 Estimate approval link
T2.3 Payment reminder link | T2.4 Receipt/confirmation mail
T2.5 Subscription mandate link | T2.6 Statement mail
T2.7 Per-email delivery status | T2.8 Resend / copy-link button

## T3. Staff & Role-Based Email Routing

T3.1 Staff invite email | T3.2 Staff permission presets (Sales/Accounts/Support)
T3.3 Assignment notification | T3.4 Action-based email rule
T3.5 Staff-wise activity log | T3.6 Staff seat limit (plan-based)
T3.7 Staff deactivate (data retained)

## T4. Gateway Routing Logic (KYC-conditional)

T4.1 Own-gateway mandatory by default | T4.2 KYC verified unlocks MoR
T4.3 MoR condition/limit config | T4.4 Per-merchant fee override
T4.5 Gateway fallback chain | T4.6 Method selection at checkout
T4.7 MoR suspend (on risk)

## U1. Affiliate -- Fully Blind Role

U1.1 Affiliate sees own numbers only | U1.2 Referred company name hidden
U1.3 Referred activity invisible | U1.4 Visible: click/signup counts only
U1.5 Visible: commission & payout only | U1.6 No invoice/client data ever
U1.7 Separate RLS policy for affiliate

## U2. Email Sending -- Owner Only

U2.1 Owner-only send permission | U2.2 Staff drafts, cannot send
U2.3 "Request send" approval flow | U2.4 Send button hidden for staff

## U3. Batch / Bulk Sending

U3.1 Multi-select invoices | U3.2 Batch send queue | U3.3 Batch progress bar
U3.4 Per-email success/fail result | U3.5 Retry failed sends
U3.6 Batch schedule (send later) | U3.7 Duplicate-send guard
U3.8 Batch history log

## U4. Summary Dashboard (sent vs paid)

U4.1 Total invoices sent | U4.2 Count paid | U4.3 Count unpaid
U4.4 Count overdue | U4.5 Count viewed | U4.6 Count email failed
U4.7 Total amount vs collected | U4.8 Collection rate %
U4.9 Average time-to-pay (days) | U4.10 Batch-wise performance
U4.11 Date-range filter | U4.12 Drill-down list

## U5. Tenant Isolation -- Strict

U5.1 One owner never sees another owner | U5.2 company_id mandatory on every query
U5.3 RLS default-deny policy | U5.4 Cross-tenant ID guard (404 not 403)
U5.5 Storage file-path isolation | U5.6 Shared tables still tenant-scoped
U5.7 Automated isolation test | U5.8 Search/export tenant guard
U5.9 Only super_admin has a global view

## V1. Pre-Payment Consent Evidence

V1.1 Mandatory consent checkbox | V1.2 "I received goods/services" confirmation
V1.3 Invoice-details-read confirmation | V1.4 Terms acceptance (versioned snapshot)
V1.5 Refund policy acceptance | V1.6 Pay button disabled without checkbox
V1.7 Consent timestamp (UTC) | V1.8 IP + geo-location record
V1.9 Device + user-agent fingerprint | V1.10 Exact consent text copy stored
V1.11 Immutable consent record

## V2. Delivery & Acceptance Proof

V2.1 Delivery confirmation field | V2.2 Work-completion/acceptance acknowledgement
V2.3 Client e-signature (optional) | V2.4 Estimate approval record
V2.5 Delivery proof upload (owner) | V2.6 Tracking number field
V2.7 Service completion date | V2.8 Client acceptance-link confirmation

## V3. Tamper-Proof Audit Chain

V3.1 Email send proof (message-id) | V3.2 Email delivery receipt
V3.3 Invoice open/view timestamp | V3.4 Per-view IP log
V3.5 Payment page visit log | V3.6 Full event timeline
V3.7 Hash-chain audit (tamper-evident) | V3.8 Invoice PDF hash stored
V3.9 Consent screen-state snapshot

## V4. One-Click Dispute Evidence Pack

V4.1 "Generate Evidence Pack" button | V4.2 PDF: invoice + consent + timeline
V4.3 Gateway-ready format (Stripe/PayPal) | V4.4 Consent screenshot-like render
V4.5 Email thread attachment | V4.6 Delivery-proof attachment
V4.7 Evidence pack download/send | V4.8 Per-dispute case file

## V5. Dispute Prevention

V5.1 Clear statement descriptor | V5.2 Instant receipt email
V5.3 Owner contact info on receipt | V5.4 "Contact seller first" message
V5.5 Refund policy shown before payment | V5.6 Direct refund-request link
V5.7 Fast refund tool (owner) | V5.8 High-risk transaction warning
V5.9 Unusual-amount flag | V5.10 New-client velocity check

## V6. Legal & Financial Protection

V6.1 Payment authorization record | V6.2 Chargeback reserve calculation
V6.3 Dispute-rate monitor (< 0.65%) | V6.4 High-dispute-rate merchant alert
V6.5 Evidence retention (18 months) | V6.6 super_admin dispute center

## W1. Layout Architecture

W1.1 Fixed left sidebar (app) | W1.2 Sidebar width 264px / collapsed 72px
W1.3 Sticky topbar (h-64px) | W1.4 Content max-width 1280px, centered
W1.5 Form-centric pages max-width 768px, centered
W1.6 Auth page = centered card + brand panel
W1.7 Public page = full-width sections, centered inner container
W1.8 Standard page header (title + breadcrumb + actions)
W1.9 Primary action button on the right | W1.10 Spacing scale (4/8/12/16/24/32)
W1.11 12-column grid, gap-24

## W2. Navigation Integrity

W2.1 Single central nav-map file | W2.2 Every route registered in nav-map
W2.3 Auto breadcrumb (from nav-map) | W2.4 Active + parent-active highlight
W2.5 Role-based menu filter | W2.6 Build-time link verification
W2.7 Zero dead-link audit script | W2.8 Consistent back/cancel behavior
W2.9 Mobile drawer (Sheet) navigation | W2.10 Tab navigation pattern (settings/detail)

## W3. Page-State Completeness

W3.1 Loading skeleton on every page | W3.2 Error + retry on every page
W3.3 Empty state + CTA on every page | W3.4 Success state on every page
W3.5 No blank white screens, ever | W3.6 No "Coming soon" pages
W3.7 Every table: pagination + sort + filter
W3.8 Every form: inline validation + disabled submit until valid

## W4. Content Completeness (100% English)

W4.1 Real copy on every page (no lorem ipsum) | W4.2 Every button/label/tooltip written
W4.3 Every error/success message written | W4.4 Every email template fully written
W4.5 Real legal content on every CMS page | W4.6 Zero Bengali in code (lint-enforced)
W4.7 UI/DB seed/comments all English

## X. Mobile-First Standard

X.1 Mobile-first CSS approach | X.2 Breakpoints 320/375/430/768/1024/1280/1920
X.3 Hamburger + slide drawer nav | X.4 Bottom nav bar (5 core items)
X.5 iOS safe-area inset support | X.6 Tables -> card list on mobile
X.7 Sticky first column (horizontal scroll) | X.8 Full-screen Sheet dialogs on mobile
X.9 Sticky bottom action bar (forms) | X.10 Touch targets >= 44x44px
X.11 Thumb-zone action placement | X.12 Correct input keyboard type (numeric/email)
X.13 16px font minimum (prevents iOS zoom) | X.14 Mobile invoice form stepper
X.15 Swipe actions (list items) | X.16 Pull-to-refresh
X.17 Mobile-optimized charts | X.18 Mobile PDF preview
X.19 Mobile payment page (Apple/Google Pay) | X.20 Offline-detection banner
X.21 Image lazy-load + responsive srcset | X.22 Mobile load priority (LCP < 2.5s)
X.23 Reduced-motion support | X.24 Landscape mode handling
X.25 Every page tested at 320px

## Y1. Secret & Key Management

Y1.1 Key-vault abstraction layer | Y1.2 ENCRYPTION_KEY never rotates
Y1.3 Other keys support rotation | Y1.4 Key-version tag on encrypted fields
Y1.5 service_role used server-only | Y1.6 Client-bundle secret-leak scan
Y1.7 ENV schema validation at boot | Y1.8 Fail-fast on missing ENV
Y1.9 Per-environment keys separated | Y1.10 Secret-access audit

## Y2. Application Security

Y2.1 IDOR guard (ownership check) | Y2.2 SQL injection prevention (parameterized)
Y2.3 SSRF guard (webhook/ecommerce URLs) | Y2.4 XSS output encoding
Y2.5 CSP nonce-based | Y2.6 Clickjacking (frame-ancestors)
Y2.7 Strict CORS allowlist | Y2.8 Open-redirect prevention
Y2.9 Mass-assignment guard (zod strip) | Y2.10 Prototype-pollution guard
Y2.11 ReDoS-safe regex | Y2.12 Upload magic-byte + extension match
Y2.13 SVG sanitize/re-encode | Y2.14 Malware scan hook
Y2.15 Zip-bomb / oversized-file guard | Y2.16 Webhook replay window (+/-5 min)
Y2.17 API idempotency-key support

## Y3. Access Control & Session

Y3.1 Server-side permission check everywhere | Y3.2 "UI hidden is not security" policy
Y3.3 Step-up 2FA for sensitive actions | Y3.4 Mandatory 2FA for super_admin actions
Y3.5 Admin IP allowlist (optional) | Y3.6 Impersonation banner + time limit
Y3.7 Impersonation write-blocked mode | Y3.8 Session-fixation prevention
Y3.9 Password change revokes all sessions | Y3.10 Password policy + breach check
Y3.11 Login velocity + captcha | Y3.12 Account recovery process

## Y4. Data Protection & Privacy

Y4.1 PII log redaction | Y4.2 PII scrub in error reports (Sentry)
Y4.3 Encryption-at-rest confirmation | Y4.4 Backup encryption
Y4.5 Storage signed URL + short expiry | Y4.6 Download rate-limit
Y4.7 Export file watermark + expiry | Y4.8 Append-only audit log
Y4.9 Data retention schedule | Y4.10 Right-to-delete proof
Y4.11 Cross-tenant fuzz test

## Y5. Supply-Chain & CI Security

Y5.1 npm audit CI gate | Y5.2 Dependency pinning + lockfile
Y5.3 Dependabot / update policy | Y5.4 Secret scanning in CI
Y5.5 SAST static scan | Y5.6 License compliance check
Y5.7 SBOM generation | Y5.8 Build reproducibility
Y5.9 Protected branch + review policy

## Y6. Email Deliverability

Y6.1 SPF/DKIM/DMARC setup guide | Y6.2 Domain verification checklist
Y6.3 Suppression list | Y6.4 Hard/soft bounce policy
Y6.5 Complaint (FBL) handling | Y6.6 Plain-text alternative part
Y6.7 List-Unsubscribe header | Y6.8 Spam-score pre-check
Y6.9 Send-rate throttle

## Y7. Financial Accuracy & Compliance

Y7.1 Gapless sequential numbering | Y7.2 Numbering race-condition lock
Y7.3 Double-submit/duplicate-charge guard | Y7.4 Banker's rounding option
Y7.5 Line vs total rounding policy | Y7.6 Multi-currency FX gain/loss
Y7.7 Historical rate freeze | Y7.8 Accounting period lock
Y7.9 Financial close process | Y7.10 Client credit limit
Y7.11 Multi-level dunning ladder | Y7.12 Tax filing export format
Y7.13 Legal archive (7 years) | Y7.14 Payment-allocation audit

## Y8. Design QA & Consistency

Y8.1 Single spacing/radius/shadow scale | Y8.2 Contrast ratio >= 4.5:1
Y8.3 Full dark-mode parity | Y8.4 Single icon set (lucide)
Y8.5 Single illustration style | Y8.6 Motion system (duration/easing)
Y8.7 Consistent toast position | Y8.8 Form pattern guide
Y8.9 Table density standard | Y8.10 Centralized date/number/currency format
Y8.11 Timezone display policy | Y8.12 Error-message catalog (single voice)
Y8.13 Microcopy guide | Y8.14 Skip-link + focus management
Y8.15 Visual regression snapshots

## Y9. Performance Budget

Y9.1 Lighthouse >= 90 target | Y9.2 LCP < 2.5s / INP < 200ms / CLS < 0.1
Y9.3 Bundle-size budget + analyzer | Y9.4 N+1 query prevention
Y9.5 Index coverage audit | Y9.6 Cursor pagination for large lists
Y9.7 Server-side filter/sort | Y9.8 Cache layer + invalidation map
Y9.9 Dynamic import of heavy components

## Y10. Observability & Incident

Y10.1 Structured logging + request-id | Y10.2 Metrics (payment success rate, etc.)
Y10.3 Alert rules + thresholds | Y10.4 Webhook failure alert
Y10.5 Cron failure alert | Y10.6 Uptime check + status auto-update
Y10.7 Error-budget dashboard | Y10.8 Incident runbook
Y10.9 Disaster recovery (RTO/RPO) | Y10.10 Backup restore drill
Y10.11 Post-mortem template

## Y11. Customer Lifecycle & Offboarding

Y11.1 Account close request | Y11.2 Offboarding data export
Y11.3 Grace period + recovery | Y11.4 Full tenant deletion job
Y11.5 Data migration import tool | Y11.6 Seat/usage billing reconciliation
Y11.7 Suspension -> read-only mode | Y11.8 Abuse-handling policy

## Y12. Delivery Quality Gate (applies to every phase)

Y12.1 Definition of Done per phase | Y12.2 tsc --noEmit green
Y12.3 next build green | Y12.4 ESLint zero errors
Y12.5 Bengali-scan zero hits | Y12.6 Placeholder-scan zero hits (TODO/...)
Y12.7 Dead-link scan zero hits | Y12.8 Mobile 320px screenshot check
Y12.9 a11y auto-audit pass | Y12.10 Phase-level smoke test

## Z1. Netlify/Runtime Reality

Z1.1 Netlify function timeout strategy (10s/26s) | Z1.2 Long jobs -> background function
Z1.3 Webhook raw-body preservation config | Z1.4 6MB payload limit -> direct-to-storage upload
Z1.5 Large export -> async + signed URL | Z1.6 Netlify Scheduled Functions vs pg_cron
Z1.7 ISR/revalidate Netlify compatibility | Z1.8 Edge vs Node runtime mapping
Z1.9 Cold-start reduction | Z1.10 Supabase connection pooling (pgBouncer)
Z1.11 Serverless connection-leak prevention | Z1.12 Netlify/Vercel/Docker parity test

## Z2. Database Engineering Rigor

Z2.1 Money = numeric(18,4), never float | Z2.2 All timestamps TIMESTAMPTZ (UTC)
Z2.3 UUID v7 (index locality) | Z2.4 Partial unique index for soft delete
Z2.5 Enum vs lookup-table evolution policy | Z2.6 Zero-downtime migration rules
Z2.7 Migration rollback script | Z2.8 Idempotent seed (safe to rerun)
Z2.9 Check constraints (negative/range) | Z2.10 FK index completeness
Z2.11 Partial index (deleted_at IS NULL) | Z2.12 Postgres FTS + pg_trgm search
Z2.13 RLS performance (wrapped auth calls) | Z2.14 DB query timeout + statement_timeout
Z2.15 Dead-tuple/VACUUM monitoring

## Z3. Concurrency & Race Conditions

Z3.1 Advisory lock for invoice numbering | Z3.2 Optimistic locking (version column)
Z3.3 Concurrent-edit conflict message | Z3.4 Row lock on stock update
Z3.5 Serialized wallet balance update | Z3.6 Double-click payment guard
Z3.7 DB-backed queue (FOR UPDATE SKIP LOCKED) | Z3.8 Cron overlap prevention (leader lock)
Z3.9 Webhook processed_events table

## Z4. Invoice Legal Accuracy (Amazon-grade)

Z4.1 Tax-inclusive vs exclusive mode | Z4.2 Discount before/after tax config
Z4.3 Shipping-taxable toggle | Z4.4 Withholding tax field
Z4.5 Rounding adjustment line | Z4.6 Negative line / credit handling
Z4.7 Overpayment -> credit balance | Z4.8 Unit of Measure (UOM)
Z4.9 HS/SAC code field (optional) | Z4.10 Item code/SKU on invoice
Z4.11 Seller tax registration display | Z4.12 Remit-To block (bank/SWIFT/routing)
Z4.13 Net terms clearly displayed | Z4.14 Client currency vs company currency
Z4.15 Tax breakdown table (rate-wise) | Z4.16 Month-end/leap-year recurring rules

## Z5. PDF & Print Engine

Z5.1 Server-side PDF (reliable render) | Z5.2 Font embedding + unicode
Z5.3 Multi-page table + repeating header | Z5.4 Page-break control
Z5.5 Page X of Y footer | Z5.6 A4 <-> Letter toggle
Z5.7 @page margin + print CSS | Z5.8 PDF snapshot stored at send time
Z5.9 PDF checksum/hash record | Z5.10 Regeneration vs archive policy

## Z6. Email Identity & Anti-Abuse

Z6.1 From: "Tenant via KD SOLUTION IT" | Z6.2 Reply-To: tenant's email
Z6.3 Platform address in email (CAN-SPAM) | Z6.4 Unsubscribe link (marketing mail)
Z6.5 No sending without verified email | Z6.6 New-tenant sending limit
Z6.7 Phishing/spam content scan | Z6.8 Link-domain allowlist
Z6.9 Abuse report endpoint | Z6.10 Brand-impersonation prevention
Z6.11 CMS/blog/upload moderation | Z6.12 Exact snapshot of sent emails

## Z7. Entitlement & Monetization

Z7.1 Central entitlement engine | Z7.2 Plan x feature matrix
Z7.3 Upsell UI on locked features | Z7.4 Server-side entitlement guard
Z7.5 Overage/usage-based billing | Z7.6 Add-on marketplace structure
Z7.7 "Powered by KD SOLUTION IT" badge | Z7.8 Badge removal = paid feature
Z7.9 White-label tier | Z7.10 Custom domain = plan-gated
Z7.11 Tenant sending-domain add-on

## Z8. Tenant Lifecycle & Growth

Z8.1 Company ownership transfer | Z8.2 Billing contact vs owner
Z8.3 Cancel flow + reason capture | Z8.4 Win-back offer
Z8.5 Onboarding drip email (day 1/3/7) | Z8.6 Demo data toggle
Z8.7 Product tour (first run) | Z8.8 In-app changelog widget
Z8.9 Feature-request board | Z8.10 Notification matrix (role x event)

## Z9. Admin Intelligence

Z9.1 Cross-tenant global search | Z9.2 Tenant health score
Z9.3 Churn-risk signal | Z9.4 MRR/ARR/LTV/cohort
Z9.5 Gateway-wise success rate | Z9.6 Support tenant-data export
Z9.7 Impersonation consent + audit | Z9.8 Admin-action undo window

## Z10. Legal & Consent Proof

Z10.1 Signup Terms acceptance + IP log | Z10.2 Re-consent on Terms version change
Z10.3 Tenant DPA acceptance | Z10.4 Sub-processor change notification
Z10.5 Granular cookie categories | Z10.6 Cookie-consent proof storage
Z10.7 Cookie-free analytics option | Z10.8 SLA/uptime commitment page
Z10.9 MoR liability disclosure

## Z11. Developer Interface

Z11.1 OpenAPI 3.1 spec file | Z11.2 Postman collection
Z11.3 API versioning + deprecation policy | Z11.4 Zapier/Make recipe docs
Z11.5 Webhook payload examples | Z11.6 Error-code reference table

## Z12. Final Polish

Z12.1 Client communication log (all mail) | Z12.2 Alternate-method UX on payment failure
Z12.3 Remaining-balance link on partial payment | Z12.4 Keyboard shortcut reference page
Z12.5 PWA install prompt | Z12.6 Offline page | Z12.7 aria-live form error announcement

## AA1. Token Leak & Link Security

AA1.1 Referrer-Policy: no-referrer on token pages | AA1.2 rel="noopener noreferrer" on outbound links
AA1.3 Never put PII in token URLs | AA1.4 Token enumeration resistance (128-bit)
AA1.5 Tokens masked in logs/analytics | AA1.6 No token passthrough to gateway redirects
AA1.7 No tracking pixel in PDFs | AA1.8 Email-forward-leak warning policy
AA1.9 Plan-based token link expiry

## AA2. Payment Engineering Depth

AA2.1 Zero-decimal currency (JPY/KRW) handling | AA2.2 Minor-unit conversion layer
AA2.3 PCI SAQ-A scope declaration | AA2.4 Card data never touches server (hosted fields)
AA2.5 Stripe Connect vs direct-key mode | AA2.6 MoR = platform-account routing
AA2.7 Post-settlement refund handling | AA2.8 Refund platform-fee policy
AA2.9 Payout minimum threshold | AA2.10 Payout FX + conversion fee
AA2.11 Failed payout reversal | AA2.12 Gateway payout <-> transaction reconciliation
AA2.13 Partial capture / auth-only | AA2.14 Sandbox test-card documentation

## AA3. Tax & International Compliance

AA3.1 EU reverse-charge rule | AA3.2 VAT ID verification (VIES) hook
AA3.3 US sales-tax nexus setting | AA3.4 Marketplace facilitator declaration
AA3.5 1099-K / merchant tax reporting | AA3.6 Country-based COA template
AA3.7 Tax-exemption certificate upload | AA3.8 Platform's own invoice sequence
AA3.9 Auditor legal-archive export | AA3.10 Data residency selection
AA3.11 Country-based mandatory invoice fields

## AA4. KYC/AML Depth & Maker-Checker

AA4.1 Business registration document | AA4.2 Beneficial owner info
AA4.3 Proof of address | AA4.4 Document expiry + re-verification cycle
AA4.5 Document-hash duplicate detection | AA4.6 Same-bank-account-multi-tenant flag
AA4.7 Device-fingerprint reuse detection | AA4.8 Periodic sanctions re-screening
AA4.9 KYC document read+audit trail | AA4.10 Four-eyes approval for large payouts
AA4.11 Maker-checker workflow | AA4.12 Admin-action undo/reversal log

## AA5. Form & Data-Safety UX

AA5.1 Unsaved-changes navigation guard | AA5.2 beforeunload warning
AA5.3 Draft recovery after crash | AA5.4 Duplicate-tab detection
AA5.5 Multi-tab session sync | AA5.6 Token-refresh race handling
AA5.7 Undo on destructive action (5 seconds) | AA5.8 Count-aware bulk-action confirmation
AA5.9 Optimistic UI + rollback | AA5.10 Autosave indicator
AA5.11 Realtime reconnect backoff | AA5.12 Co-editing presence indicator

## AA6. Data Migration & Opening Balances

AA6.1 QuickBooks/Zoho/Wave CSV import | AA6.2 Column-mapping wizard
AA6.3 Import preview + validation report | AA6.4 Import rollback
AA6.5 Legacy invoice number preservation | AA6.6 Client opening balance
AA6.7 Account opening balance | AA6.8 Historical payment import
AA6.9 Import duplicate detection

## AA7. Service-Business Billing

AA7.1 Project/job tracking | AA7.2 Time tracking (timer + manual)
AA7.3 Billable hours -> invoice | AA7.4 Hourly rate (staff/project based)
AA7.5 Timesheet approval | AA7.6 Milestone billing
AA7.7 Retainer / prepaid hours | AA7.8 Reimbursable expense rebilling
AA7.9 Project profitability report | AA7.10 Client-specific price list
AA7.11 Volume-based discount tiers

## AA8. Client Data Quality

AA8.1 Duplicate-client detection | AA8.2 Client merge tool
AA8.3 Client archive | AA8.4 Do-not-contact flag
AA8.5 Reminder opt-out (per client) | AA8.6 Bulk edit
AA8.7 Saved view (per user) | AA8.8 Export column chooser

## AA9. Tenant Security Policy (owner-controlled)

AA9.1 Enforce 2FA for staff | AA9.2 Owner resets staff password
AA9.3 Owner views staff login activity | AA9.4 Tenant IP restriction
AA9.5 Session timeout config | AA9.6 Staff approval amount cap
AA9.7 Owner approval for data export | AA9.8 SSO/SAML flag (enterprise, future)
AA9.9 Device/session revoke

## AA10. API Maturity

AA10.1 X-RateLimit-\* + Retry-After headers | AA10.2 Cursor pagination standard
AA10.3 Filter/sort syntax spec | AA10.4 Sparse fieldsets
AA10.5 Webhook signing-key rotation | AA10.6 Dead-letter queue
AA10.7 Per-event retry policy | AA10.8 API changelog
AA10.9 Stable error-code reference | AA10.10 API status/incident feed

## AA11. Release, Load & Cost Ops

AA11.1 Feature-flag based release | AA11.2 Canary + fast rollback
AA11.3 Maintenance window schedule + banner | AA11.4 k6 load test (core endpoints)
AA11.5 Declared load limits | AA11.6 Supabase usage monitor + alert
AA11.7 Resend quota monitor | AA11.8 Graceful degradation at quota
AA11.9 CI tenant-isolation test | AA11.10 Visual regression baseline
AA11.11 E2E seed tenant (isolated)

## AA12. Final Gaps

AA12.1 Correlation-id shown on error | AA12.2 Correlation-id attached to ticket
AA12.3 Tenant-level restore (single company) | AA12.4 Multi-branch/location
AA12.5 Estimate expiry reminder | AA12.6 Estimate attachment

## BB1. Storage Abstraction

BB1.1 Provider adapter interface | BB1.2 Presigned upload flow
BB1.3 Storage migration tool | BB1.4 Per-tenant storage quota
BB1.5 Provider fallback chain | BB1.6 Google Drive default adapter (see Architecture #7)
BB1.7 Drive service-account connection setting | BB1.8 Per-company Drive folder auto-create
BB1.9 Drive signed/expiring share-link generation | BB1.10 Drive quota/error fallback
BB1.11 Drive file-id/url metadata stored in Supabase | BB1.12 Future S3/Supabase-Storage adapter stub

## BB2. Media Optimization

BB2.1 AVIF/WebP conversion | BB2.2 Client-side resize before upload
BB2.3 EXIF/GPS strip | BB2.4 Multiple size variants (thumb/md/full)
BB2.5 srcset delivery | BB2.6 PDF font subsetting
BB2.7 PDF image downsampling (150-200 DPI) | BB2.8 PDF object-stream compression
BB2.9 KYC-scan quality-preserving mode (OCR-readable) | BB2.10 CSV/JSON gzip/brotli export
BB2.11 Bulk export as ZIP | BB2.12 Quality presets per use-case
BB2.13 Video/audio upload disabled (out of scope) | BB2.14 Compression benchmark doc

## BB3. File Lifecycle

BB3.1 Duplicate dedup (hash-based) | BB3.2 File versioning
BB3.3 Orphan cleanup job | BB3.4 Archive tier
BB3.5 Retention policy | BB3.6 Soft-delete restore
BB3.7 File access audit | BB3.8 Upload virus-scan hook
BB3.9 File-type allowlist enforcement

## BB4. Delivery & CDN

BB4.1 CDN cache headers | BB4.2 Signed-URL expiry
BB4.3 Hotlink prevention | BB4.4 Bandwidth throttle
BB4.5 Range-request support | BB4.6 Edge caching rule
BB4.7 Origin fallback

## BB5. Cost Control

BB5.1 Storage usage dashboard | BB5.2 Quota alert
BB5.3 Plan-based storage limit | BB5.4 Overage policy
BB5.5 Cost-per-tenant report | BB5.6 Storage cleanup suggestions

## BB6. Remaining File Gaps

BB6.1 In-app file preview (PDF/image) | BB6.2 Drag-drop multi-upload
BB6.3 Resumable upload | BB6.4 Upload progress/cancel
BB6.5 Mobile camera capture (KYC) | BB6.6 File access audit trail
BB6.7 Bulk download (ZIP) | BB6.8 File search
BB6.9 File tagging | BB6.10 Shared-file expiry notice

## CC1. Platform First-Run

CC1.1 Super-admin setup wizard (branding->SMTP->gateway->plan->domain)
CC1.2 /api/health dependency check | CC1.3 Build/version endpoint
CC1.4 Build hash in footer | CC1.5 First-run seed verification
CC1.6 Setup-wizard resume support | CC1.7 Setup completion gate before go-live

## CC2. Domain & Email Infrastructure

CC2.1 app/marketing subdomain split | CC2.2 Short-link domain for invoices
CC2.3 mail. sending subdomain | CC2.4 Bounce subdomain
CC2.5 DNS record checklist | CC2.6 Auto DNS verification
CC2.7 Domain health monitor | CC2.8 Multi-domain TLS management

## CC3. Abuse & Fraud Prevention

CC3.1 Disposable-email block | CC3.2 Trial-abuse detection
CC3.3 One-time coupon policy | CC3.4 Referral-fraud guard
CC3.5 Phone verification (optional) | CC3.6 Seat-count accuracy check
CC3.7 Duplicate-account detection | CC3.8 IP-reputation check
CC3.9 Velocity-based signup throttle

## CC4. Collections & Dunning Depth

CC4.1 Tenant-timezone reminders (9am local) | CC4.2 Quiet hours
CC4.3 Business-day due date | CC4.4 Dunning-tier templates
CC4.5 Promise-to-pay date | CC4.6 Collection notes
CC4.7 Client risk flag | CC4.8 Statement PDF

## CC5. Industry Presets & Template Library

CC5.1 Industry selection at onboarding | CC5.2 Preset COA/tax/invoice template per industry
CC5.3 Terms-and-conditions library | CC5.4 Note templates
CC5.5 Email signature templates | CC5.6 Industry-specific sample data
CC5.7 Template versioning

## CC6. Fee Transparency (MoR)

CC6.1 Per-transaction fee breakdown | CC6.2 Monthly fee invoice to merchant
CC6.3 Payout schedule display | CC6.4 Hold-reason explanation
CC6.5 Wallet statement PDF | CC6.6 Fee-change notification

## CC7. Documentation & Governance

CC7.1 ERD diagram | CC7.2 Data dictionary
CC7.3 Architecture decision records (this folder) | CC7.4 Per-feature runbook
CC7.5 Browser support matrix

## CC8. Remaining UX

CC8.1 Full keyboard navigation in data tables | CC8.2 Timer offline persistence

## DD1. Analytics & Pixels

DD1.1 Google Analytics 4 | DD1.2 Google Tag Manager
DD1.3 Google Search Console verification | DD1.4 Meta Pixel
DD1.5 Conversions API (server-side) | DD1.6 TikTok/LinkedIn/X pixels
DD1.7 Microsoft Clarity/heatmap | DD1.8 Pixel loads only after cookie consent
DD1.9 All tracking IDs set from admin panel (no hardcoded code)
DD1.10 Pixel audit log | DD1.11 Consent-mode v2 support | DD1.12 Server-side tag manager hook

## DD2. SEO Depth

DD2.1 JSON-LD (Organization/Product/SoftwareApplication/FAQ/Breadcrumb/Article/Review)
DD2.2 Canonical URL | DD2.3 Dynamic OG image generator | DD2.4 Twitter Card
DD2.5 Dynamic sitemap (CMS+blog) | DD2.6 Robots control
DD2.7 Per-page meta editor (admin) | DD2.8 Slug management + 301 redirect
DD2.9 Broken-link report | DD2.10 Heading-structure audit
DD2.11 Mandatory image alt text | DD2.12 Core Web Vitals report
DD2.13 Google Business Profile link | DD2.14 Bing Webmaster verification

## DD3. Social Presence & Sharing

DD3.1 Footer/header social links (admin-editable) | DD3.2 Share buttons (FB/X/LinkedIn/WhatsApp/Telegram/copy-link)
DD3.3 Share-card preview | DD3.4 "Share your QR card" flow (SUPERSEDED with P3)
DD3.5 Invoice/estimate WhatsApp share | DD3.6 Referral share kit
DD3.7 Social proof widget | DD3.8 Open Graph per shared entity
DD3.9 Social link health check | DD3.10 Share analytics | DD3.11 QR-card social embed (SUPERSEDED with P3)

## DD4. Social Post Automation (future-ready scaffold)

DD4.1 Content calendar | DD4.2 Post composer (multi-platform)
DD4.3 Scheduler | DD4.4 Media library
DD4.5 Channel connection (OAuth token vault) | DD4.6 Platform adapters (Facebook Page/Instagram/LinkedIn/X/Threads/Telegram/Pinterest)
DD4.7 Per-post analytics | DD4.8 Auto-post rule (new blog -> all channels)
DD4.9 Re-post/evergreen queue | DD4.10 Approval flow
DD4.11 DB + UI schema ships now | DD4.12 Live API wiring deferred to Phase-2 by owner request
DD4.13 Draft/approved/published states | DD4.14 Channel error log | DD4.15 Post preview per platform

## DD5. Marketing Automation

DD5.1 Email campaign builder | DD5.2 Segment/list
DD5.3 Drip sequence | DD5.4 Landing-page builder (CMS blocks)
DD5.5 Popup/exit-intent | DD5.6 Lead scoring
DD5.7 Newsletter archive | DD5.8 UTM builder + report
DD5.9 Conversion funnel report | DD5.10 Campaign A/B subject test | DD5.11 Unsubscribe preference center

## DD6. Conversion Optimization

DD6.1 A/B test framework (homepage/pricing) | DD6.2 CTA variants
DD6.3 Trust badges | DD6.4 Live "recently signed up" proof
DD6.5 Review collection (Google Review request) | DD6.6 Testimonial manager
DD6.7 Pricing calculator | DD6.8 Chat/bot widget hook
DD6.9 Exit survey

## EE1. Reseller / White-Label

EE1.1 reseller role + dashboard | EE1.2 Own brand/logo/domain
EE1.3 Own pricing & margin | EE1.4 Sub-tenant creation & management
EE1.5 Reseller-based billing & commission | EE1.6 Own support inbox
EE1.7 Full platform-brand removal | EE1.8 Reseller approval flow
EE1.9 Revenue-share report | EE1.10 Sub-tenant data firewall (reseller sees billing-meta only, never invoices/clients)
EE1.11 Reseller plan catalog override | EE1.12 Reseller-level CMS override
EE1.13 Reseller support SLA | EE1.14 Reseller payout
EE1.15 Reseller onboarding wizard | EE1.16 Reseller audit log
EE1.17 Reseller API access | EE1.18 Reseller-tier entitlement matrix

## EE2. Accountant Access

EE2.1 accountant role (read + journal) | EE2.2 Single login across multiple companies
EE2.3 Company switcher | EE2.4 Owner invites/revokes accountant
EE2.5 Period-lock respected | EE2.6 Only accounting module visible
EE2.7 Accountant activity log | EE2.8 Tax-filing export
EE2.9 accountant_company_access join table | EE2.10 Accountant-scoped RLS
EE2.11 Accountant read-only enforcement outside accounting module

## EE3. Template Marketplace

EE3.1 Invoice design/email/document templates | EE3.2 Free and paid templates
EE3.3 Install/preview | EE3.4 Author profile
EE3.5 Rating | EE3.6 Revenue share | EE3.7 Admin moderation
EE3.8 Versioning | EE3.9 Template category | EE3.10 Template search
EE3.11 Template license terms | EE3.12 Template usage analytics

## EE4. Integration Ecosystem

EE4.1 Zapier app (trigger/action) | EE4.2 Make.com module
EE4.3 Chrome extension (quick invoice/timer) | EE4.4 OAuth app registration
EE4.5 Public app directory | EE4.6 Developer portal
EE4.7 Integration health dashboard | EE4.8 Sandbox app testing
EE4.9 App review/approval queue | EE4.10 App revenue share (if paid)

## EE5. Multi-Channel Messaging

EE5.1 SMS (Twilio-class adapter) | EE5.2 Telegram bot
EE5.3 Viber | EE5.4 Single channel-routing engine
EE5.5 Fallback chain (WhatsApp->SMS->Email) | EE5.6 Per-client channel preference
EE5.7 Channel cost tracking | EE5.8 Quiet hours
EE5.9 Channel delivery analytics | EE5.10 Channel opt-in management
EE5.11 Channel-level rate limit

## EE6. Bank Feed & Reconciliation

EE6.1 Bank aggregator adapter (Plaid/SaltEdge/CSV-class) | EE6.2 Auto transaction import
EE6.3 Smart matching (invoice<->payment) | EE6.4 Match suggestion
EE6.5 Bulk reconcile | EE6.6 Bank rule engine
EE6.7 Unmatched queue | EE6.8 Balance reconciliation
EE6.9 Multi-account bank feed | EE6.10 Reconciliation report
EE6.11 Bank-feed connection health | EE6.12 Manual transaction entry
EE6.13 Reconciliation audit trail

## EE7. Receipt OCR & Smart Entry

EE7.1 Receipt scan -> field extraction | EE7.2 Mobile camera capture
EE7.3 Vendor/date/VAT detection | EE7.4 Auto-category
EE7.5 Confidence score + manual correction | EE7.6 Duplicate-receipt detection
EE7.7 Bulk upload | EE7.8 OCR provider adapter interface
EE7.9 OCR accuracy feedback loop

## EE8. Contracts & E-Sign

EE8.1 Contract templates | EE8.2 Merge fields
EE8.3 Send & track | EE8.4 Legally-valid e-signature (audit trail + IP + timestamp)
EE8.5 Multiple signers | EE8.6 Signing order
EE8.7 Signed-PDF seal | EE8.8 Expiry/renewal reminder
EE8.9 Contract->invoice link | EE8.10 Contract template library
EE8.11 Contract status dashboard | EE8.12 Signature token link (reuses T1 token system, no new login)

## EE9. BNPL / Installment Financing

EE9.1 Partner adapter (Klarna/Afterpay-class) | EE9.2 Eligibility check
EE9.3 BNPL option at checkout | EE9.4 Installment schedule
EE9.5 Partner settlement | EE9.6 Risk/fee policy
EE9.7 BNPL dispute handling | EE9.8 BNPL reporting

## EE10. Loyalty & Review Automation

EE10.1 Post-payment review request | EE10.2 Google Review deep-link
EE10.3 Internal rating collection | EE10.4 Negative-feedback intercept
EE10.5 Testimonial publishing | EE10.6 Loyalty points/credit
EE10.7 Repeat-client reward | EE10.8 Review-request automation rule

---

See GAP-ADDITIONS-FF.md for items discovered in the latest deep-analysis pass
(new payment gateways, Google Drive storage wiring, e-commerce direct checkout,
bot/AI protection, and corrections to earlier drafts).

# docs/planning/ARCHITECTURE-DECISIONS.md

# Locked Architecture Decisions -- read before writing any code

Status legend: LOCKED = do not re-litigate unless the project owner changes it.

## 1. Identity / Brand

- LOCKED: Product name "KD SOLUTION IT", internal codename "PayProject".
- LOCKED: Tagline "Smart Billing for Modern Business". Primary color family
  #1d4ed8 (blue), clean white surfaces, fintech-polished look.
- LOCKED: support@kdsolutionit.com is the single support/sender address shown
  everywhere (footer, emails, contact page).
- Reference only (NOT a template to copy): https://kdsolutionit.netlify.app/
  Use for tone/messaging inspiration only. Every page in the real product must
  be a unique, original layout -- no two pages share the same template
  skeleton, per design-uniqueness rule (see FF section in GAP-ADDITIONS-FF.md).

## 2. Roles (6 account roles + 1 account-less role) -- LOCKED

| Role                | Who                                  | Notes                                                                                                                              |
| ------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| super_admin         | Platform owner (you)                 | Full platform control, all tenants, MoR, KYC, CMS                                                                                  |
| reseller            | White-label partner                  | Manages own sub-tenants, own branding/pricing, cannot see sub-tenant invoice/client data                                           |
| owner               | A business/freelancer who subscribes | Full control of own company only, fully isolated from other owners                                                                 |
| staff               | Employee invited by an owner         | Permission-scoped by owner; cannot send client emails (draft/request-send only)                                                    |
| accountant          | Bookkeeper invited by an owner       | Read + journal access, can be linked to multiple companies via `accountant_company_access` join table, still respects period locks |
| affiliate           | Referral partner                     | BLIND role -- sees only own clicks/signups/commission/payout, never sees referred company data                                     |
| client (no account) | End customer of an owner             | Never logs in; accesses invoices/estimates only via a signed, expiring token link                                                  |

Tenant isolation is strict: one `owner` must never see another `owner`'s data.
Every table/query is scoped by `company_id`; RLS default-deny.

## 3. Client access model -- LOCKED

- No client accounts, no client passwords, no separate client login.
- Every invoice/estimate email contains a unique signed token link
  (HMAC-based, 128-bit, not enumerable).
- Default: link opens the document directly (no OTP) -- lowest friction, pay
  fastest. Optional per-owner Settings toggle: "Require email OTP to view
  invoice" (default OFF). Both code paths must be fully implemented.
- Only the `owner` can send invoice/estimate emails. `staff` can only prepare
  a draft and use "Request send" for owner approval -- the Send button is
  hidden for staff.
- Batch/bulk sending is supported (multi-select invoices -> queued batch
  send) with a dashboard summary: total sent, paid, unpaid, overdue, viewed,
  failed, collection rate %, average time-to-pay.

## 4. Payment gateways -- LOCKED (pluggable framework)

Named gateways to ship: Stripe, PayPal, Paddle, NMI, 2Checkout (Verifone),
Adyen for Platforms, Nium (cross-border payout rail), plus a generic
JSON-config-driven "Custom Gateway" slot so the super_admin can add any future
gateway without a code change. Local payment rails (e.g. bKash/Nagad-class
methods) are included as payment AND payout options, each with:

- a global super_admin on/off switch, and
- a per-tenant on/off switch.
  Gateway names/provider names must NEVER be hard-printed on any public-facing
  page/UI copy as a specific brand when the project owner wants to keep them
  generic -- use labels such as "Global Payout Partners" / "Local Payment
  Methods via Licensed Partners" in UI copy; the actual provider identifiers
  live only in config/admin settings, never in marketing copy.
  Card payments have their own dedicated on/off toggle (separate from the
  gateway enable/disable toggle), global (super_admin) and per-company.

## 5. 3-D Secure (3DS) -- CORRECTED/LOCKED

Earlier draft lists (P8 item "3DS OTP processing") implied a mandatory 3DS
OTP step. This is SUPERSEDED. Final decision: 3DS is an OPTIONAL TOGGLE,
default OFF, available at:

- global level (super_admin switch), and
- per-company override.
  Because 3DS stays off by default, chargeback liability is mitigated instead
  via the Consent & Evidence system (see FEATURE-REGISTRY.md section V) which
  captures unforgeable proof of consent, delivery/acceptance, and a one-click
  dispute evidence pack -- this is the primary anti-chargeback strategy, not 3DS.

## 6. Merchant of Record (MoR) / KYC gating -- LOCKED

- Default: every owner must use their OWN payment gateway keys.
- Once KYC is verified (manual review by super_admin, no OCR), the owner may
  opt in to use the platform's MoR gateway, subject to terms acceptance and
  super-admin-configurable per-account conditions (fee %, min fee, hold
  days, payout SLA hours, minimum withdrawal). Platform default: 0.5% + a
  minimum fee, configurable per account down to e.g. 0.3%.
- Funds collected via MoR sit in a virtual wallet, held for a configurable
  period, then are released and payable via payout request (target SLA: 24
  hours), subject to super-admin override per account.
- Platform fee is separate from, and in addition to, whatever fee the
  underlying gateway itself charges.

## 7. File storage -- LOCKED (changed from the original "Supabase Storage"

plan in the earlier InvoicerSaaS spec)

- Supabase Postgres stores ONLY text/metadata (no binary blobs).
- All uploaded files (logos, KYC front/back, receipts, attachments, PDFs,
  generated document assets, contract documents, etc.) are stored in Google Drive, not
  Supabase Storage.
- Architecture: a pluggable `StorageProvider` interface in `src/lib/storage/`
  with a Google Drive adapter as the DEFAULT implementation (service-account
  based Drive API access), so a future swap to Supabase Storage/S3/R2 needs
  only a new adapter, not a rewrite.
- Each company gets its own Drive folder (auto-created on company creation).
  Supabase only stores the Drive `file_id` / `webViewLink` / mime/size
  metadata.
- Required server-only env vars (never NEXT*PUBLIC*): GOOGLE_DRIVE_CLIENT_EMAIL,
  GOOGLE_DRIVE_PRIVATE_KEY, GOOGLE_DRIVE_ROOT_FOLDER_ID.
- Signed/expiring share links are generated per request for private files
  (KYC docs, invoices) instead of making files public. The Phase 21 Google
  Drive adapter uses an HMAC application URL and streams the file through a
  server-only route after verifying the signature and company ownership;
  Google Drive service-account credentials are never sent to the browser.
- A server-only `storage_provider_folders` mapping keeps one validated Drive
  folder per company/provider. The mapping has forced default-deny RLS and
  browser-role privileges revoked; only the trusted server client may manage
  it. Drive file `appProperties` retain the company and category metadata
  needed for ownership checks before delete or download.

## 8. E-commerce direct payment collection -- LOCKED (new this pass)

Beyond "Shopify/WooCommerce order creates an auto-invoice" (already planned),
the platform also ships a direct checkout integration so a Shopify or
WooCommerce store can collect payments AT CHECKOUT using the merchant's
KD SOLUTION IT-issued API key:

- A WooCommerce payment-gateway plugin (PHP) that registers as a checkout
  payment method and calls the platform's hosted-checkout/payment API.
- A Shopify payment app/integration using the platform's checkout API
  (via Shopify's app/payment extension points available without a private
  banking license -- implemented as a redirect/hosted-checkout bridge).
- A small embeddable Checkout JS SDK usable on any custom site.
- A public merchant-onboarding flow/page describing the 4 steps: Register ->
  (manual) KYC verification -> Integrate (API key or ready-made checkout
  link) -> Go live and accept payments worldwide.
- Merchant-specific publishable + secret API key pairs, manageable from
  Settings, with install guides.

## 9. Security posture -- LOCKED (summary; full detail in FEATURE-REGISTRY.md

sections P, Y1-Y5, AA1-AA2, FF)

- PCI SAQ-A scope only: card data never touches our servers (hosted
  fields/redirect only).
- AES-256 for all secrets at rest (gateway keys, SMTP passwords, webhook
  secrets); ENCRYPTION_KEY itself is NEVER rotated.
- RLS on every table, default-deny, company_id + deleted_at IS NULL on every
  query except super_admin.
- Full bot/AI-scraping/hacking defense layer (new this pass, see
  GAP-ADDITIONS-FF.md): AI-crawler blocking in robots.txt, bot-detection
  middleware, honeypot fields, Cloudflare Turnstile on sensitive routes,
  anti-scraping rate limits, brute-force lockout, suspicious-login alerts.
- Dispute defense target: automatic, unforgeable evidence collection on
  every payment (consent checkbox + timestamp + IP + device fingerprint +
  delivery/acceptance proof + full audit timeline + one-click evidence pack)
  so that disputes are rare and, when they happen, are won.

## 10. Language -- LOCKED

- All UI, code, comments, DB seed content, error messages: English only.
  Zero Bengali anywhere in the codebase (enforced by a lint/grep guard).
- Chat replies to the project owner remain in Bengali; this does not apply
  to any file in the repository.

## 11. Hosting -- LOCKED

- Primary deploy target: Netlify (serverless function limits respected: use
  background functions for long jobs, Supabase pg_cron/Edge Functions for
  scheduled work).
- Same codebase must also run on Vercel and via Docker on any VPS, with only
  config differences.

## 12. Deferred-but-reserved modules (DB schema + folder stubs exist from day

    one; UI/live wiring comes later when the owner requests it)

- Social-post automation live publishing (scheduler skeleton ships now,
  OAuth channel connections come later).
- AI assistant hooks (invoice summarization, auto-categorize expense) --
  interface stub only.
- Native mobile app (PWA now, native wrapper later).
- Full i18n (English-only UI now, translation-key structure reserved).

# docs/planning/GAP-ADDITIONS-FF.md

# Section FF -- Gap-Analysis Additions & Corrections (latest deep-analysis pass)

These were missing from, or inconsistent in, the prior consolidated list.
All are IN SCOPE and now part of the registry. Nothing previously listed was
removed; FF.9 and FF.46 below are explicit CORRECTIONS to earlier items
(marked SUPERSEDED in the original, not deleted).

## FF1. New Payment Gateways & E-commerce Direct Checkout

FF1.1 Adyen for Platforms gateway integration
FF1.2 Nium gateway/payout-rail integration (cross-border payout)
FF1.3 2Checkout (Verifone) gateway integration
FF1.4 Public-facing payment-method generic naming policy -- never print a
specific provider's brand name in marketing/checkout UI copy when the
owner wants it hidden; use "Global Payout Partners" / "Local Payment
Methods via Licensed Partners" style labels; actual provider IDs stay
in config/admin settings only
FF1.5 Dedicated card-payment channel on/off toggle (separate from the
per-gateway enable/disable toggle), global + per-company
FF1.6 E-commerce merchant onboarding landing page: 4-step visual
(Register -> KYC (manual) -> Integrate -> Go Live)
FF1.7 Shopify payment integration/app using the platform's checkout API so a
Shopify store can collect payments directly with the merchant's
platform-issued API key
FF1.8 WooCommerce payment-gateway plugin (PHP) registering as a checkout
payment method, calling the platform's hosted-checkout/payment API
FF1.9 Embeddable Checkout JS SDK for any custom website
FF1.10 Merchant-specific publishable + secret API key pair provisioning
FF1.11 Plugin/SDK installation guide + one-click config string/snippet
FF1.12 Per-merchant webhook endpoint for Shopify/WooCommerce payment status
FF1.13 Settlement reconciliation between e-commerce order and platform payment record
FF1.14 Sandbox/test mode for the Shopify/WooCommerce payment integration
FF1.15 Plugin version compatibility matrix (Shopify API version, WooCommerce version)
FF1.16 Plugin uninstall/cleanup flow
FF1.17 Direct-checkout analytics (conversion rate per store)

## FF2. Google Drive File Storage Architecture

FF2.1 Google Drive chosen as the DEFAULT file-storage backend; Supabase
Postgres holds text/metadata only, never binary file content
FF2.2 `StorageProvider` adapter interface in `src/lib/storage/` -- Drive is
the first adapter, Supabase Storage/S3/R2 can be added later without
touching call sites
FF2.3 Google service-account based Drive API connection, configured from
Super Admin > Settings > Storage
FF2.4 Per-company Drive folder auto-created on company creation
(`/{root}/{company_id}/...`)
FF2.5 Upload flow: browser -> server action -> Drive API -> Supabase stores
{provider: 'google_drive', file_id, web_view_link, mime_type, size_bytes}
FF2.6 Signed/expiring share-link generation per request for private files
(KYC docs, invoice PDFs, receipts, attachments, contracts)
FF2.7 Drive-quota/error fallback handling (retry, alert super_admin, never
silently lose an upload)
FF2.8 Env vars (server-only): GOOGLE_DRIVE_CLIENT_EMAIL,
GOOGLE_DRIVE_PRIVATE_KEY, GOOGLE_DRIVE_ROOT_FOLDER_ID

## FF3. AI / Bot Scraping & Hacking Prevention

FF3.1 robots.txt disallow rules for known AI crawlers (GPTBot, CCBot,
ClaudeBot, Google-Extended, Bytespider, etc.) on top of normal SEO rules
FF3.2 Bot-detection middleware (user-agent + behavioral heuristics)
FF3.3 Headless-browser/automation signature detection (Playwright/Selenium/
Puppeteer fingerprints) on sensitive routes
FF3.4 Honeypot fields on public forms (signup, contact, login)
FF3.5 Cloudflare Turnstile (or equivalent) challenge on login, signup,
password reset, payment, and contact-form routes
FF3.6 Anti-scraping rate limits keyed on request pattern, not just IP
FF3.7 Content-scraping guard on pricing/CMS pages (sensitive data rendered
in a way that resists trivial bulk extraction, without harming SEO
crawlers that must still index the content)
FF3.8 WAF-style edge rule documentation for Netlify/Cloudflare front door
FF3.9 Automated account-creation bot prevention (captcha + email-domain
reputation check at signup) -- cross-references Y3.11/CC3
FF3.10 Security monitoring dashboard: bot-block count, challenge pass/fail
rate, anomaly trend (part of N. Super Admin / R8 expansion)
FF3.11 OWASP Top 10 self-audit checklist, re-run every phase (ties into Y12
Delivery Quality Gate)
FF3.12 Vulnerability-disclosure / security-contact policy page (links with
S10.7 security.txt)

## FF4. Payment High-Security Extras

FF4.1 3DS is a TOGGLE, default OFF -- CORRECTION to the old P8 item "3DS OTP
processing" which implied a mandatory step; see
ARCHITECTURE-DECISIONS.md section 5. Global (super_admin) switch AND
per-company override, both must exist in the UI and be enforced
server-side regardless of UI state
FF4.2 AVS (Address Verification System) check where the gateway supports it
FF4.3 CVV verification required policy
FF4.4 Card-payment on/off toggle (duplicate cross-reference to FF1.5 -- kept
here too since it is a security control, not just a UX control)
FF4.5 Per-transaction risk score displayed to owner before/after capture
FF4.6 High-risk transaction manual-hold queue for super_admin review

## FF5. Design Uniqueness & Cross-Session Continuity Governance

FF5.1 Every public and app page must use a distinct layout composition --
no two pages share an identical template skeleton; enforced via design
review checklist in Y12 Delivery Quality Gate
FF5.2 Design inspiration reference recorded: kdsolutionit.netlify.app (tone
and messaging only, never a visual template to copy)
FF5.3 `docs/planning/` is the mandatory first read for any future chat
session before any code change (see README.md)
FF5.4 PROGRESS-TRACKER.md must be updated at the end of every phase (status,
date, files touched, features completed) so a brand-new session can
resume with zero ambiguity
FF5.5 FEATURE-REGISTRY.md status column is the single source of truth for
"what's left" -- never trust chat history for this
FF5.6 Any new feature request from the owner in any future session gets
appended to FEATURE-REGISTRY.md (new section letter if it doesn't fit
an existing one) before being scheduled into PHASE-PLAN.md

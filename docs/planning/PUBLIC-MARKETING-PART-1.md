# Public marketing pages part 1

Phase 44 adds the first public marketing surface with distinct route compositions:

- `/`: product homepage with a dashboard-inspired hero, connected-workspace feature cards, role-aware clarity messaging, and a focused CTA.
- `/features`: six product capability sections covering invoicing, payments, teams, reporting, multi-currency/channels, and trust boundaries.
- `/pricing`: Free-preselected plan preview with configurable-plan messaging rather than hard-coded live prices.
- `/testimonials`: customer-story positioning built around workflow outcomes without exposing tenant data.
- `/faq`: accessible accordion FAQ teaser covering plans, client access, roles, card fees, storage, and ecommerce.
- `/merchant-onboarding`: four-step merchant path from registration through manual KYC, integration, and go-live.

`PublicSiteFrame` provides the public header/footer, support address, accessible navigation, and consistent brand treatment. The routes are intentionally independent from authenticated tenant layout and do not expose provider credentials, client records, or private dashboard data. The merchant page describes platform boundaries without guessing any external provider request shape.

The public site keeps the QR business-card module out of scope. Invoice QR links remain a later authenticated/document feature. Live plan pricing and entitlements remain server/database configuration, not frontend constants.

Run `npm run verify:phase44` for the deterministic route-content smoke test.

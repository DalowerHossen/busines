# Public pages part 2

Phase 45 completes the second public-site batch with distinct page compositions and public route coverage:

- `/about`: mission, operating principles, and product point of view.
- `/contact`: support, workspace, and security contact paths with safe handling guidance.
- `/guides`: a practical billing-operations guide covering context, records, and repeatable work.
- `/terms`: versioned service terms and workspace responsibilities.
- `/privacy`: privacy principles, user choices, retention boundaries, and privacy contact.
- `/refund`: transaction-aware refund guidance and support paths.
- `/security`: security principles and responsible-disclosure contact.
- `/dpa`: data-processing boundary and operational commitments.
- `/accessibility`: keyboard, focus, touch-target, reduced-motion, and reporting guidance.
- `/blog`: editorial journal preview with CMS handoff language.
- `/status`: public service-status surface with operational service rows.
- `/api-docs`: provider-neutral API and webhook contract preview.

The batch also adds root-level OpenGraph/Twitter metadata defaults, the App Router favicon, a branded not-found page, and a generated public sitemap. The public frame now links to the new legal, learning, status, and developer surfaces.

Page copy is English-only and avoids external-provider request shapes. API content describes platform-owned boundaries rather than claiming unimplemented live endpoints. Legal content is a product baseline and should be reviewed for the applicable business jurisdictions before production reliance.

The public content is intentionally static at this stage. CMS editing, blog scheduling, status incident management, contact-ticket submission, live API routes, and server-owned data remain later authenticated/admin delivery work.

Run `npm run verify:phase45` for deterministic page-content smoke coverage.

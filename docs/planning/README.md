# docs/planning/README.md

# KD SOLUTION IT (PayProject) -- Planning & Continuity Index

PURPOSE: This folder is the single source of truth for project scope, decisions,
and delivery plan. Any new chat session (with no memory of prior conversation)
MUST read these files, in this order, before writing or changing any code:

1. ARCHITECTURE-DECISIONS.md -- locked decisions (roles, storage, gateways, security model)
2. FEATURE-REGISTRY.md -- full feature list, grouped, English only, status column
3. GAP-ADDITIONS-FF.md -- features/corrections found in the latest deep-analysis pass
4. PHASE-PLAN.md -- how the 1380+ features map to delivery phases
5. PROGRESS-TRACKER.md -- which phases are done, in progress, or not started

RULES FOR ANY FUTURE SESSION:

- Do not start writing code until the project owner explicitly says "start" /
  "shuru koro" for a specific phase number.
- Before writing a phase, re-read PROGRESS-TRACKER.md to find the next
  "Not Started" phase, and re-read the matching section of PHASE-PLAN.md.
- After finishing a phase, update PROGRESS-TRACKER.md (status + date + file
  count) and update FEATURE-REGISTRY.md status column for the features that
  phase covered (Pending -> Done).
- Never remove a feature from FEATURE-REGISTRY.md. If a feature changes, mark
  it "SUPERSEDED" and link to the replacement row -- never delete history.
- Every code file: full path comment at top, zero placeholders, zero `any`,
  zero Bengali text/comments/labels, English only everywhere in the codebase.
- Multi-tenant: every query scoped by company_id + deleted_at IS NULL (soft
  delete), except super_admin queries.
- One commit per file. Phases are a planning/delivery unit, not a git branch
  rule -- everything still goes to branch `arena/01a10194-busines` only, and
  nothing is pushed to GitHub until the project owner explicitly says so.

PROJECT ONE-LINE SUMMARY:
Multi-tenant SaaS invoicing, billing, subscription and payment-aggregation
platform ("KD SOLUTION IT") for freelancers and e-commerce businesses across
Asia, acting as an optional Merchant of Record with KYC-gated wallet, hold,
and payout, plus WhatsApp/QR/e-commerce/accounting/inventory modules, built
on Next.js + Supabase + Tailwind, deployed on Netlify.

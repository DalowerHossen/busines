<!-- .github/PULL_REQUEST_TEMPLATE.md -->

## Summary

What does this pull request change and why?

## Related issue or phase

Link the issue, or the phase number from `docs/planning/PROGRESS-TRACKER.md`.

## Checklist

- [ ] Every new file starts with a full path comment.
- [ ] No `any` type was introduced (zero `any` policy).
- [ ] No placeholder content (`TODO`, `lorem ipsum`, fake data) was committed.
- [ ] No Bengali or any non-English text exists in code, comments, or UI
      strings (`npm run check:language` passes).
- [ ] Every database query is scoped by `company_id` and excludes
      `deleted_at IS NULL` rows where applicable.
- [ ] Every new `'use client'` component has loading, error, empty, and
      success states and is responsive from 320px to 1920px.
- [ ] Every new Server Action uses `'use server'`, validates input with Zod,
      wraps logic in try/catch, and returns `{ success, data?, error? }`.
- [ ] `npm run verify` passes locally.
- [ ] `npm run build` passes locally.
- [ ] No secrets, API keys, or real customer data are included in this diff.

## Screenshots (UI changes only)

Attach before/after screenshots at mobile (375px), tablet (768px), and
desktop (1440px) widths.

## Deployment notes

Any new environment variables, migrations, or manual steps required before
this change can go live.

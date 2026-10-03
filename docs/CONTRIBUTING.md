<!-- docs/CONTRIBUTING.md -->

# Contributing

KD SOLUTION IT follows a strict, phase-by-phase delivery process documented
in `docs/planning/`. Read `docs/planning/README.md` before making changes.

## Workflow

1. Confirm which phase (`docs/planning/PHASE-PLAN.md`) the work belongs to
   and that it has been explicitly authorized.
2. Make changes in small, reviewable commits - one logical file or concern
   per commit.
3. Run `npm run verify` locally before pushing (the `pre-push` hook also
   enforces this).
4. Open a pull request using the template in
   `.github/PULL_REQUEST_TEMPLATE.md` and let CI (`.github/workflows/ci.yml`)
   go green before requesting review.

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/),
enforced by `.husky/commit-msg` and `commitlint.config.mjs`. Allowed types:
`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
`chore`, `revert`, `security`.

Examples:

```
feat: add tokenised client invoice link generation
fix: correct platform fee rounding on partial refunds
docs: add Docker deployment guide
```

## Code standards

- Every file starts with a comment stating its full path from the
  repository root.
- Zero `any` types, zero placeholders (`TODO`, `FIXME`, "coming soon",
  lorem ipsum), zero non-English text anywhere in code or comments. All
  three are enforced automatically by `npm run verify`.
- File names: kebab-case. React components: PascalCase. Functions and
  variables: camelCase.
- Every `'use client'` component implements loading, error, empty, and
  success states, and is responsive from 320px to 1920px with touch targets
  of at least 44px.
- Every Server Action: `'use server'` directive, Zod validation of all
  input, a `try/catch` block, and a return type of
  `{ success: true, data } | { success: false, error }`.
- Every database query is scoped by `company_id` and filters out
  soft-deleted rows (`deleted_at IS NULL`).
- No feature from `docs/planning/FEATURE-REGISTRY.md` or
  `docs/planning/GAP-ADDITIONS-FF.md` may be silently dropped. If a feature
  needs to change scope, record the decision in
  `docs/planning/ARCHITECTURE-DECISIONS.md` first.

## Design standard

Every page has a visually distinct layout; no two pages share an identical
template structure (see `docs/planning/GAP-ADDITIONS-FF.md` FF5). The
reference site at kdsolutionit.netlify.app informs tone and messaging only,
never a layout to copy directly.

## Reporting bugs or proposing features

Use the issue templates under `.github/ISSUE_TEMPLATE/`. For security
vulnerabilities, follow `.github/SECURITY.md` instead of opening a public
issue.

<!-- docs/CHANGELOG.md -->

# Changelog

All notable changes to KD SOLUTION IT are documented in this file. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versioning follows [Semantic Versioning](https://semver.org/) once the
first release ships. Entries are grouped by phase while the project is in
initial development; see `docs/planning/PROGRESS-TRACKER.md` for the live,
authoritative phase status.

## [Unreleased]

### Added

- Root project configuration: TypeScript, ESLint, Prettier, Tailwind,
  EditorConfig, and strict engine pinning.
- Environment variable reference (`.env.example`) covering authentication,
  email, payment gateways (Stripe, PayPal, Paddle, NMI, 2Checkout, Adyen for
  Platforms, Nium, and two configurable local rails), Google Drive file
  storage, messaging channels, bot protection, and e-commerce integrations.
- Quality gate scripts: English-only language check and placeholder/
  unfinished-work check, wired into `npm run verify`.
- Deployment configuration for Netlify (`netlify.toml`) and Vercel
  (`vercel.json`), including security headers and tokenised-link
  `no-referrer`/`noindex` protection on `/i/*` and `/pay/*`.
- Continuous integration (`.github/workflows/ci.yml`), dependency and secret
  scanning (`.github/workflows/security-scan.yml`,
  `.github/dependabot.yml`), scheduled backup verification
  (`.github/workflows/database-backup.yml`), and a Netlify deploy workflow.
- Git hooks via Husky: pre-commit lint-staged, commit-msg Conventional
  Commits enforcement, pre-push full verification.
- Docker scaffold: development and production Dockerfiles, development and
  production Compose stacks, Nginx reverse-proxy configuration with TLS and
  rate limiting, backup/restore/migration/entrypoint/healthcheck scripts.
- Project planning documentation (`docs/planning/`): architecture decisions,
  the full feature registry, gap additions, phase plan, and progress
  tracker, written so any new working session can resume without prior
  conversation history.
- Project documentation (`docs/`): setup guide, environment variable
  reference, deployment guides for Netlify/Vercel/Docker/VPS, security
  practices, contributing guide, and this changelog.

### Notes

This is an initial-development changelog. Entries will be reorganized under
proper semantic version numbers starting with the first production release.

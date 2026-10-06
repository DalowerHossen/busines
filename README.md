# KD SOLUTION IT

**Smart Billing for Modern Business**

A multi-tenant invoicing, billing and subscription platform. Business owners manage their
clients, invoices, estimates, payments, inventory and accounting in one place, while their
customers receive secure document links by email and pay online without creating an account.

---

## Platform overview

| Area           | Summary                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------- |
| Framework      | Next.js 14 App Router, TypeScript in strict mode                                               |
| Styling        | Tailwind CSS with a custom KD SOLUTION IT design system                                        |
| Database       | Supabase PostgreSQL with Row Level Security on every table                                     |
| Authentication | Supabase Auth, email and password, Google and GitHub, two factor                               |
| Email          | Resend, every message sent from support@kdsolutionit.com                                       |
| Payments       | Stripe, PayPal, Paddle, NMI, 2Checkout, Adyen for Platforms, Nium, local rails, manual, custom |
| Storage        | Pluggable adapter: Google Drive (default), Supabase Storage, R2, S3, B2, local                 |
| Hosting        | Netlify, Vercel, Docker or any Node host from the same codebase                                |

### Account roles

| Role          | Scope                                               |
| ------------- | --------------------------------------------------- |
| `super_admin` | Full platform control across every tenant           |
| `reseller`    | White label partner managing their own sub tenants  |
| `owner`       | Business owner, full control of a single company    |
| `staff`       | Employee with granular permissions set by the owner |
| `accountant`  | Read and bookkeeping access to approved companies   |
| `affiliate`   | Referral dashboard only, no access to business data |

Clients of a business do not have an account. They receive signed, expiring links by email to
view documents and pay online.

---

## Requirements

- Node.js 20.11 or newer (see `.nvmrc`)
- npm 10 or newer
- A Supabase project

---

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Create your local environment file
cp .env.example .env.local

# 3. Fill in the required values in .env.local
#    - NEXT_PUBLIC_SUPABASE_URL
#    - NEXT_PUBLIC_SUPABASE_ANON_KEY
#    - SUPABASE_SERVICE_ROLE_KEY
#    - ENCRYPTION_KEY, LINK_SIGNING_SECRET, CSRF_SECRET, CRON_SECRET

# 4. Start the development server
npm run dev
```

The application runs at `http://localhost:3000`.

### Generating secrets

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Run the command once for each of `ENCRYPTION_KEY`, `LINK_SIGNING_SECRET`, `CSRF_SECRET` and
`CRON_SECRET`. `ENCRYPTION_KEY` must never be rotated, because every stored secret is encrypted
with it.

---

## Configuration model

Only three groups of values live in environment variables:

1. **Supabase connection** - required to reach the database.
2. **Cryptographic secrets** - required before any encrypted value can be read.
3. **Application URLs** - required before the first request is served.

Everything else, including email credentials, payment gateway keys, storage providers,
messaging channels, analytics identifiers and e-commerce connections, is configured at runtime
from the super admin panel. Values are encrypted with AES-256 in the database and take effect
within seconds, with no rebuild and no redeploy.

Resolution order: **database value, then environment variable, then built in default.**

---

## Scripts

| Command                      | Purpose                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run dev`                | Start the development server                                                                     |
| `npm run build`              | Create a production build                                                                        |
| `npm run start`              | Serve the production build                                                                       |
| `npm run lint`               | Run ESLint with zero tolerance for warnings                                                      |
| `npm run typecheck`          | Run the TypeScript compiler without emitting output                                              |
| `npm run format`             | Format the codebase with Prettier                                                                |
| `npm run format:check`       | Verify formatting without writing changes                                                        |
| `npm run check:language`     | Fail if any non English text exists in the codebase                                              |
| `npm run check:placeholders` | Fail if any unfinished work marker exists                                                        |
| `npm run check:schema`       | Fail on duplicate migrations, tables without RLS or queries against a table no migration creates |
| `npm run test`               | Run the Vitest unit suite                                                                        |
| `npm run verify`             | Run every quality gate in sequence                                                               |

---

## Engineering rules

1. Every file begins with a comment containing its full path.
2. No placeholders, no unfinished markers, no truncated code.
3. The `any` type is never used. Unknown values are narrowed explicitly.
4. Files use kebab-case, components use PascalCase, functions use camelCase.
5. Every client component handles loading, error, empty and success states.
6. Every server action validates input with Zod and returns a standard result object.
7. Every API route authenticates the caller and returns correct HTTP status codes.
8. Every database query is scoped by tenant and excludes soft deleted rows.
9. Every form validates on both the client and the server.
10. Secrets never use the `NEXT_PUBLIC_` prefix.
11. The interface is responsive from 320px to 1920px, with touch targets of at least 44px.
12. All code, comments, labels and messages are written in English.

---

## Project planning and continuity

Full scope, locked architecture decisions and the phase-by-phase delivery
plan live in `docs/planning/`. Read `docs/planning/README.md` first in any
new working session before changing code.

## Deployment

The same codebase deploys to Netlify (`netlify.toml`), Vercel (`vercel.json`) and Docker.
Build command: `npm run build`. Output directory: `.next`.

The build only needs the public `NEXT_PUBLIC_*` values; server secrets are
validated on first use at runtime, not while building, so no production
credential has to be present on the build machine.

### Scheduled work

Four endpoints under `/api/cron/` do the recurring work: `dispatch-messages`,
`deliver-webhooks`, `read-receipts` and `release-funds`. Each one requires
the `CRON_SECRET` bearer token, so they can also be triggered by hand during
an incident. Every host needs its own scheduler:

| Host    | Mechanism                                                       |
| ------- | --------------------------------------------------------------- |
| Netlify | Scheduled functions in `netlify/functions/scheduled-*.mts`      |
| Vercel  | The `crons` array in `vercel.json`                              |
| Docker  | A system cron or timer that calls the endpoints with the secret |

---

## Support

support@kdsolutionit.com

---

&copy; KD SOLUTION IT. All rights reserved.

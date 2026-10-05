<!-- docs/SETUP.md -->

# Local setup

This guide gets KD SOLUTION IT running on your machine for development.

## Prerequisites

- Node.js version pinned in `.nvmrc` (currently `20.18.0`). Any version
  satisfying the `engines.node` range in `package.json` works.
- npm 10 or later.
- A Supabase project (free tier is enough for development). Supabase stores
  text and relational data only; see "File storage" below for uploads.
- A Google Cloud service account with Drive API access, for file storage.
- Git.

## 1. Clone and install

```bash
git clone <repository-url>
cd busines
npm install
```

Installing dependencies also runs `npm run prepare`, which installs the
Husky git hooks (`pre-commit`, `commit-msg`, `pre-push`). These hooks keep
the language policy, placeholder policy, types, lint, and formatting green
before code is committed or pushed.

## 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in every value you need for the features you are working on. See
`docs/ENVIRONMENT-VARIABLES.md` for a full reference of every variable, which
ones are public (`NEXT_PUBLIC_*`), and which must stay server-only.

At minimum for the app to boot, set:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY` (generate once, never rotate - rotating it makes every
  previously encrypted secret unreadable)

## 3. File storage (Google Drive)

Google Drive is the default and recommended storage provider for every
uploaded file (logos, KYC documents, receipts, generated PDFs). Supabase
Postgres stores only the resulting file id, link, and metadata.

1. Create a Google Cloud project and a service account.
2. Enable the Google Drive API for that project.
3. Create a root folder in Google Drive and share it with the service
   account's email address (Editor access).
4. Set `GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY`, and
   `GOOGLE_DRIVE_ROOT_FOLDER_ID` in `.env`.

The platform automatically creates one sub-folder per company inside the
root folder the first time that company uploads a file.

## 4. Database

Database migrations live in `supabase/migrations` (added starting with the
database phase of `docs/planning/PHASE-PLAN.md`). Once they exist, apply
them with the Supabase CLI:

```bash
npx supabase db push --db-url "$SUPABASE_DB_URL"
```

## 5. Run the app

```bash
npm run dev
```

The app serves on `http://localhost:3000` by default, bound to `0.0.0.0` so
it also works inside containers and remote sandboxes.

## 6. Verify before committing

```bash
npm run verify
```

This runs, in order: the English-only language check, the placeholder
check, TypeScript type checking, ESLint, and a Prettier format check. The
`pre-push` git hook runs the same command automatically.

## Next steps

- Read `docs/planning/README.md` for the full project scope and the current
  phase status before writing new code.
- See `docs/DEPLOYMENT-NETLIFY.md`, `docs/DEPLOYMENT-VERCEL.md`,
  `docs/DEPLOYMENT-DOCKER.md`, or `docs/DEPLOYMENT-VPS.md` to deploy.

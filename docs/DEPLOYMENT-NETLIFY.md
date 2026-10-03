<!-- docs/DEPLOYMENT-NETLIFY.md -->

# Deploying to Netlify

Netlify is the primary deployment target for KD SOLUTION IT. The
repository's `netlify.toml` already configures the build command, the
Next.js plugin, and the security headers required by
`docs/planning/ARCHITECTURE-DECISIONS.md`.

## 1. Create the site

1. In the Netlify dashboard, choose "Add new site" > "Import an existing
   project" and connect this repository.
2. Netlify auto-detects `netlify.toml`. Leave the build command
   (`npm run build`) and publish directory (`.next`) as configured.
3. Confirm the `@netlify/plugin-nextjs` plugin is enabled (it is declared in
   `netlify.toml`, Netlify installs it automatically).

## 2. Set environment variables

In Site configuration > Environment variables, add every variable your
deployment needs from `.env.example`. At minimum:

- `NEXT_PUBLIC_APP_URL` (your Netlify domain or custom domain)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY`
- `RESEND_API_KEY` and the sender addresses
- Storage: `GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY`,
  `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- Any payment gateway credentials you are enabling

Set these for the "Production" context at minimum; add "Deploy previews"
values too if you want preview deploys to be functional (use test/sandbox
gateway credentials there, never live ones).

## 3. Deploy

Push to the branch Netlify is watching (typically `main`). Netlify builds
with `npm run build` and deploys automatically. `.github/workflows/ci.yml`
also runs independently on every push so a failing verification or build
step is visible before Netlify finishes.

## 4. Tokenised link and preview protection

`netlify.toml` already sets `Referrer-Policy: no-referrer` and
`X-Robots-Tag: noindex, nofollow, noarchive` on `/i/*` and `/pay/*`. Deploy
previews and branch deploys build with the same configuration, so they stay
unindexed as well. Do not weaken these headers.

## 5. Custom domain and HTTPS

Add your custom domain under Domain management and let Netlify provision
the TLS certificate automatically. Update `NEXT_PUBLIC_APP_URL` to match
once the domain is live, and update the webhook URLs configured in each
payment gateway's dashboard to point at the new domain.

## 6. Rollbacks

Netlify keeps every previous deploy. Use "Deploys" > select a prior deploy >
"Publish deploy" to roll back instantly if a release has a defect.

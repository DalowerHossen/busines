<!-- docs/DEPLOYMENT-VERCEL.md -->

# Deploying to Vercel

Vercel is a supported alternative deployment target. `vercel.json` mirrors
the same security headers and tokenised-link protections defined in
`netlify.toml` and `next.config.mjs`.

## 1. Import the project

1. In the Vercel dashboard, choose "Add New" > "Project" and import this
   repository.
2. Vercel detects the Next.js framework automatically. The build command
   (`npm run build`) and install command (`npm ci`) from `vercel.json` are
   used as-is; no manual override is needed.

## 2. Set environment variables

In Project Settings > Environment Variables, add every variable your
deployment needs from `.env.example`, scoped to "Production", "Preview",
and "Development" as appropriate. Use test/sandbox gateway credentials for
Preview and Development; use live credentials only for Production.

## 3. Deploy

Push to the branch Vercel is watching. Every push to a non-production
branch creates a Preview Deployment with its own URL; pushes to the
production branch deploy to the production domain. `.github/workflows/ci.yml`
runs the same verification independently of Vercel's own build.

## 4. Domains and HTTPS

Add your custom domain under Project Settings > Domains. Vercel provisions
and renews the TLS certificate automatically. Update
`NEXT_PUBLIC_APP_URL` and every payment gateway's configured webhook URL
once the domain is live.

## 5. Serverless function limits

Server Actions and Route Handlers run as Vercel serverless functions. The
default body size limit for Server Actions is configured in
`next.config.mjs` (`experimental.serverActions.bodySizeLimit`). Review
Vercel's current plan limits before enabling large file upload flows that
bypass Google Drive's own upload mechanism.

## 6. Rollbacks

Use the Deployments list to promote any previous successful deployment back
to production instantly if a release needs to be reverted.

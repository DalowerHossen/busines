# Auth pages and components

Phase 42 adds the English-only authentication surface under `src/features/auth/` and the App Router routes under `src/app/(auth)/`:

- Sign in with email/password and Google/GitHub OAuth entry points.
- Account signup with company name, password-strength rules from the shared Zod validator, and terms/privacy acceptance.
- Forgot-password and reset-password forms.
- Email verification with token submission and resend-email flow.
- Six-digit two-factor verification with a recovery-mode label.
- A branded responsive auth shell with a dark product panel, accessible form cards, focus states, and responsive mobile branding.
- An OAuth callback recovery page that does not accept or persist provider credentials in the browser.

## Integration boundary

The forms accept typed `AuthAction` callbacks rather than inventing provider request bodies. The future server action/route integration supplies the official Supabase contract, session cookie handling, rate limiting, Turnstile checks, and audit events. When a callback is absent, the UI returns a safe English availability error instead of pretending that a user was authenticated. Server actions remain responsible for authorization, terms-version persistence, session revocation, and two-factor enforcement.

`src/app/layout.tsx` provides the English document shell and redirects the root route to sign in. The route components are deliberately thin; validation is centralized in `@/lib/validators`, and business/provider calls are injected through callbacks so the UI cannot bypass server-side controls.

Run `npm run verify:phase42` for the deterministic auth export smoke test.

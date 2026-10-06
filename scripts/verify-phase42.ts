// scripts/verify-phase42.ts
// Smoke test for the authentication pages.
//
// The point of this check is that every auth page renders the form that is
// actually wired to a Server Action. A second, prop-driven set of forms once
// lived beside these and left the sign in button inert, so the assertions
// below name the live components explicitly.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

for (const [path, name] of [
  ['src/components/auth/auth-card.tsx', 'AuthCard'],
  ['src/components/auth/forgot-password-form.tsx', 'ForgotPasswordForm'],
  ['src/components/auth/oauth-buttons.tsx', 'OAuthButtons'],
  ['src/components/auth/reset-password-form.tsx', 'ResetPasswordForm'],
  ['src/components/auth/sign-in-form.tsx', 'SignInForm'],
  ['src/components/auth/sign-up-form.tsx', 'SignUpForm'],
  ['src/components/auth/two-factor-form.tsx', 'TwoFactorForm'],
  ['src/components/auth/verify-email-panel.tsx', 'VerifyEmailPanel'],
] as const) {
  assert.match(read(path), new RegExp(`export function ${name}`, 'u'), `${path} is missing`);
}

// Each page must compose a form that calls a Server Action.
const pages: readonly (readonly [string, string])[] = [
  ['src/app/(auth)/login/page.tsx', 'SignInForm'],
  ['src/app/(auth)/register/page.tsx', 'SignUpForm'],
  ['src/app/(auth)/forgot-password/page.tsx', 'ForgotPasswordForm'],
  ['src/app/(auth)/reset-password/page.tsx', 'ResetPasswordForm'],
  ['src/app/(auth)/two-factor/page.tsx', 'TwoFactorForm'],
  ['src/app/(auth)/verify-email/page.tsx', 'VerifyEmailPanel'],
];

for (const [page, component] of pages) {
  const source = read(page);
  assert.match(source, new RegExp(`@/components/auth/`, 'u'), `${page} does not use a live form`);
  assert.match(source, new RegExp(`<${component}`, 'u'), `${page} does not render ${component}`);
}

assert.match(read('src/components/auth/sign-in-form.tsx'), /features\/auth\/actions\/sign-in/u);

process.stdout.write('Phase 42 auth pages and component smoke test passed.\n');

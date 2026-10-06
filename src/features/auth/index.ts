// src/features/auth/index.ts
// Public surface of the authentication feature. The forms themselves live in
// components/auth so there is exactly one of each; this barrel exposes only
// the Server Actions and validation the rest of the application calls.

export { requestPasswordReset } from './actions/request-password-reset';
export { resendVerification } from './actions/resend-verification';
export { resetPassword } from './actions/reset-password';
export { signIn } from './actions/sign-in';
export { signOut } from './actions/sign-out';
export { signUp } from './actions/sign-up';
export { startOAuth } from './actions/start-oauth';
export { verifyTwoFactor } from './actions/verify-two-factor';

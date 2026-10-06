import assert from 'node:assert/strict';
import {
  AuthShell,
  ForgotPasswordForm,
  LoginForm,
  OAuthButtons,
  ResetPasswordForm,
  SignupForm,
  TwoFactorForm,
  VerifyEmailForm,
} from '@/features/auth';

for (const component of [
  AuthShell,
  ForgotPasswordForm,
  LoginForm,
  OAuthButtons,
  ResetPasswordForm,
  SignupForm,
  TwoFactorForm,
  VerifyEmailForm,
]) {
  assert.equal(typeof component, 'function');
}

process.stdout.write('Phase 42 auth pages and component smoke test passed.\n');

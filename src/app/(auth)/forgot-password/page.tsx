// src/app/(auth)/forgot-password/page.tsx
// Where somebody asks for a password reset link.

import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { ROUTES } from '@/config/app';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Reset your password',
  description: 'Ask for a secure link that lets you choose a new password.',
  path: ROUTES.forgotPassword,
});

/**
 * Renders the password reset request page.
 *
 * @returns The rendered page.
 */
export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Enter your account email and we will send a secure reset link."
      footer={
        <span>
          Remembered it?{' '}
          <Link
            href={ROUTES.login}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </span>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}

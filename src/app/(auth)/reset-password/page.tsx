// src/app/(auth)/reset-password/page.tsx
// The page reached from the reset message, where a new password is chosen.

import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthCard } from '@/components/auth/auth-card';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { ROUTES } from '@/config/app';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Choose a new password',
  description: 'Set a new password for your account.',
  path: ROUTES.resetPassword,
  noIndex: true,
});

/**
 * Renders the new password page.
 *
 * @returns The rendered page.
 */
export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Choose a new password"
      description="Pick something you have not used elsewhere. You will be signed in as soon as it is saved."
      footer={
        <span>
          Link expired?{' '}
          <Link
            href={ROUTES.forgotPassword}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Ask for another one
          </Link>
        </span>
      }
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}

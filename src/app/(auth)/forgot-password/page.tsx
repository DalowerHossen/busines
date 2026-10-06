// src/app/(auth)/forgot-password/page.tsx
// The page that sends a reset link.

import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { ROUTES } from '@/config/app';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Reset your password',
  description: 'Ask for a link that lets you choose a new password.',
  path: ROUTES.forgotPassword,
  noIndex: true,
});

/**
 * Renders the forgotten password page.
 *
 * @returns The rendered page.
 */
export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Tell us the address on your account and we will send a link that lets you set a new password."
      footer={
        <span>
          Remembered it?{' '}
          <Link
            href={ROUTES.login}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </span>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}

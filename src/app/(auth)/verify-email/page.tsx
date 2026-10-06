// src/app/(auth)/verify-email/page.tsx
// Shown after signing up, while the confirmation email is waited for.

import type { Metadata } from 'next';

import { AuthCard } from '@/components/auth/auth-card';
import { VerifyEmailPanel } from '@/components/auth/verify-email-panel';
import { ROUTES } from '@/config/app';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Verify your email',
  description: 'Confirm your email address to activate your workspace.',
  path: ROUTES.verifyEmail,
  noIndex: true,
});

export interface VerifyEmailPageProps {
  /** Values carried in the address, such as the address used to sign up. */
  searchParams: { email?: string };
}

/**
 * Renders the email confirmation page.
 *
 * @param props Query values from the address.
 * @returns The rendered page.
 */
export default function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  return (
    <AuthCard
      title="Verify your email"
      description="Confirm your email address to activate your workspace access."
    >
      <VerifyEmailPanel email={searchParams.email ?? null} />
    </AuthCard>
  );
}

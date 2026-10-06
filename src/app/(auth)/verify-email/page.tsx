// src/app/(auth)/verify-email/page.tsx
// Shown after signing up, until the address on the account is confirmed.

import type { Metadata } from 'next';

import { AuthCard } from '@/components/auth/auth-card';
import { VerifyEmailPanel } from '@/components/auth/verify-email-panel';
import { ROUTES } from '@/config/app';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Confirm your email address',
  description: 'Open the link we sent you to finish setting up your account.',
  path: ROUTES.verifyEmail,
  noIndex: true,
});

export interface VerifyEmailPageProps {
  /** Values carried in the address, such as the address to confirm. */
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
      title="One last step"
      description="Confirming your address keeps the account yours and lets us deliver invoices reliably."
    >
      <VerifyEmailPanel email={searchParams.email ?? null} />
    </AuthCard>
  );
}

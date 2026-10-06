// src/app/(auth)/two-factor/page.tsx
// The second step of signing in, for accounts with two step verification.

import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthCard } from '@/components/auth/auth-card';
import { TwoFactorForm } from '@/components/auth/two-factor-form';
import { ROUTES } from '@/config/app';
import { BRAND } from '@/config/brand';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Two step verification',
  description: 'Enter the code from your authenticator application to finish signing in.',
  path: ROUTES.twoFactor,
  noIndex: true,
});

export interface TwoFactorPageProps {
  /** Values carried in the address, such as where to continue to. */
  searchParams: { next?: string };
}

/**
 * Renders the two step verification page.
 *
 * @param props Query values from the address.
 * @returns The rendered page.
 */
export default function TwoFactorPage({ searchParams }: TwoFactorPageProps) {
  return (
    <AuthCard
      title="Two step verification"
      description="One more code and you are in. This protects the account even if the password is known."
      footer={
        <span>
          Lost both your phone and your recovery codes? Write to{' '}
          <a
            href={`mailto:${BRAND.supportEmail}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {BRAND.supportEmail}
          </a>{' '}
          or{' '}
          <Link
            href={ROUTES.login}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            start again
          </Link>
          .
        </span>
      }
    >
      <TwoFactorForm nextPath={searchParams.next ?? null} />
    </AuthCard>
  );
}

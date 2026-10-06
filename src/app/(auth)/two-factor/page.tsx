// src/app/(auth)/two-factor/page.tsx
// The second step of signing in, for accounts that have it switched on.

import type { Metadata } from 'next';

import { AuthCard } from '@/components/auth/auth-card';
import { TwoFactorForm } from '@/components/auth/two-factor-form';
import { ROUTES } from '@/config/app';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Two step verification',
  description: 'Confirm the code from your authenticator app to continue.',
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
      title="One more security check"
      description="Enter the six digit code from your authenticator app to continue."
    >
      <TwoFactorForm nextPath={searchParams.next ?? null} />
    </AuthCard>
  );
}

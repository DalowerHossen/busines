// src/app/sign/[token]/page.tsx
// The page behind a signing invitation. The token in the address is the only
// key, so the page is never indexed and never leaks a referrer.

import type { Metadata } from 'next';

import { SigningPanel } from '@/components/contracts/signing-panel';
import { Alert } from '@/components/ui/alert';
import { resolveInvitation } from '@/features/contracts/queries/resolve-invitation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your agreement',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export interface SigningPageProps {
  /** The token taken from the address. */
  params: { token: string };
}

/**
 * Renders the agreement a signing link unlocks.
 *
 * @param props The token from the address.
 * @returns The rendered page.
 */
export default async function SigningPage({ params }: SigningPageProps) {
  const token = decodeURIComponent(params.token);
  const result = await resolveInvitation(token);

  if (!result.isAvailable) {
    return (
      <div className="mx-auto w-full max-w-content">
        <Alert tone="warning" title="This link cannot be opened">
          {result.message}
        </Alert>
      </div>
    );
  }

  return <SigningPanel invitation={result.invitation} token={token} />;
}

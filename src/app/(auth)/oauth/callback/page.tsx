// src/app/(auth)/oauth/callback/page.tsx
// Where a provider lands when the handoff could not be completed. The
// successful path is handled by the route handler under /auth, so reaching
// this page always means something went wrong.

import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthCard } from '@/components/auth/auth-card';
import { Alert } from '@/components/ui/alert';
import { ROUTES } from '@/config/app';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';

export const metadata: Metadata = buildMetadata({
  title: 'Sign in callback',
  description: 'The provider sign in could not be completed.',
  path: '/oauth/callback',
  noIndex: true,
});

/**
 * Renders the provider handoff failure page.
 *
 * @returns The rendered page.
 */
export default function OAuthCallbackPage() {
  return (
    <AuthCard
      title="Sign in needs attention"
      description="We could not finish the provider handoff. Start again from the sign in page."
    >
      <Alert tone="warning" title="The sign in did not complete">
        No provider credentials were stored in this browser. Nothing about your account changed.
      </Alert>

      <Link
        href={ROUTES.login}
        className={cn(
          'mt-6 inline-flex min-h-touch w-full items-center justify-center rounded-md',
          'bg-brand-600 px-5 text-sm font-medium text-white shadow-xs'
        )}
      >
        Return to sign in
      </Link>
    </AuthCard>
  );
}

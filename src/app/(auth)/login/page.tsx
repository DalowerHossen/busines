// src/app/(auth)/login/page.tsx
// The sign in page.

import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthCard } from '@/components/auth/auth-card';
import { SignInForm } from '@/components/auth/sign-in-form';
import { ROUTES } from '@/config/app';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Sign in',
  description: 'Sign in to your account to send invoices, take payments and read your reports.',
  path: ROUTES.login,
  noIndex: true,
});

export interface LoginPageProps {
  /** Values carried in the address, such as where to continue to. */
  searchParams: { next?: string; error?: string };
}

/**
 * Renders the sign in page.
 *
 * @param props Query values from the address.
 * @returns The rendered page.
 */
export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to carry on where you left off."
      footer={
        <span>
          New here?{' '}
          <Link
            href={ROUTES.register}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create a free account
          </Link>
        </span>
      }
    >
      <SignInForm nextPath={searchParams.next ?? null} initialError={searchParams.error ?? null} />
    </AuthCard>
  );
}

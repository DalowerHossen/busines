// src/app/(auth)/register/page.tsx
// The sign up page.

import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthCard } from '@/components/auth/auth-card';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { ROUTES } from '@/config/app';
import { PLANS } from '@/config/plans';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Create your account',
  description:
    'Open a free account and send your first invoice in about a minute. No card needed to start.',
  path: ROUTES.register,
});

export interface RegisterPageProps {
  /** Values carried in the address, such as the plan that was chosen. */
  searchParams: { plan?: string };
}

/**
 * Renders the sign up page.
 *
 * @param props Query values from the address.
 * @returns The rendered page.
 */
export default function RegisterPage({ searchParams }: RegisterPageProps) {
  const requested = searchParams.plan;
  const planKey = PLANS.some((plan) => plan.key === requested) && requested ? requested : 'free';
  const plan = PLANS.find((candidate) => candidate.key === planKey);

  return (
    <AuthCard
      title="Create your account"
      description={
        plan && plan.key !== 'free'
          ? `Starting on the ${plan.name} plan with a ${plan.trialDays} day trial. No card needed today.`
          : 'Start on the free plan. Upgrade only when the volume makes it worth it.'
      }
      footer={
        <span>
          Already have an account?{' '}
          <Link
            href={ROUTES.login}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </span>
      }
    >
      <SignUpForm planKey={planKey} />
    </AuthCard>
  );
}

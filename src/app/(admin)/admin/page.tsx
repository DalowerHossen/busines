// src/app/(admin)/admin/page.tsx
// The platform overview: how many businesses are here, what they pay, what
// was collected this month and what is waiting for somebody.

import type { Metadata } from 'next';
import Link from 'next/link';

import { OnboardingFunnelBoard } from '@/components/admin/onboarding-funnel-board';
import { PlatformStats } from '@/components/admin/platform-stats';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadPlatformOverview } from '@/features/admin/queries/get-platform-overview';
import { loadOnboardingFunnel } from '@/features/onboarding/queries/list-funnel';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Platform console',
  description: 'The state of the whole platform in one screen.',
  path: ROUTES.admin,
  noIndex: true,
});

/**
 * Renders the platform overview.
 *
 * @returns The rendered page.
 */
export default async function AdminOverviewPage() {
  const [overview, funnel] = await Promise.all([loadPlatformOverview(), loadOnboardingFunnel(30)]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform console"
        description="Every figure here is read live from the database. Nothing is cached, estimated or rounded up."
        actions={
          <Link href="/admin/tenants" className={cn(buttonVariants({ variant: 'primary' }))}>
            Open the business list
          </Link>
        }
      />

      {overview.isDegraded ? (
        <Alert tone="warning" title="The figures could not be read">
          The console is showing zeros rather than stale numbers. Reload in a moment.
        </Alert>
      ) : null}

      <PlatformStats overview={overview} currency="USD" />

      {funnel.isDegraded ? (
        <Alert tone="warning" title="The signup list could not be read">
          Everything else on this page is unaffected. Reload in a moment.
        </Alert>
      ) : (
        <OnboardingFunnelBoard rows={funnel.rows} />
      )}

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-base font-semibold text-foreground">What to look at first</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            {overview.accounts.awaitingKyc} identity checks are waiting. A business cannot be paid
            out until one is approved.
          </li>
          <li>
            {overview.money.payoutsAwaitingReview} payouts are requested and not yet released.
          </li>
          <li>
            {overview.attention.openDisputes} disputes are open and{' '}
            {overview.attention.refundsAwaitingApproval} refunds need approving.
          </li>
          <li>
            {overview.subscriptions.pastDue} businesses are behind on what they pay us this period.
          </li>
        </ul>
      </section>
    </div>
  );
}

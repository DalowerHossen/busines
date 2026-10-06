// src/app/(admin)/admin/money/page.tsx
// Everything on the platform waiting for a decision about money: payouts to
// release, refunds being approved inside a tenant, and open chargebacks.

import type { Metadata } from 'next';

import { MoneyWatchlist } from '@/components/admin/money-watchlist';
import { PayoutReviewQueue } from '@/components/admin/payout-review-queue';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { loadMoneyQueue } from '@/features/admin/queries/list-money-queue';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Money operations',
  description: 'Payouts, refunds and chargebacks waiting for the platform team.',
  path: '/admin/money',
  noIndex: true,
});

/**
 * Renders the money operations page.
 *
 * @returns The rendered page.
 */
export default async function AdminMoneyPage() {
  const queue = await loadMoneyQueue();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Money operations"
        description="Releasing a payout sends real money. Refusing one puts it straight back into the balance of the business, with the reason you give."
      />

      {queue.isDegraded ? (
        <Alert tone="warning" title="Part of this queue could not be read">
          Do not act on an incomplete list. Reload in a moment.
        </Alert>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Payouts waiting to be released</h2>
        <PayoutReviewQueue payouts={queue.payouts} />
      </section>

      <MoneyWatchlist refunds={queue.refunds} disputes={queue.disputes} />
    </div>
  );
}

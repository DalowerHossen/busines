// src/app/(app)/dashboard/payouts/page.tsx
// The money the platform is holding for this business, where it can be sent
// and what has already gone out.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PayoutAccountManager } from '@/components/payouts/payout-account-manager';
import { SettlementSummaryCard } from '@/components/payouts/settlement-summary-card';
import { SettlementTable } from '@/components/payouts/settlement-table';
import { PayoutRequestPanel } from '@/components/payouts/payout-request-panel';
import { PayoutTable } from '@/components/payouts/payout-table';
import { WalletStatement } from '@/components/payouts/wallet-statement';
import { WalletSummary } from '@/components/payouts/wallet-summary';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadPayoutOverview } from '@/features/payouts/queries/get-wallet';
import { loadEarningsBoard } from '@/features/settlements/queries/list-settlements';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Payouts',
  description: 'Your balance with the platform, where it is sent and what has gone out.',
  path: ROUTES.payouts,
  noIndex: true,
});

/**
 * Renders the payout page.
 *
 * @returns The rendered page.
 */
export default async function PayoutsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader title="Payouts" description="This account is not attached to a business yet." />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'payments', 'view')) {
    return (
      <>
        <PageHeader title="Payouts" description="You do not have access to the money pages." />
        <Alert tone="warning" title="You cannot see payouts">
          Ask the owner of this business to give your account permission to view payments.
        </Alert>
      </>
    );
  }

  const [overview, earnings] = await Promise.all([
    loadPayoutOverview(company.id),
    loadEarningsBoard(company.id),
  ]);
  const isOwner = user.role === 'owner' || user.role === 'super_admin';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payouts"
        description="Everything a client pays you online arrives here first, then goes to your own account. Every fee taken on the way is shown line by line."
        actions={
          overview.wallet ? (
            <a
              href="/api/payouts/statement"
              className={cn(buttonVariants({ variant: 'secondary' }))}
            >
              Download statement
            </a>
          ) : null
        }
      />

      {overview.isDegraded ? (
        <Alert tone="warning" title="Your balance could not be read">
          Nothing has been changed. Try again in a moment before requesting a payout.
        </Alert>
      ) : null}

      {earnings.isDegraded ? (
        <Alert tone="warning" title="Your earnings could not be read">
          The figures below may be incomplete. Reload before you act on them.
        </Alert>
      ) : (
        <SettlementSummaryCard summary={earnings.summary} />
      )}

      {overview.wallet === null ? (
        <Alert tone="info" title="Your wallet opens with your first online payment">
          Until a client pays you through a connected provider, there is no balance to send. Connect
          a provider in your payment settings to start taking card payments.
        </Alert>
      ) : (
        <>
          <WalletSummary wallet={overview.wallet} />

          <PayoutRequestPanel
            wallet={overview.wallet}
            accounts={overview.accounts}
            canRequest={isOwner}
          />

          <PayoutAccountManager
            accounts={overview.accounts}
            currency={overview.wallet.currency}
            countryCode={company.countryCode}
            canEdit={isOwner}
          />

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">Payouts</h2>
            <PayoutTable payouts={overview.payouts} canCancel={isOwner} />
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">Payment by payment</h2>
            <SettlementTable settlements={earnings.settlements} />
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">Statement</h2>
            <WalletStatement entries={overview.entries} />
          </section>
        </>
      )}
    </div>
  );
}

// src/app/(app)/dashboard/payments/refunds/page.tsx
// The money this business has given back, and anything waiting for the owner
// to approve it.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PaymentsNav } from '@/components/payments/payments-nav';
import { RefundTable } from '@/components/refunds/refund-table';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadRefunds } from '@/features/refunds/queries/list-refunds';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { formatMoney } from '@/lib/format';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Refunds',
  description: 'Money given back to clients, and refunds waiting for approval.',
  path: `${ROUTES.payments}/refunds`,
  noIndex: true,
});

/**
 * Renders the refund list.
 *
 * @returns The rendered page.
 */
export default async function RefundsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader title="Refunds" description="This account is not attached to a business yet." />
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
        <PageHeader title="Refunds" description="You do not have access to the money pages." />
        <Alert tone="warning" title="You cannot see refunds">
          Ask the owner of this business to give your account permission to view payments.
        </Alert>
      </>
    );
  }

  const overview = await loadRefunds(company.id, company.baseCurrency);
  const canReview = user.role === 'owner' || user.role === 'super_admin';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Refunds"
        description="Every refund against a payment, and what it reopened on the invoice it had settled."
      />

      <PaymentsNav />

      {overview.isDegraded ? (
        <Alert tone="warning" title="The refunds could not be read">
          Nothing has been changed. Try again in a moment.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-5">
            <p className="text-sm text-muted-foreground">Given back</p>
            <p className="tabular mt-1 text-2xl font-semibold text-foreground">
              {formatMoney(overview.totals.settledAmount, overview.totals.currency)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <p className="text-sm text-muted-foreground">Waiting for approval</p>
            <p className="tabular mt-1 text-2xl font-semibold text-foreground">
              {formatMoney(overview.totals.pendingAmount, overview.totals.currency)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <p className="text-sm text-muted-foreground">Decisions needed</p>
            <p className="tabular mt-1 text-2xl font-semibold text-foreground">
              {overview.totals.pendingCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {canReview || overview.totals.pendingCount === 0 ? null : (
        <Alert tone="info" title="Only the owner can approve a refund">
          A refund you ask for is held until the owner of this business releases it.
        </Alert>
      )}

      <RefundTable refunds={overview.refunds} canReview={canReview} />
    </div>
  );
}

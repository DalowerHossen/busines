// src/app/(app)/dashboard/payments/disputes/page.tsx
// Chargebacks raised against this business and how much is at stake.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { DisputeTable } from '@/components/disputes/dispute-table';
import { PaymentsNav } from '@/components/payments/payments-nav';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadDisputes } from '@/features/disputes/queries/list-disputes';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { formatMoney } from '@/lib/format';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Disputes',
  description: 'Chargebacks raised against this business and the evidence answering them.',
  path: `${ROUTES.payments}/disputes`,
  noIndex: true,
});

/**
 * Renders the dispute list.
 *
 * @returns The rendered page.
 */
export default async function DisputesPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Disputes"
          description="This account is not attached to a business yet."
        />
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
        <PageHeader title="Disputes" description="You do not have access to the money pages." />
        <Alert tone="warning" title="You cannot see disputes">
          Ask the owner of this business to give your account permission to view payments.
        </Alert>
      </>
    );
  }

  const overview = await loadDisputes(company.id, company.baseCurrency);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disputes"
        description="A chargeback is answered with evidence, and the clock is set by the card scheme rather than by us. Open each one to see what has been gathered."
      />

      <PaymentsNav />

      {overview.isDegraded ? (
        <Alert tone="warning" title="The disputes could not be read">
          Nothing has been changed. Try again in a moment.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-5">
            <p className="text-sm text-muted-foreground">Still to answer</p>
            <p className="tabular mt-1 text-2xl font-semibold text-foreground">
              {overview.totals.openCount}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <p className="text-sm text-muted-foreground">At stake</p>
            <p className="tabular mt-1 text-2xl font-semibold text-foreground">
              {formatMoney(overview.totals.openAmount, overview.totals.currency)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <p className="text-sm text-muted-foreground">Recovered so far</p>
            <p className="tabular mt-1 text-2xl font-semibold text-foreground">
              {formatMoney(overview.totals.recoveredAmount, overview.totals.currency)}
            </p>
          </CardContent>
        </Card>
      </div>

      <DisputeTable disputes={overview.disputes} />
    </div>
  );
}

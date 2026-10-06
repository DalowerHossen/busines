// src/app/(app)/dashboard/payments/disputes/[disputeId]/page.tsx
// One chargeback, with everything needed to answer it in one place.

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { DisputeWorkbench } from '@/components/disputes/dispute-workbench';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { ROUTES } from '@/config/app';
import { getDispute } from '@/features/disputes/queries/get-dispute';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Dispute',
  description: 'One chargeback and the evidence gathered to answer it.',
  path: `${ROUTES.payments}/disputes`,
  noIndex: true,
});

export interface DisputePageProps {
  /** The dispute identifier from the address. */
  params: { disputeId: string };
}

/**
 * Renders one dispute.
 *
 * @param props The dispute identifier from the address.
 * @returns The rendered page.
 */
export default async function DisputePage({ params }: DisputePageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader title="Dispute" description="This account is not attached to a business yet." />
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
        <PageHeader title="Dispute" description="You do not have access to the money pages." />
        <Alert tone="warning" title="You cannot see disputes">
          Ask the owner of this business to give your account permission to view payments.
        </Alert>
      </>
    );
  }

  const dispute = await getDispute(company.id, params.disputeId);

  if (dispute === null) {
    notFound();
  }

  const canEdit = can(user, 'payments', 'edit');
  const canDecide = user.role === 'owner' || user.role === 'super_admin';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Dispute from ${dispute.clientName}`}
        description={
          dispute.reasonDescription ??
          'The card holder has asked their bank to take this payment back.'
        }
        breadcrumbs={[
          { label: 'Payments', href: ROUTES.payments },
          { label: 'Disputes', href: `${ROUTES.payments}/disputes` },
          { label: dispute.caseNumber ?? 'Dispute' },
        ]}
      />

      <Card>
        <CardContent className="grid gap-4 py-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Amount disputed</p>
            <p className="tabular mt-1 font-medium text-foreground">
              {formatMoney(dispute.disputedAmount, dispute.currency)}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Invoice</p>
            <p className="mt-1 font-medium text-foreground">
              {dispute.invoiceNumber ?? 'Not linked'}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Evidence due</p>
            <p className="mt-1 font-medium text-foreground">
              {dispute.evidenceDueAt ? formatDate(dispute.evidenceDueAt) : 'No deadline given'}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">State</p>
            <p className="mt-1">
              <StatusBadge kind="dispute" status={dispute.status} />
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Opened</p>
            <p className="mt-1 font-medium text-foreground">{formatDateTime(dispute.openedAt)}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Reason given</p>
            <p className="mt-1 font-medium text-foreground">
              {dispute.reasonCode ?? 'None recorded'}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Provider fee</p>
            <p className="tabular mt-1 font-medium text-foreground">
              {formatMoney(dispute.feeAmount, dispute.currency)}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Recovered</p>
            <p className="tabular mt-1 font-medium text-foreground">
              {formatMoney(dispute.recoveredAmount, dispute.currency)}
            </p>
          </div>
        </CardContent>
      </Card>

      <DisputeWorkbench dispute={dispute} canEdit={canEdit} canDecide={canDecide} />
    </div>
  );
}

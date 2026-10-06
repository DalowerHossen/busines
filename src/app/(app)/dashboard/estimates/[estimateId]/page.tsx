// src/app/(app)/dashboard/estimates/[estimateId]/page.tsx
// One quotation in full: the document the client receives, where it stands,
// and what can be done with it next.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { EstimateActionsBar } from '@/components/estimates/estimate-actions-bar';
import { EstimateDocument } from '@/components/estimates/estimate-document';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { ROUTES } from '@/config/app';
import { getEstimate } from '@/features/estimates/queries/get-estimate';
import { describeEstimateStatus, isEditableEstimate } from '@/features/estimates/status';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney, formatNumber } from '@/lib/format';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Estimate',
  description: 'A single quotation and where it stands with the client.',
  path: ROUTES.estimates,
  noIndex: true,
});

export interface EstimateDetailPageProps {
  /** Route values, holding the estimate identifier. */
  params: { estimateId: string };
}

interface ActivityRow {
  key: string;
  label: string;
  value: string;
}

/**
 * Renders one estimate.
 *
 * @param props The route parameters of the request.
 * @returns The rendered page.
 */
export default async function EstimateDetailPage({ params }: EstimateDetailPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Estimate"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'estimates', 'view')) {
    return (
      <>
        <PageHeader title="Estimate" description="You do not have access to the quotations." />
        <Alert tone="warning" title="You cannot see estimates">
          Ask the owner of this business to give your account permission to view estimates.
        </Alert>
      </>
    );
  }

  const estimate = await getEstimate(company.id, params.estimateId);

  if (estimate === null) {
    notFound();
  }

  const canEdit = can(user, 'estimates', 'edit');
  const isDraft = isEditableEstimate(estimate.status);

  const activity: ActivityRow[] = [
    {
      key: 'created',
      label: 'Written',
      value: estimate.createdAt === null ? 'Not recorded' : formatDateTime(estimate.createdAt),
    },
    {
      key: 'sent',
      label: 'Sent',
      value: estimate.sentAt === null ? 'Not sent yet' : formatDateTime(estimate.sentAt),
    },
    {
      key: 'viewed',
      label: 'Opened by the client',
      value:
        estimate.firstViewedAt === null
          ? 'Not opened yet'
          : `${formatDateTime(estimate.firstViewedAt)} · ${formatNumber(estimate.viewCount)} views`,
    },
    {
      key: 'approved',
      label: 'Accepted',
      value:
        estimate.approvedAt === null
          ? 'No acceptance recorded'
          : `${formatDateTime(estimate.approvedAt)}${
              estimate.approvedByName === null ? '' : ` by ${estimate.approvedByName}`
            }`,
    },
    {
      key: 'declined',
      label: 'Declined',
      value:
        estimate.declinedAt === null
          ? 'No decline recorded'
          : `${formatDateTime(estimate.declinedAt)}${
              estimate.declineReason === null ? '' : ` · ${estimate.declineReason}`
            }`,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          estimate.estimateNumber === null
            ? 'Draft estimate'
            : `Estimate ${estimate.estimateNumber}`
        }
        description={`For ${estimate.clientName}`}
        breadcrumbs={[
          { label: 'Estimates', href: ROUTES.estimates },
          { label: estimate.estimateNumber ?? 'Draft' },
        ]}
        badge={<StatusBadge kind="estimate" status={estimate.status} />}
        actions={
          isDraft && canEdit ? (
            <Link
              href={`${ROUTES.estimates}/${estimate.id}/edit`}
              className={cn(buttonVariants({ variant: 'secondary' }))}
            >
              Edit draft
            </Link>
          ) : null
        }
      />

      {estimate.isDeleted ? (
        <Alert tone="warning" title="This draft has been deleted">
          It no longer appears in your working lists. Restore it from the deleted view when you need
          it again.
        </Alert>
      ) : null}

      <Alert tone="info" title={`Status: ${estimate.status.replace('_', ' ')}`}>
        {describeEstimateStatus(estimate.status)}
      </Alert>

      <EstimateActionsBar
        estimate={estimate}
        canEdit={canEdit}
        canCreateInvoice={can(user, 'invoices', 'create')}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <EstimateDocument estimate={estimate} companyName={company.displayName} />

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Issued</dt>
                  <dd>{formatDate(estimate.issueDate)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Valid until</dt>
                  <dd>
                    {estimate.validUntil === null ? 'No end date' : formatDate(estimate.validUntil)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd className="tabular">{formatMoney(estimate.taxAmount, estimate.currency)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-semibold text-foreground">
                  <dt>Total</dt>
                  <dd className="tabular">
                    {formatMoney(estimate.totalAmount, estimate.currency)}
                  </dd>
                </div>
              </dl>

              {estimate.convertedInvoiceId === null ? null : (
                <Link
                  href={`${ROUTES.invoices}/${estimate.convertedInvoiceId}`}
                  className={cn(buttonVariants({ variant: 'outline', fullWidth: true }), 'mt-4')}
                >
                  Open the invoice
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                {activity.map((row) => (
                  <div key={row.key}>
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="text-foreground">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

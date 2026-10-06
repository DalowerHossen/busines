// src/app/(app)/dashboard/payments/[paymentId]/page.tsx
// One payment in full: what arrived, who sent it, what it settled and what is
// still waiting to be applied.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { AllocatePaymentPanel } from '@/components/payments/allocate-payment-panel';
import { PaymentAllocationsCard } from '@/components/payments/payment-allocations-card';
import { RefundPanel } from '@/components/refunds/refund-panel';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_PROVIDER_LABELS,
} from '@/components/payments/payment-method-label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { getPayment } from '@/features/payments/queries/get-payment';
import { loadOpenInvoices } from '@/features/payments/queries/open-invoices';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { subtractMoney, toStoredAmount } from '@/lib/money';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Payment',
  description: 'A single payment and the invoices it settled.',
  path: ROUTES.payments,
  noIndex: true,
});

export interface PaymentDetailPageProps {
  /** Route values, holding the payment identifier. */
  params: { paymentId: string };
}

interface DetailRow {
  key: string;
  label: string;
  value: string;
}

/**
 * Renders one payment.
 *
 * @param props The route parameters of the request.
 * @returns The rendered page.
 */
export default async function PaymentDetailPage({ params }: PaymentDetailPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader title="Payment" description="This account is not attached to a business yet." />
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
        <PageHeader title="Payment" description="You do not have access to the payment record." />
        <Alert tone="warning" title="You cannot see payments">
          Ask the owner of this business to give your account permission to view payments.
        </Alert>
      </>
    );
  }

  const payment = await getPayment(company.id, params.paymentId);

  if (payment === null) {
    notFound();
  }

  const canEdit = can(user, 'payments', 'edit');
  const formData = canEdit ? await loadOpenInvoices(company.id) : { invoices: [] };

  const rows: DetailRow[] = [
    { key: 'received', label: 'Received on', value: formatDate(payment.receivedAt) },
    {
      key: 'value-date',
      label: 'Value date',
      value: payment.valueDate === null ? 'Same as received' : formatDate(payment.valueDate),
    },
    { key: 'method', label: 'Method', value: PAYMENT_METHOD_LABELS[payment.methodType] },
    { key: 'provider', label: 'Taken through', value: PAYMENT_PROVIDER_LABELS[payment.provider] },
    { key: 'client', label: 'Client', value: payment.clientName },
    { key: 'payer', label: 'Paid by', value: payment.payerName ?? 'Not recorded' },
    { key: 'payer-email', label: 'Payer email', value: payment.payerEmail ?? 'Not recorded' },
    {
      key: 'reference',
      label: 'Reference',
      value: payment.reference ?? payment.bankReference ?? payment.chequeNumber ?? 'None given',
    },
    {
      key: 'fee',
      label: 'Processing fee',
      value: formatMoney(payment.gatewayFeeAmount, payment.currency),
    },
    { key: 'net', label: 'Net received', value: formatMoney(payment.netAmount, payment.currency) },
    {
      key: 'refunded',
      label: 'Refunded',
      value: formatMoney(payment.refundedAmount, payment.currency),
    },
    {
      key: 'recorded',
      label: 'Recorded at',
      value: payment.createdAt === null ? 'Not recorded' : formatDateTime(payment.createdAt),
    },
  ];

  const unapplied = Number.parseFloat(payment.unallocatedAmount);

  return (
    <div className="space-y-6">
      <PageHeader
        title={formatMoney(payment.amount, payment.currency)}
        description={`${payment.paymentNumber ?? 'Payment'} received from ${payment.clientName}.`}
        actions={
          <Link href={ROUTES.payments} className={cn(buttonVariants({ variant: 'secondary' }))}>
            Back to payments
          </Link>
        }
      />

      {payment.isDeleted ? (
        <Alert tone="warning" title="This payment has been deleted">
          It is kept for the audit trail and no longer affects any invoice balance.
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={payment.status === 'succeeded' ? 'success' : 'neutral'}>
          {payment.status === 'succeeded' ? 'Settled' : payment.status}
        </Badge>
        {unapplied > 0 ? (
          <Badge tone="warning">
            {formatMoney(payment.unallocatedAmount, payment.currency)} waiting to be applied
          </Badge>
        ) : (
          <Badge tone="brand">Fully applied</Badge>
        )}
        {payment.isManual ? <Badge tone="outline">Entered by hand</Badge> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border border-border bg-surface p-5 shadow-xs lg:col-span-2">
          <h2 className="text-base font-semibold text-foreground">Payment details</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.key}>
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="text-sm font-medium text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>

          {payment.notes === null ? null : (
            <div className="mt-5 rounded-md bg-surface-muted p-4">
              <h3 className="text-sm font-semibold text-foreground">Notes</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                {payment.notes}
              </p>
            </div>
          )}
        </section>

        <div className="space-y-6">
          <AllocatePaymentPanel
            paymentId={payment.id}
            currency={payment.currency}
            unallocatedAmount={payment.unallocatedAmount}
            clientId={payment.clientId}
            invoices={formData.invoices}
            canEdit={canEdit && !payment.isDeleted}
          />

          {canEdit && !payment.isDeleted && payment.status !== 'failed' ? (
            <RefundPanel
              paymentId={payment.id}
              refundableAmount={toStoredAmount(
                subtractMoney(payment.amount, payment.refundedAmount)
              )}
              currency={payment.currency}
            />
          ) : null}
        </div>
      </div>

      <PaymentAllocationsCard
        allocations={payment.allocations}
        currency={payment.currency}
        canEdit={canEdit && !payment.isDeleted}
      />
    </div>
  );
}

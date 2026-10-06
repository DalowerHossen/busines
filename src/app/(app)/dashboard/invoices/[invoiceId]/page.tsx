// src/app/(app)/dashboard/invoices/[invoiceId]/page.tsx
// One invoice: the document itself, what it is waiting for and what has
// happened to it so far.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { InstalmentOfferPicker } from '@/components/instalments/instalment-offer-picker';
import { AskForReviewButton } from '@/components/loyalty/ask-for-review-button';
import { InvoiceActionsBar } from '@/components/invoices/invoice-actions-bar';
import { InvoiceActivity } from '@/components/invoices/invoice-activity';
import { InvoiceDocument } from '@/components/invoices/invoice-document';
import { DisputeReadinessCard } from '@/components/invoices/dispute-readiness-card';
import { WorkEvidencePanel } from '@/components/invoices/work-evidence-panel';
import { SendDocumentPanel } from '@/components/messaging/send-document-panel';
import { ShareDocumentLink } from '@/components/portal/share-document-link';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { ROUTES } from '@/config/app';
import { loadDisputeReadiness } from '@/features/disputes/queries/get-readiness';
import { loadWorkEvidence } from '@/features/evidence/queries/get-evidence';
import { getInvoice } from '@/features/invoices/queries/get-invoice';
import { loadOffersForInvoice } from '@/features/instalments/queries/list-offers';
import { describeInvoiceStatus, isEditableInvoice } from '@/features/invoices/status';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Invoice',
  description: 'One invoice, its lines and what it is waiting for.',
  path: ROUTES.invoices,
  noIndex: true,
});

export interface InvoicePageProps {
  /** The invoice identifier taken from the address. */
  params: { invoiceId: string };
}

/**
 * Renders the page of one invoice.
 *
 * @param props The invoice identifier from the address.
 * @returns The rendered page.
 */
export default async function InvoicePage({ params }: InvoicePageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company || !can(user, 'invoices', 'view')) {
    return (
      <>
        <PageHeader title="Invoice" description="You do not have access to the invoice book." />
        <Alert tone="warning" title="You cannot see invoices">
          Ask the owner of this business to give your account permission to view invoices.
        </Alert>
      </>
    );
  }

  const invoice = await getInvoice(company.id, params.invoiceId);

  if (invoice === null) {
    notFound();
  }

  const canEdit = can(user, 'invoices', 'edit');
  const instalmentQuotes =
    Number.parseFloat(invoice.balanceDue) > 0 && can(user, 'payments', 'view')
      ? await loadOffersForInvoice(invoice.id)
      : [];
  const isDraft = isEditableInvoice(invoice.status, invoice.isLocked);
  const [evidence, readiness] = await Promise.all([
    loadWorkEvidence(invoice.id),
    loadDisputeReadiness(invoice.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          invoice.invoiceNumber === null ? 'Draft invoice' : `Invoice ${invoice.invoiceNumber}`
        }
        description={`For ${invoice.clientName}`}
        breadcrumbs={[
          { label: 'Invoices', href: ROUTES.invoices },
          { label: invoice.invoiceNumber ?? 'Draft' },
        ]}
        badge={<StatusBadge kind="invoice" status={invoice.status} />}
        actions={
          isDraft && canEdit ? (
            <Link
              href={`${ROUTES.invoices}/${invoice.id}/edit`}
              className={cn(buttonVariants({ variant: 'secondary' }))}
            >
              Edit draft
            </Link>
          ) : null
        }
      />

      {invoice.isDeleted ? (
        <Alert tone="warning" title="This draft has been deleted">
          It no longer appears in your working lists. Restore it from the deleted view when you need
          it again.
        </Alert>
      ) : null}

      <Alert tone="info" title={`Status: ${invoice.status.replace('_', ' ')}`}>
        {describeInvoiceStatus(invoice.status)}
      </Alert>

      <InvoiceActionsBar invoice={invoice} canEdit={canEdit} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <InvoiceDocument invoice={invoice} companyName={company.displayName} />

          {evidence.isDegraded ? (
            <Alert tone="warning" title="The proof of work could not be read">
              The invoice itself is unaffected. Reload the page in a moment.
            </Alert>
          ) : (
            <WorkEvidencePanel
              invoiceId={invoice.id}
              items={evidence.items}
              summary={evidence.summary}
              canEdit={canEdit}
            />
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Settlement</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Total</dt>
                  <dd className="tabular">{formatMoney(invoice.totalAmount, invoice.currency)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Paid</dt>
                  <dd className="tabular">{formatMoney(invoice.paidAmount, invoice.currency)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Credited</dt>
                  <dd className="tabular">
                    {formatMoney(invoice.creditedAmount, invoice.currency)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-semibold text-foreground">
                  <dt>Amount due</dt>
                  <dd className="tabular">{formatMoney(invoice.balanceDue, invoice.currency)}</dd>
                </div>
                <div className="flex justify-between gap-3 pt-2">
                  <dt className="text-muted-foreground">Due date</dt>
                  <dd>{formatDate(invoice.dueDate)}</dd>
                </div>
              </dl>

              {Number.parseFloat(invoice.balanceDue) > 0 && canEdit ? (
                <Link
                  href={`${ROUTES.payments}/new?invoice=${invoice.id}`}
                  className={cn(buttonVariants({ variant: 'primary', fullWidth: true }), 'mt-4')}
                >
                  Record payment
                </Link>
              ) : null}

              {invoice.internalMemo === null ? null : (
                <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
                  {invoice.internalMemo}
                </p>
              )}
            </CardContent>
          </Card>

          {invoice.status === 'paid' && user.role === 'owner' ? (
            <Card>
              <CardHeader>
                <CardTitle>Ask what they thought</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  The best moment to ask for a review is the moment the work is paid for. The client
                  is asked once about this invoice and never again.
                </p>
                <AskForReviewButton invoiceId={invoice.id} />
              </CardContent>
            </Card>
          ) : null}

          <InstalmentOfferPicker
            invoiceId={invoice.id}
            currency={invoice.currency}
            quotes={instalmentQuotes}
            canAgree={canEdit}
          />

          <SendDocumentPanel
            documentKind="invoice"
            documentId={invoice.id}
            clientEmail={invoice.clientEmail}
            clientName={invoice.clientName}
            isOwner={user.role === 'owner' || user.role === 'super_admin'}
          />

          <ShareDocumentLink
            documentKind="invoice"
            documentId={invoice.id}
            recipientEmail={invoice.clientEmail}
            canShare={user.role === 'owner' || user.role === 'super_admin'}
          />

          {readiness.isDegraded ? null : <DisputeReadinessCard readiness={readiness} />}

          <InvoiceActivity invoice={invoice} />
        </div>
      </div>
    </div>
  );
}

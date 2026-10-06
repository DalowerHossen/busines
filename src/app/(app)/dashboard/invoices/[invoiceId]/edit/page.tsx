// src/app/(app)/dashboard/invoices/[invoiceId]/edit/page.tsx
// Editing a draft invoice. An invoice that has already been issued is locked
// and is corrected with a credit note or a revision instead.

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { InvoiceForm } from '@/components/invoices/invoice-form';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { getInvoice } from '@/features/invoices/queries/get-invoice';
import { loadInvoiceFormData } from '@/features/invoices/queries/invoice-form-data';
import { isEditableInvoice } from '@/features/invoices/status';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Edit draft invoice',
  description: 'Change the lines, dates and notes of a draft invoice.',
  path: ROUTES.invoices,
  noIndex: true,
});

export interface EditInvoicePageProps {
  /** The invoice identifier taken from the address. */
  params: { invoiceId: string };
}

/**
 * Renders the edit draft page.
 *
 * @param props The invoice identifier from the address.
 * @returns The rendered page.
 */
export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company || !can(user, 'invoices', 'edit')) {
    return (
      <>
        <PageHeader title="Edit draft" description="You cannot change invoices in this business." />
        <Alert tone="warning" title="You cannot edit this invoice">
          Ask the owner of this business to give your account permission to edit invoices.
        </Alert>
      </>
    );
  }

  const [invoice, formData] = await Promise.all([
    getInvoice(company.id, params.invoiceId),
    loadInvoiceFormData(company.id),
  ]);

  if (invoice === null) {
    notFound();
  }

  if (!isEditableInvoice(invoice.status, invoice.isLocked)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Invoice ${invoice.invoiceNumber ?? ''}`.trim()}
          description="This invoice has been issued."
          breadcrumbs={[
            { label: 'Invoices', href: ROUTES.invoices },
            { label: invoice.invoiceNumber ?? 'Invoice', href: `${ROUTES.invoices}/${invoice.id}` },
            { label: 'Edit' },
          ]}
        />
        <Alert tone="warning" title="An issued invoice cannot be edited">
          The client already has this document, so it is locked. Raise a credit note to correct the
          amount, or issue a revision to replace it.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit draft invoice"
        description="Nothing has been sent yet, so every part of this draft can still be changed."
        breadcrumbs={[
          { label: 'Invoices', href: ROUTES.invoices },
          { label: 'Draft', href: `${ROUTES.invoices}/${invoice.id}` },
          { label: 'Edit' },
        ]}
      />

      <InvoiceForm invoice={invoice} formData={formData} defaultCurrency={company.baseCurrency} />
    </div>
  );
}

// src/app/(app)/dashboard/invoices/new/page.tsx
// Writing a new invoice. It is saved as a draft first, so nothing is numbered
// or sent until you say so.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { InvoiceForm } from '@/components/invoices/invoice-form';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadInvoiceFormData } from '@/features/invoices/queries/invoice-form-data';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'New invoice',
  description: 'Write an invoice and save it as a draft before issuing it.',
  path: `${ROUTES.invoices}/new`,
  noIndex: true,
});

/**
 * Renders the new invoice page.
 *
 * @returns The rendered page.
 */
export default async function NewInvoicePage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company || !can(user, 'invoices', 'create')) {
    return (
      <>
        <PageHeader title="New invoice" description="You cannot raise invoices in this business." />
        <Alert tone="warning" title="You cannot raise an invoice">
          Ask the owner of this business to give your account permission to create invoices.
        </Alert>
      </>
    );
  }

  const formData = await loadInvoiceFormData(company.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New invoice"
        description="Saved as a draft. The number is assigned and the document is locked only when you issue it."
        breadcrumbs={[{ label: 'Invoices', href: ROUTES.invoices }, { label: 'New invoice' }]}
      />

      <InvoiceForm formData={formData} defaultCurrency={company.baseCurrency} />
    </div>
  );
}

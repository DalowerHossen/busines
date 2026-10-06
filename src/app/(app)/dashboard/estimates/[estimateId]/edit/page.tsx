// src/app/(app)/dashboard/estimates/[estimateId]/edit/page.tsx
// Editing a draft quotation. One that has already gone out is left as it is,
// because the client holds a copy of exactly that document.

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { EstimateForm } from '@/components/estimates/estimate-form';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { getEstimate } from '@/features/estimates/queries/get-estimate';
import { isEditableEstimate } from '@/features/estimates/status';
import { loadInvoiceFormData } from '@/features/invoices/queries/invoice-form-data';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Edit draft estimate',
  description: 'Change the lines, dates and notes of a draft quotation.',
  path: ROUTES.estimates,
  noIndex: true,
});

export interface EditEstimatePageProps {
  /** The estimate identifier taken from the address. */
  params: { estimateId: string };
}

/**
 * Renders the edit draft page.
 *
 * @param props The estimate identifier from the address.
 * @returns The rendered page.
 */
export default async function EditEstimatePage({ params }: EditEstimatePageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company || !can(user, 'estimates', 'edit')) {
    return (
      <>
        <PageHeader
          title="Edit draft"
          description="You cannot change quotations in this business."
        />
        <Alert tone="warning" title="You cannot edit this estimate">
          Ask the owner of this business to give your account permission to edit estimates.
        </Alert>
      </>
    );
  }

  const [estimate, formData] = await Promise.all([
    getEstimate(company.id, params.estimateId),
    loadInvoiceFormData(company.id),
  ]);

  if (estimate === null) {
    notFound();
  }

  if (!isEditableEstimate(estimate.status)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Estimate ${estimate.estimateNumber ?? ''}`.trim()}
          description="This quotation has already gone out."
          breadcrumbs={[
            { label: 'Estimates', href: ROUTES.estimates },
            {
              label: estimate.estimateNumber ?? 'Estimate',
              href: `${ROUTES.estimates}/${estimate.id}`,
            },
            { label: 'Edit' },
          ]}
        />
        <Alert tone="warning" title="A quotation that has gone out cannot be edited">
          The client holds this exact document. Write a fresh quotation if the price or the scope
          has changed.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit draft estimate"
        description="Nothing has been sent yet, so every part of this draft can still be changed."
        breadcrumbs={[
          { label: 'Estimates', href: ROUTES.estimates },
          { label: 'Draft', href: `${ROUTES.estimates}/${estimate.id}` },
          { label: 'Edit' },
        ]}
      />

      <EstimateForm
        estimate={estimate}
        formData={formData}
        defaultCurrency={company.baseCurrency}
      />
    </div>
  );
}

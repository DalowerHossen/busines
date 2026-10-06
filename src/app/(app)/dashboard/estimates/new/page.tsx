// src/app/(app)/dashboard/estimates/new/page.tsx
// Writing a new quotation. It is saved as a draft first, so nothing is
// numbered or sent until you say so.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { EstimateForm } from '@/components/estimates/estimate-form';
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
  title: 'New estimate',
  description: 'Write a quotation and save it as a draft before sending it.',
  path: `${ROUTES.estimates}/new`,
  noIndex: true,
});

/**
 * Renders the new estimate page.
 *
 * @returns The rendered page.
 */
export default async function NewEstimatePage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company || !can(user, 'estimates', 'create')) {
    return (
      <>
        <PageHeader
          title="New estimate"
          description="You cannot write quotations in this business."
        />
        <Alert tone="warning" title="You cannot write an estimate">
          Ask the owner of this business to give your account permission to create estimates.
        </Alert>
      </>
    );
  }

  const formData = await loadInvoiceFormData(company.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New estimate"
        description="Saved as a draft. The number is assigned only when the quotation goes out."
        breadcrumbs={[{ label: 'Estimates', href: ROUTES.estimates }, { label: 'New estimate' }]}
      />

      <EstimateForm formData={formData} defaultCurrency={company.baseCurrency} />
    </div>
  );
}

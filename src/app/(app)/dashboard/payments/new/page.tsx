// src/app/(app)/dashboard/payments/new/page.tsx
// Recording money that has arrived, either against an invoice or on account.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PaymentForm } from '@/components/payments/payment-form';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadOpenInvoices } from '@/features/payments/queries/open-invoices';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Record a payment',
  description: 'Put money that has arrived against the invoice it settles.',
  path: `${ROUTES.payments}/new`,
  noIndex: true,
});

export interface NewPaymentPageProps {
  /** Query values read from the address bar. */
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * Renders the record payment page.
 *
 * @param props The search parameters of the request.
 * @returns The rendered page.
 */
export default async function NewPaymentPage({ searchParams }: NewPaymentPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Record a payment"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'payments', 'create')) {
    return (
      <>
        <PageHeader
          title="Record a payment"
          description="You do not have permission to record money."
        />
        <Alert tone="warning" title="You cannot record payments">
          Ask the owner of this business to give your account permission to record payments.
        </Alert>
      </>
    );
  }

  const formData = await loadOpenInvoices(company.id);
  const invoiceParam = searchParams['invoice'];
  const preselectedInvoiceId = typeof invoiceParam === 'string' ? invoiceParam : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Record a payment"
        description="Enter what arrived and against which invoice. The balance is settled as soon as you save."
      />

      <PaymentForm
        invoices={formData.invoices}
        preselectedInvoiceId={preselectedInvoiceId}
        defaultCurrency={company.baseCurrency}
      />
    </div>
  );
}

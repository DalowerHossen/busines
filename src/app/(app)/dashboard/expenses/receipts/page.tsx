// src/app/(app)/dashboard/expenses/receipts/page.tsx
// Receipts: photograph the paper, let the reader pull the figures out, then
// check them before anything is posted.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ExpensesNav } from '@/components/receipts/expenses-nav';
import { ReceiptReviewQueue } from '@/components/receipts/receipt-review-queue';
import { ReceiptSummary } from '@/components/receipts/receipt-summary';
import { ReceiptUploader } from '@/components/receipts/receipt-uploader';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadReceipts } from '@/features/receipts/queries/list-receipts';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Receipts',
  description: 'Photograph a receipt and let the figures be read for you.',
  path: `${ROUTES.expenses}/receipts`,
  noIndex: true,
});

/**
 * Renders the receipts page.
 *
 * @returns The rendered page.
 */
export default async function ReceiptsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Receipts"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'expenses', 'view')) {
    return (
      <>
        <PageHeader
          title="Receipts"
          description="You do not have access to the spending records."
        />
        <Alert tone="warning" title="You cannot see the spending records">
          Ask the owner of this business to give your account permission to view expenses.
        </Alert>
      </>
    );
  }

  const { receipts, counts, isDegraded } = await loadReceipts(company.id);
  const canDecide = !company.isReadOnly && can(user, 'expenses', 'edit');
  const canUpload = !company.isReadOnly && can(user, 'expenses', 'create');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receipts"
        description="Send the paper in once. The merchant, date and figures are read for you, the fields the reader was unsure about are marked, and nothing becomes an expense until you have agreed with it."
      />

      <ExpensesNav />

      {isDegraded ? (
        <Alert tone="warning" title="The receipts could not be read">
          Nothing has been changed. Try again in a moment before you accept anything.
        </Alert>
      ) : null}

      <ReceiptSummary counts={counts} />

      <ReceiptUploader canUpload={canUpload} />

      <ReceiptReviewQueue receipts={receipts} canDecide={canDecide} />
    </div>
  );
}

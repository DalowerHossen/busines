// src/app/(app)/dashboard/expenses/receipts/[scanId]/page.tsx
// One receipt in full: every field the reader filled in, every item it found,
// and the text it worked from, so a disputed figure can be checked.

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { ReceiptDetail } from '@/components/receipts/receipt-detail';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadReceipt } from '@/features/receipts/queries/get-receipt';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Receipt',
  description: 'Everything that was read from one receipt.',
  path: `${ROUTES.expenses}/receipts`,
  noIndex: true,
});

export interface ReceiptPageProps {
  /** The address of the receipt being looked at. */
  params: { scanId: string };
}

/**
 * Renders one receipt.
 *
 * @param props The receipt being looked at.
 * @returns The rendered page.
 */
export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader title="Receipt" description="This account is not attached to a business yet." />
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
        <PageHeader title="Receipt" description="You do not have access to the spending records." />
        <Alert tone="warning" title="You cannot see the spending records">
          Ask the owner of this business to give your account permission to view expenses.
        </Alert>
      </>
    );
  }

  const receipt = await loadReceipt(params.scanId);

  if (receipt === null) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={receipt.merchantName ?? receipt.fileName}
        description="Everything the reader found on this receipt, and the text it worked from."
      />

      <ReceiptDetail receipt={receipt} />
    </div>
  );
}

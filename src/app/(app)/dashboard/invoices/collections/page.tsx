// src/app/(app)/dashboard/invoices/collections/page.tsx
// What is late, how it is chased, and who has promised to pay.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BulkChasePanel } from '@/components/invoices/bulk-chase-panel';
import { CollectionsConsole } from '@/components/invoices/collections-console';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadCollectionsBoard } from '@/features/collections/queries/get-collections';
import { loadChaseableInvoices } from '@/features/collections/queries/list-chaseable';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Getting paid on time',
  description: 'What is late, how it is chased and who has promised to pay.',
  path: '/dashboard/invoices/collections',
  noIndex: true,
});

/**
 * Renders the collections screen.
 *
 * @returns The rendered page.
 */
export default async function CollectionsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Getting paid on time"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </div>
    );
  }

  if (!can(user, 'invoices', 'view')) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Getting paid on time"
          description="You do not have access to the invoice book."
        />
        <Alert tone="warning" title="You cannot see this">
          Ask the owner of this business to give your account permission to view invoices.
        </Alert>
      </div>
    );
  }

  const [board, chaseable] = await Promise.all([
    loadCollectionsBoard(company.id),
    loadChaseableInvoices(company.id),
  ]);
  const isOwner = (user.role === 'owner' || user.role === 'super_admin') && !company.isReadOnly;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Getting paid on time"
        description="Reminders are timed in your client's time zone and never arrive inside quiet hours. A client who has promised a date is left alone until it passes."
      />

      {board.isDegraded ? (
        <Alert tone="warning" title="This could not be read">
          Nothing has been sent or changed. Reload in a moment.
        </Alert>
      ) : (
        <>
          <BulkChasePanel invoices={chaseable.invoices} isOwner={isOwner} />

          <CollectionsConsole
            summary={board.summary}
            rules={board.rules}
            promises={board.promises}
            isOwner={isOwner}
            currency={company.baseCurrency}
          />
        </>
      )}
    </div>
  );
}

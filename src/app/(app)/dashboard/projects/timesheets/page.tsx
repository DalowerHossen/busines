// src/app/(app)/dashboard/projects/timesheets/page.tsx
// Weeks of work waiting to be approved, and the retainers they draw on.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { TimesheetConsole } from '@/components/projects/timesheet-console';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadInvoiceFormData } from '@/features/invoices/queries/invoice-form-data';
import { loadTimesheetBoard } from '@/features/timesheets/queries/get-timesheets';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Timesheets',
  description: 'Hand in a week of work, approve somebody else, and run your retainers.',
  path: '/dashboard/projects/timesheets',
  noIndex: true,
});

/**
 * Renders the timesheet screen.
 *
 * @returns The rendered page.
 */
export default async function TimesheetsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Timesheets"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </div>
    );
  }

  if (!can(user, 'clients', 'view')) {
    return (
      <div className="space-y-6">
        <PageHeader title="Timesheets" description="You do not have access to the work book." />
        <Alert tone="warning" title="You cannot see timesheets">
          Ask the owner of this business to give your account permission to view clients.
        </Alert>
      </div>
    );
  }

  const [board, formData] = await Promise.all([
    loadTimesheetBoard(company.id, user.id),
    loadInvoiceFormData(company.id),
  ]);

  const clients = formData.clients.map((client) => ({ id: client.id, name: client.name }));
  const isOwner = (user.role === 'owner' || user.role === 'super_admin') && !company.isReadOnly;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheets"
        description="Hours are handed in by whoever worked them and approved by somebody else. Only approved hours can be invoiced."
      />

      {board.isDegraded ? (
        <Alert tone="warning" title="This could not be read">
          No hours have been lost. Reload in a moment before approving anything.
        </Alert>
      ) : (
        <TimesheetConsole
          timesheets={board.timesheets}
          retainers={board.retainers}
          clients={clients}
          isOwner={isOwner}
          currency={company.baseCurrency}
        />
      )}
    </div>
  );
}

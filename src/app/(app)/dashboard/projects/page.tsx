// src/app/(app)/dashboard/projects/page.tsx
// The work this business has on, and the clock running against it.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ProjectBoard } from '@/components/projects/project-board';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadInvoiceFormData } from '@/features/invoices/queries/invoice-form-data';
import { loadProjectBoard } from '@/features/projects/queries/list-projects';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Projects',
  description: 'The work you have on, the hours against it and what is left to bill.',
  path: '/dashboard/projects',
  noIndex: true,
});

/**
 * Renders the project board.
 *
 * @returns The rendered page.
 */
export default async function ProjectsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Projects"
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
        <PageHeader title="Projects" description="You do not have access to the work book." />
        <Alert tone="warning" title="You cannot see projects">
          Ask the owner of this business to give your account permission to view clients.
        </Alert>
      </div>
    );
  }

  const [board, formData] = await Promise.all([
    loadProjectBoard(company.id, user.id),
    loadInvoiceFormData(company.id),
  ]);

  const clients = formData.clients.map((client) => ({ id: client.id, name: client.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Hours logged here become invoice lines with the work described in your own words. Nothing is billed until you say so."
      />

      {board.isDegraded ? (
        <Alert tone="warning" title="Your projects could not be read">
          No time has been lost. Reload in a moment before starting a clock.
        </Alert>
      ) : (
        <ProjectBoard
          projects={board.projects}
          runningEntry={board.runningEntry}
          clients={clients}
          canEdit={can(user, 'clients', 'edit') && !company.isReadOnly}
          currency={company.baseCurrency}
        />
      )}
    </div>
  );
}

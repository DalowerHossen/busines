// src/app/(app)/dashboard/subscriptions/new/page.tsx
// Setting up a new recurring arrangement. It is created on hold, so the first
// invoice only goes out once you start it.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ScheduleForm } from '@/components/recurring/schedule-form';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadScheduleFormData } from '@/features/recurring/queries/schedule-form-data';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'New recurring schedule',
  description: 'Bill a client the same amount on a regular rhythm.',
  path: `${ROUTES.subscriptions}/new`,
  noIndex: true,
});

/**
 * Renders the new schedule page.
 *
 * @returns The rendered page.
 */
export default async function NewSchedulePage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company || !can(user, 'subscriptions', 'create')) {
    return (
      <>
        <PageHeader
          title="New recurring schedule"
          description="You cannot set up recurring billing in this business."
        />
        <Alert tone="warning" title="You cannot create a schedule">
          Ask the owner of this business to give your account permission to manage recurring
          billing.
        </Alert>
      </>
    );
  }

  const formData = await loadScheduleFormData(company.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New recurring schedule"
        description="Created on hold. Nothing is billed until you start it."
        breadcrumbs={[
          { label: 'Recurring billing', href: ROUTES.subscriptions },
          { label: 'New schedule' },
        ]}
      />

      <ScheduleForm formData={formData} />
    </div>
  );
}

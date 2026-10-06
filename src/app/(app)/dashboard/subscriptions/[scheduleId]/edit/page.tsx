// src/app/(app)/dashboard/subscriptions/[scheduleId]/edit/page.tsx
// Changing a recurring arrangement. Invoices already produced keep the terms
// they were raised on.

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { ScheduleForm } from '@/components/recurring/schedule-form';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { getSchedule } from '@/features/recurring/queries/get-schedule';
import { loadScheduleFormData } from '@/features/recurring/queries/schedule-form-data';
import { isEditableSchedule } from '@/features/recurring/status';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Edit recurring schedule',
  description: 'Change what a recurring arrangement bills and how often.',
  path: ROUTES.subscriptions,
  noIndex: true,
});

export interface EditSchedulePageProps {
  /** Route parameters of the request. */
  params: { scheduleId: string };
}

/**
 * Renders the schedule edit page.
 *
 * @param props The route parameters of the request.
 * @returns The rendered page.
 */
export default async function EditSchedulePage({ params }: EditSchedulePageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company || !can(user, 'subscriptions', 'edit')) {
    return (
      <>
        <PageHeader
          title="Edit recurring schedule"
          description="You cannot change recurring billing in this business."
        />
        <Alert tone="warning" title="You cannot edit this schedule">
          Ask the owner of this business to give your account permission to manage recurring
          billing.
        </Alert>
      </>
    );
  }

  const schedule = await getSchedule(company.id, params.scheduleId);

  if (schedule === null) {
    notFound();
  }

  if (!isEditableSchedule(schedule.status) || schedule.isDeleted) {
    return (
      <>
        <PageHeader
          title={schedule.name}
          description="This schedule can no longer be changed."
          breadcrumbs={[
            { label: 'Recurring billing', href: ROUTES.subscriptions },
            { label: schedule.name, href: `${ROUTES.subscriptions}/${schedule.id}` },
            { label: 'Edit' },
          ]}
        />
        <Alert tone="warning" title="This schedule is closed">
          A stopped or finished schedule keeps its history exactly as it was. Set up a new schedule
          to bill this client again.
        </Alert>
      </>
    );
  }

  const formData = await loadScheduleFormData(company.id, schedule.templateInvoiceId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${schedule.name}`}
        description="Changes apply from the next invoice onwards."
        breadcrumbs={[
          { label: 'Recurring billing', href: ROUTES.subscriptions },
          { label: schedule.name, href: `${ROUTES.subscriptions}/${schedule.id}` },
          { label: 'Edit' },
        ]}
      />

      <ScheduleForm schedule={schedule} formData={formData} />
    </div>
  );
}

// src/app/(app)/dashboard/subscriptions/[scheduleId]/page.tsx
// One recurring arrangement: what it bills, when the next invoice goes out,
// and how much of it has already run.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ScheduleActionsBar } from '@/components/recurring/schedule-actions-bar';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { getSchedule } from '@/features/recurring/queries/get-schedule';
import {
  SCHEDULE_STATUS_LABELS,
  describeCadence,
  describeScheduleStatus,
} from '@/features/recurring/status';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney, formatNumber } from '@/lib/format';
import { buildMetadata } from '@/lib/seo/metadata';
import type { RecurringScheduleStatus } from '@/types/enums';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Recurring schedule',
  description: 'One recurring billing arrangement and the invoices it has produced.',
  path: ROUTES.subscriptions,
  noIndex: true,
});

const STATUS_TONES: Record<RecurringScheduleStatus, 'success' | 'warning' | 'neutral' | 'brand'> = {
  draft: 'neutral',
  active: 'success',
  paused: 'warning',
  completed: 'brand',
  cancelled: 'neutral',
};

export interface SchedulePageProps {
  /** Route parameters of the request. */
  params: { scheduleId: string };
}

/**
 * Renders one recurring schedule.
 *
 * @param props The route parameters of the request.
 * @returns The rendered page.
 */
export default async function SchedulePage({ params }: SchedulePageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Recurring schedule"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'subscriptions', 'view')) {
    return (
      <>
        <PageHeader
          title="Recurring schedule"
          description="You do not have access to the recurring arrangements."
        />
        <Alert tone="warning" title="You cannot see recurring billing">
          Ask the owner of this business to give your account permission to view recurring billing.
        </Alert>
      </>
    );
  }

  const schedule = await getSchedule(company.id, params.scheduleId);

  if (schedule === null) {
    notFound();
  }

  const cadence = describeCadence(
    schedule.frequency,
    schedule.intervalCount,
    schedule.customIntervalDays
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={schedule.name}
        description={describeScheduleStatus(schedule.status)}
        breadcrumbs={[
          { label: 'Recurring billing', href: ROUTES.subscriptions },
          { label: schedule.name },
        ]}
        actions={
          <ScheduleActionsBar
            schedule={schedule}
            canEdit={can(user, 'subscriptions', 'edit')}
            canCreateInvoice={can(user, 'invoices', 'create')}
          />
        }
      />

      {schedule.isDeleted ? (
        <Alert tone="warning" title="This schedule has been deleted">
          It no longer produces invoices. Restore it from the deleted list if it was removed by
          mistake.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>The arrangement</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Client</dt>
                <dd className="font-medium text-foreground">{schedule.clientName}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Status</dt>
                <dd>
                  <Badge tone={STATUS_TONES[schedule.status]}>
                    {SCHEDULE_STATUS_LABELS[schedule.status]}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Each run</dt>
                <dd className="tabular font-medium text-foreground">
                  {formatMoney(schedule.amount, schedule.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">How often</dt>
                <dd className="text-foreground">{cadence}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">First invoice</dt>
                <dd className="text-foreground">{formatDate(schedule.startDate)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Last invoice</dt>
                <dd className="text-foreground">
                  {schedule.endDate === null ? 'No end date' : formatDate(schedule.endDate)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Payment terms</dt>
                <dd className="text-foreground">
                  {schedule.paymentTermsDays === 0
                    ? 'Due on receipt'
                    : `${formatNumber(schedule.paymentTermsDays)} days`}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Prepared early by</dt>
                <dd className="text-foreground">
                  {schedule.daysBeforeToCreate === 0
                    ? 'Raised on the day'
                    : `${formatNumber(schedule.daysBeforeToCreate)} days`}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">On each run</dt>
                <dd className="text-foreground">
                  {schedule.autoIssue ? 'Issued automatically' : 'Left as a draft to review'}
                  {schedule.autoSend ? ' and emailed to the client' : ''}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Time zone</dt>
                <dd className="text-foreground">{schedule.timeZone}</dd>
              </div>
            </dl>

            {schedule.notes === null ? null : (
              <div className="mt-6 rounded-lg bg-surface-muted p-4">
                <h3 className="text-sm font-medium text-foreground">Internal notes</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                  {schedule.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-muted-foreground">Invoices produced</dt>
                <dd className="tabular text-2xl font-semibold text-foreground">
                  {formatNumber(schedule.occurrencesGenerated)}
                  {schedule.maxOccurrences === null
                    ? ''
                    : ` of ${formatNumber(schedule.maxOccurrences)}`}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Next invoice</dt>
                <dd className="text-foreground">
                  {schedule.nextRunDate === null
                    ? 'Not scheduled'
                    : formatDate(schedule.nextRunDate)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Last run</dt>
                <dd className="text-foreground">
                  {schedule.lastRunDate === null ? 'Not run yet' : formatDate(schedule.lastRunDate)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Template invoice</dt>
                <dd>
                  <Link
                    href={`${ROUTES.invoices}/${schedule.templateInvoiceId}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Open the template
                  </Link>
                </dd>
              </div>
              {schedule.lastGeneratedInvoiceId === null ? null : (
                <div>
                  <dt className="text-sm text-muted-foreground">Most recent invoice</dt>
                  <dd>
                    <Link
                      href={`${ROUTES.invoices}/${schedule.lastGeneratedInvoiceId}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Open the latest invoice
                    </Link>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-muted-foreground">Set up</dt>
                <dd className="text-foreground">{formatDateTime(schedule.createdAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// src/app/(app)/dashboard/subscriptions/page.tsx
// Recurring billing: the retainers and subscriptions that raise their own
// invoices on time, period after period.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ScheduleFilters } from '@/components/recurring/schedule-filters';
import { ScheduleSummaryStrip } from '@/components/recurring/schedule-summary-strip';
import { ScheduleTable } from '@/components/recurring/schedule-table';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadInvoiceFormData } from '@/features/invoices/queries/invoice-form-data';
import { listSchedules, summariseSchedules } from '@/features/recurring/queries/list-schedules';
import { scheduleListFiltersSchema } from '@/features/recurring/validation/schedule';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { todayIso } from '@/lib/dates';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';
import { parseListQuery } from '@/lib/validation/pagination';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Recurring billing',
  description: 'Retainers and subscriptions that invoice themselves on schedule.',
  path: ROUTES.subscriptions,
  noIndex: true,
});

export interface SubscriptionsPageProps {
  /** Filters and paging read from the address bar. */
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * Reads one search parameter as text.
 *
 * @param value Raw value from the address bar.
 * @returns The text, or undefined when it is not a single value.
 */
function readParam(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Renders the recurring billing list.
 *
 * @param props The search parameters of the request.
 * @returns The rendered page.
 */
export default async function SubscriptionsPage({ searchParams }: SubscriptionsPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Recurring billing"
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
          title="Recurring billing"
          description="You do not have access to the recurring arrangements."
        />
        <Alert tone="warning" title="You cannot see recurring billing">
          Ask the owner of this business to give your account permission to view recurring billing.
        </Alert>
      </>
    );
  }

  const query = parseListQuery({
    page: readParam(searchParams['page']),
    pageSize: readParam(searchParams['pageSize']),
    search: readParam(searchParams['search']),
    sortBy: readParam(searchParams['sortBy']),
  });

  const parsedFilters = scheduleListFiltersSchema.safeParse({
    search: readParam(searchParams['search']),
    status: readParam(searchParams['status']),
    clientId: readParam(searchParams['client']),
    includeDeleted: readParam(searchParams['deleted']),
  });

  const filters = parsedFilters.success
    ? {
        search: parsedFilters.data.search,
        status: parsedFilters.data.status,
        clientId: parsedFilters.data.clientId,
        includeDeleted: parsedFilters.data.includeDeleted,
      }
    : { search: null, status: null, clientId: null, includeDeleted: false };

  const [page, totals, formData] = await Promise.all([
    listSchedules(company.id, query, filters),
    summariseSchedules(company.id, company.baseCurrency, todayIso()),
    loadInvoiceFormData(company.id),
  ]);

  const canCreate = can(user, 'subscriptions', 'create');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurring billing"
        description="Agree the amount once. The invoice goes out on the same day every period, with no reminder needed."
        actions={
          canCreate ? (
            <Link
              href={`${ROUTES.subscriptions}/new`}
              className={cn(buttonVariants({ variant: 'primary' }))}
            >
              New schedule
            </Link>
          ) : null
        }
      />

      {page.isDegraded ? (
        <Alert tone="warning" title="The schedule list could not be read">
          Nothing has been lost, and no billing has been missed. Refresh the page in a moment.
        </Alert>
      ) : null}

      <ScheduleSummaryStrip totals={totals} />

      <ScheduleFilters
        search={filters.search}
        status={filters.status}
        clientId={filters.clientId}
        clients={formData.clients}
        includeDeleted={filters.includeDeleted}
      />

      <ScheduleTable
        schedules={page.items}
        totalCount={page.totalCount}
        page={page.page}
        pageSize={page.pageSize}
        isFiltered={
          filters.search !== null ||
          filters.status !== null ||
          filters.clientId !== null ||
          filters.includeDeleted
        }
        canEdit={can(user, 'subscriptions', 'edit')}
        canDelete={can(user, 'subscriptions', 'delete')}
        canCreate={canCreate}
      />
    </div>
  );
}

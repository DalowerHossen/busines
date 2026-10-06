// src/app/(app)/dashboard/estimates/page.tsx
// The quotation book: what has been offered, what the client is still
// thinking about and what has been accepted.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { EstimateFilters } from '@/components/estimates/estimate-filters';
import { EstimateSummaryStrip } from '@/components/estimates/estimate-summary-strip';
import { EstimateTable } from '@/components/estimates/estimate-table';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { listEstimates, summariseEstimates } from '@/features/estimates/queries/list-estimates';
import { estimateListFiltersSchema } from '@/features/estimates/validation/estimate';
import { loadInvoiceFormData } from '@/features/invoices/queries/invoice-form-data';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { todayIso } from '@/lib/dates';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';
import { parseListQuery } from '@/lib/validation/pagination';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Estimates',
  description: 'Every quotation this company has written, and where each one stands.',
  path: ROUTES.estimates,
  noIndex: true,
});

export interface EstimatesPageProps {
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
 * Renders the estimate list.
 *
 * @param props The search parameters of the request.
 * @returns The rendered page.
 */
export default async function EstimatesPage({ searchParams }: EstimatesPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Estimates"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'estimates', 'view')) {
    return (
      <>
        <PageHeader title="Estimates" description="You do not have access to the quotations." />
        <Alert tone="warning" title="You cannot see estimates">
          Ask the owner of this business to give your account permission to view estimates.
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

  const parsedFilters = estimateListFiltersSchema.safeParse({
    search: readParam(searchParams['search']),
    status: readParam(searchParams['status']),
    clientId: readParam(searchParams['client']),
    fromDate: readParam(searchParams['from']),
    toDate: readParam(searchParams['to']),
    includeDeleted: readParam(searchParams['deleted']),
  });

  const filters = parsedFilters.success
    ? {
        search: parsedFilters.data.search,
        status: parsedFilters.data.status,
        clientId: parsedFilters.data.clientId,
        fromDate: parsedFilters.data.fromDate,
        toDate: parsedFilters.data.toDate,
        includeDeleted: parsedFilters.data.includeDeleted,
      }
    : {
        search: null,
        status: null,
        clientId: null,
        fromDate: null,
        toDate: null,
        includeDeleted: false,
      };

  const [page, totals, formData] = await Promise.all([
    listEstimates(company.id, query, filters),
    summariseEstimates(company.id, company.baseCurrency, todayIso()),
    loadInvoiceFormData(company.id),
  ]);

  const canCreate = can(user, 'estimates', 'create');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estimates"
        description="Quote the work, send it, and turn it into an invoice the moment the client agrees."
        actions={
          canCreate ? (
            <Link
              href={`${ROUTES.estimates}/new`}
              className={cn(buttonVariants({ variant: 'primary' }))}
            >
              New estimate
            </Link>
          ) : null
        }
      />

      {page.isDegraded ? (
        <Alert tone="warning" title="The estimate list could not be read">
          Nothing has been lost. Refresh the page in a moment and the list will come back.
        </Alert>
      ) : null}

      <EstimateSummaryStrip totals={totals} />

      <EstimateFilters
        search={filters.search}
        status={filters.status}
        clientId={filters.clientId}
        fromDate={filters.fromDate}
        toDate={filters.toDate}
        clients={formData.clients}
        includeDeleted={filters.includeDeleted}
      />

      <EstimateTable
        estimates={page.items}
        totalCount={page.totalCount}
        page={page.page}
        pageSize={page.pageSize}
        isFiltered={
          filters.search !== null ||
          filters.status !== null ||
          filters.clientId !== null ||
          filters.fromDate !== null ||
          filters.toDate !== null ||
          filters.includeDeleted
        }
        canEdit={can(user, 'estimates', 'edit')}
        canDelete={can(user, 'estimates', 'delete')}
        canCreate={canCreate}
      />
    </div>
  );
}

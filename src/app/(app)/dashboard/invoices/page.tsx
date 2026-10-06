// src/app/(app)/dashboard/invoices/page.tsx
// The invoice book: what has been raised, what is still owed and what is late.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { InvoiceFilters } from '@/components/invoices/invoice-filters';
import { InvoiceSummaryStrip } from '@/components/invoices/invoice-summary-strip';
import { InvoiceTable } from '@/components/invoices/invoice-table';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadInvoiceFormData } from '@/features/invoices/queries/invoice-form-data';
import { listInvoices, summariseInvoices } from '@/features/invoices/queries/list-invoices';
import { invoiceListFiltersSchema } from '@/features/invoices/validation/invoice';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { todayIso } from '@/lib/dates';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';
import { parseListQuery } from '@/lib/validation/pagination';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Invoices',
  description: 'Everything this company has billed, and what is still owed.',
  path: ROUTES.invoices,
  noIndex: true,
});

export interface InvoicesPageProps {
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
 * Renders the invoice list.
 *
 * @param props The search parameters of the request.
 * @returns The rendered page.
 */
export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Invoices"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'invoices', 'view')) {
    return (
      <>
        <PageHeader title="Invoices" description="You do not have access to the invoice book." />
        <Alert tone="warning" title="You cannot see invoices">
          Ask the owner of this business to give your account permission to view invoices.
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

  const parsedFilters = invoiceListFiltersSchema.safeParse({
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
    listInvoices(company.id, query, filters),
    summariseInvoices(company.id, company.baseCurrency, todayIso()),
    loadInvoiceFormData(company.id),
  ]);

  const canCreate = can(user, 'invoices', 'create');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Raise it, issue it, get paid. Every issued invoice is locked and numbered in sequence."
        actions={
          canCreate ? (
            <Link
              href={`${ROUTES.invoices}/new`}
              className={cn(buttonVariants({ variant: 'primary' }))}
            >
              New invoice
            </Link>
          ) : null
        }
      />

      {page.isDegraded ? (
        <Alert tone="warning" title="The invoice list could not be read">
          Nothing has been lost. Refresh the page in a moment and the list will come back.
        </Alert>
      ) : null}

      <InvoiceSummaryStrip totals={totals} />

      <InvoiceFilters
        search={filters.search}
        status={filters.status}
        clientId={filters.clientId}
        fromDate={filters.fromDate}
        toDate={filters.toDate}
        clients={formData.clients}
        includeDeleted={filters.includeDeleted}
      />

      <InvoiceTable
        invoices={page.items}
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
        canEdit={can(user, 'invoices', 'edit')}
        canDelete={can(user, 'invoices', 'delete')}
        canCreate={canCreate}
      />
    </div>
  );
}

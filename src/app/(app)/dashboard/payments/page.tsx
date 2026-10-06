// src/app/(app)/dashboard/payments/page.tsx
// The money that has come in: what arrived, where it was applied and what is
// still sitting unmatched.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PaymentFilters } from '@/components/payments/payment-filters';
import { PaymentsNav } from '@/components/payments/payments-nav';
import { PaymentSummaryStrip } from '@/components/payments/payment-summary-strip';
import { PaymentTable } from '@/components/payments/payment-table';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { listPayments, summarisePayments } from '@/features/payments/queries/list-payments';
import { loadPaymentClients } from '@/features/payments/queries/payment-clients';
import { paymentListFiltersSchema } from '@/features/payments/validation/payment';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { todayIso } from '@/lib/dates';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';
import { parseListQuery } from '@/lib/validation/pagination';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Payments',
  description: 'Every payment this company has received, and what it settled.',
  path: ROUTES.payments,
  noIndex: true,
});

export interface PaymentsPageProps {
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
 * Renders the payment list.
 *
 * @param props The search parameters of the request.
 * @returns The rendered page.
 */
export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Payments"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'payments', 'view')) {
    return (
      <>
        <PageHeader title="Payments" description="You do not have access to the payment record." />
        <Alert tone="warning" title="You cannot see payments">
          Ask the owner of this business to give your account permission to view payments.
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

  const parsedFilters = paymentListFiltersSchema.safeParse({
    search: readParam(searchParams['search']),
    clientId: readParam(searchParams['clientId']),
    methodType: readParam(searchParams['methodType']),
    fromDate: readParam(searchParams['fromDate']),
    toDate: readParam(searchParams['toDate']),
    onlyUnallocated: readParam(searchParams['onlyUnallocated']),
    includeDeleted: readParam(searchParams['includeDeleted']),
  });

  const filters = parsedFilters.success
    ? {
        search: parsedFilters.data.search,
        clientId: parsedFilters.data.clientId,
        methodType: parsedFilters.data.methodType,
        fromDate: parsedFilters.data.fromDate,
        toDate: parsedFilters.data.toDate,
        onlyUnallocated: parsedFilters.data.onlyUnallocated,
        includeDeleted: parsedFilters.data.includeDeleted,
      }
    : {
        search: null,
        clientId: null,
        methodType: null,
        fromDate: null,
        toDate: null,
        onlyUnallocated: false,
        includeDeleted: false,
      };

  const monthStart = `${todayIso().slice(0, 7)}-01`;

  const [page, totals, clients] = await Promise.all([
    listPayments(company.id, query, filters),
    summarisePayments(company.id, company.baseCurrency, monthStart),
    loadPaymentClients(company.id),
  ]);

  const canCreate = can(user, 'payments', 'create');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Record what has come in and apply it to the right invoice. Balances update the moment money is matched."
        actions={
          canCreate ? (
            <Link
              href={`${ROUTES.payments}/new`}
              className={cn(buttonVariants({ variant: 'primary' }))}
            >
              Record payment
            </Link>
          ) : null
        }
      />

      <PaymentsNav />

      {page.isDegraded ? (
        <Alert tone="warning" title="The payment list could not be read">
          Nothing has been lost. Refresh the page in a moment and the list will come back.
        </Alert>
      ) : null}

      <PaymentSummaryStrip totals={totals} />

      <PaymentFilters
        search={filters.search}
        clientId={filters.clientId}
        methodType={filters.methodType}
        fromDate={filters.fromDate}
        toDate={filters.toDate}
        onlyUnallocated={filters.onlyUnallocated}
        includeDeleted={filters.includeDeleted}
        clients={clients}
      />

      <PaymentTable
        payments={page.items}
        totalCount={page.totalCount}
        page={page.page}
        pageSize={page.pageSize}
        isFiltered={
          filters.search !== null ||
          filters.clientId !== null ||
          filters.methodType !== null ||
          filters.fromDate !== null ||
          filters.toDate !== null ||
          filters.onlyUnallocated ||
          filters.includeDeleted
        }
        canCreate={canCreate}
        canDelete={can(user, 'payments', 'delete')}
      />
    </div>
  );
}

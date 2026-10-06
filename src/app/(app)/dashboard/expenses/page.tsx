// src/app/(app)/dashboard/expenses/page.tsx
// What the business spent: receipts, supplier bills, claims waiting for
// approval and the costs that are recharged to a client.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ExpenseFilters } from '@/components/expenses/expense-filters';
import { ExpenseSummaryStrip } from '@/components/expenses/expense-summary-strip';
import { ExpenseTable } from '@/components/expenses/expense-table';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { ExpensesNav } from '@/components/receipts/expenses-nav';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadExpenseFormData } from '@/features/expenses/queries/expense-form-data';
import { listExpenses, summariseExpenses } from '@/features/expenses/queries/list-expenses';
import { expenseListFiltersSchema } from '@/features/expenses/validation/expense';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';
import { parseListQuery } from '@/lib/validation/pagination';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Expenses',
  description: 'Every cost this business has recorded, and where each claim stands.',
  path: ROUTES.expenses,
  noIndex: true,
});

export interface ExpensesPageProps {
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
 * Renders the expense list.
 *
 * @param props The search parameters of the request.
 * @returns The rendered page.
 */
export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Expenses"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'expenses', 'view')) {
    return (
      <>
        <PageHeader title="Expenses" description="You do not have access to the spending." />
        <Alert tone="warning" title="You cannot see expenses">
          Ask the owner of this business to give your account permission to view expenses.
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

  const parsedFilters = expenseListFiltersSchema.safeParse({
    search: readParam(searchParams['search']),
    status: readParam(searchParams['status']),
    vendorId: readParam(searchParams['vendor']),
    categoryId: readParam(searchParams['category']),
    fromDate: readParam(searchParams['from']),
    toDate: readParam(searchParams['to']),
    includeDeleted: readParam(searchParams['deleted']),
  });

  const filters = parsedFilters.success
    ? {
        search: parsedFilters.data.search,
        status: parsedFilters.data.status,
        vendorId: parsedFilters.data.vendorId,
        categoryId: parsedFilters.data.categoryId,
        fromDate: parsedFilters.data.fromDate,
        toDate: parsedFilters.data.toDate,
        includeDeleted: parsedFilters.data.includeDeleted,
      }
    : {
        search: null,
        status: null,
        vendorId: null,
        categoryId: null,
        fromDate: null,
        toDate: null,
        includeDeleted: false,
      };

  const [page, totals, formData] = await Promise.all([
    listExpenses(company.id, query, filters),
    summariseExpenses(company.id, company.baseCurrency),
    loadExpenseFormData(company.id),
  ]);

  const canCreate = can(user, 'expenses', 'create');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Keep every receipt, know what is still to pay, and recharge the costs that belong to a client."
        actions={
          canCreate ? (
            <Link
              href={`${ROUTES.expenses}/new`}
              className={cn(buttonVariants({ variant: 'primary' }))}
            >
              Record an expense
            </Link>
          ) : null
        }
      />

      <ExpensesNav />

      {page.isDegraded ? (
        <Alert tone="warning" title="The expense list could not be read">
          Nothing has been lost. Refresh the page in a moment and the list will come back.
        </Alert>
      ) : null}

      <ExpenseSummaryStrip totals={totals} />

      <ExpenseFilters
        search={filters.search}
        status={filters.status}
        vendorId={filters.vendorId}
        categoryId={filters.categoryId}
        fromDate={filters.fromDate}
        toDate={filters.toDate}
        vendors={formData.vendors}
        categories={formData.categories}
        includeDeleted={filters.includeDeleted}
      />

      <ExpenseTable
        expenses={page.items}
        totalCount={page.totalCount}
        page={page.page}
        pageSize={page.pageSize}
        isFiltered={
          filters.search !== null ||
          filters.status !== null ||
          filters.vendorId !== null ||
          filters.categoryId !== null ||
          filters.fromDate !== null ||
          filters.toDate !== null ||
          filters.includeDeleted
        }
        canEdit={can(user, 'expenses', 'edit')}
        canApprove={can(user, 'expenses', 'approve')}
        canDelete={can(user, 'expenses', 'delete')}
        canCreate={canCreate}
      />
    </div>
  );
}

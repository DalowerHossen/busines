// src/app/(app)/dashboard/clients/page.tsx
// The client book: every business and person this company bills, with search,
// status filters and the deleted list.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ClientFilters } from '@/components/clients/client-filters';
import { ClientSummaryStrip } from '@/components/clients/client-summary-strip';
import { ClientTable } from '@/components/clients/client-table';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { clientListFiltersSchema } from '@/features/clients/validation/client';
import { countClientsByStatus, listClients } from '@/features/clients/queries/list-clients';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';
import { parseListQuery } from '@/lib/validation/pagination';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Clients',
  description: 'The businesses and people this company bills.',
  path: ROUTES.clients,
  noIndex: true,
});

export interface ClientsPageProps {
  /** Filters and paging read from the address bar. */
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * Renders the client list.
 *
 * @param props The search parameters of the request.
 * @returns The rendered page.
 */
export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader title="Clients" description="This account is not attached to a business yet." />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  const canView = can(user, 'clients', 'view');

  if (!canView) {
    return (
      <>
        <PageHeader title="Clients" description="You do not have access to the client book." />
        <Alert tone="warning" title="You cannot see clients">
          Ask the owner of this business to give your account permission to view clients.
        </Alert>
      </>
    );
  }

  const query = parseListQuery({
    page: searchParams['page'],
    pageSize: searchParams['pageSize'],
    search: searchParams['search'],
    sortBy: searchParams['sortBy'],
    sortDirection: searchParams['sortDirection'] ?? 'asc',
  });

  const parsedFilters = clientListFiltersSchema.safeParse({
    search: typeof searchParams['search'] === 'string' ? searchParams['search'] : undefined,
    status: typeof searchParams['status'] === 'string' ? searchParams['status'] : undefined,
    includeDeleted:
      typeof searchParams['deleted'] === 'string' ? searchParams['deleted'] : undefined,
  });

  const filters = parsedFilters.success
    ? {
        search: parsedFilters.data.search,
        status: parsedFilters.data.status,
        includeDeleted: parsedFilters.data.includeDeleted,
      }
    : { search: null, status: null, includeDeleted: false };

  const [page, counts] = await Promise.all([
    listClients(company.id, query, filters),
    countClientsByStatus(company.id),
  ]);

  const canCreate = can(user, 'clients', 'create');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Everyone you bill, with the terms and tax details that fill an invoice in for you."
        actions={
          canCreate ? (
            <Link
              href={`${ROUTES.clients}/new`}
              className={cn(buttonVariants({ variant: 'primary' }))}
            >
              Add client
            </Link>
          ) : null
        }
      />

      {page.isDegraded ? (
        <Alert tone="warning" title="The client list could not be read">
          Nothing has been lost. Refresh the page in a moment and the list will come back.
        </Alert>
      ) : null}

      <ClientSummaryStrip counts={counts} />

      <ClientFilters
        search={filters.search}
        status={filters.status}
        includeDeleted={filters.includeDeleted}
      />

      <ClientTable
        clients={page.items}
        totalCount={page.totalCount}
        page={page.page}
        pageSize={page.pageSize}
        isFiltered={filters.search !== null || filters.status !== null || filters.includeDeleted}
        canEdit={can(user, 'clients', 'edit')}
        canDelete={can(user, 'clients', 'delete')}
      />
    </div>
  );
}

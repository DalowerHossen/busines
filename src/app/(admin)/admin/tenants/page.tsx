// src/app/(admin)/admin/tenants/page.tsx
// Every business on the platform, searchable and filterable by the two
// things support is usually chasing: their state and their identity checks.

import type { Metadata } from 'next';

import { TenantFilters } from '@/components/admin/tenant-filters';
import { TenantTable } from '@/components/admin/tenant-table';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { listTenants } from '@/features/admin/queries/list-tenants';
import type { TenantListFilters } from '@/features/admin/types';
import { buildMetadata } from '@/lib/seo/metadata';
import { parseListQuery } from '@/lib/validation/pagination';
import { COMPANY_STATUSES, KYC_STATUSES, type CompanyStatus, type KycStatus } from '@/types/enums';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Businesses',
  description: 'Every business using the platform.',
  path: '/admin/tenants',
  noIndex: true,
});

export interface AdminTenantsPageProps {
  /** Filters and paging read from the address bar. */
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * Reads one search parameter as a single string.
 *
 * @param value Raw value from the address bar.
 * @returns The value, or null when it is absent.
 */
function single(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value && value.length > 0 ? value : null;
}

/**
 * Renders the tenant list.
 *
 * @param props The search parameters of the request.
 * @returns The rendered page.
 */
export default async function AdminTenantsPage({ searchParams }: AdminTenantsPageProps) {
  const query = parseListQuery(searchParams);
  const rawStatus = single(searchParams['status']);
  const rawKyc = single(searchParams['kyc']);

  const filters: TenantListFilters = {
    search: query.search,
    status: COMPANY_STATUSES.includes(rawStatus as CompanyStatus)
      ? (rawStatus as CompanyStatus)
      : null,
    kycStatus: KYC_STATUSES.includes(rawKyc as KycStatus) ? (rawKyc as KycStatus) : null,
  };

  const result = await listTenants(query, filters);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Businesses"
        description="Open a business to see what it is worth, change its state or grant it an exception to its plan."
      />

      {result.isDegraded ? (
        <Alert tone="warning" title="The list could not be read">
          Nothing has been changed. Reload in a moment.
        </Alert>
      ) : null}

      <TenantFilters
        search={filters.search}
        status={filters.status}
        kycStatus={filters.kycStatus}
      />

      <TenantTable
        tenants={result.items}
        totalCount={result.totalCount}
        page={result.page}
        pageSize={result.pageSize}
      />
    </div>
  );
}

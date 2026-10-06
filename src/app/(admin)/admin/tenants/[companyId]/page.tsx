// src/app/(admin)/admin/tenants/[companyId]/page.tsx
// One business, seen from the platform side: what it is worth, who works in
// it, what state it is in and which exceptions it holds.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EntitlementManager } from '@/components/admin/entitlement-manager';
import { TenantStatusForm } from '@/components/admin/tenant-status-form';
import { TenantSummaryPanel } from '@/components/admin/tenant-summary-panel';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { getTenant } from '@/features/admin/queries/get-tenant';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Business',
  description: 'One business seen from the platform side.',
  path: '/admin/tenants',
  noIndex: true,
});

export interface AdminTenantPageProps {
  /** Route parameters of the request. */
  params: { companyId: string };
}

/**
 * Renders one tenant.
 *
 * @param props The route parameters of the request.
 * @returns The rendered page.
 */
export default async function AdminTenantPage({ params }: AdminTenantPageProps) {
  const detail = await getTenant(params.companyId);

  if (detail === null) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.tenant.displayName}
        description="Everything the platform knows about this business, and the two levers that change it."
        breadcrumbs={[
          { label: 'Platform console', href: '/admin' },
          { label: 'Businesses', href: '/admin/tenants' },
          { label: detail.tenant.displayName },
        ]}
      />

      {detail.isDegraded ? (
        <Alert tone="warning" title="Part of this page could not be read">
          The figures shown are incomplete. Reload before making a decision.
        </Alert>
      ) : null}

      <TenantSummaryPanel detail={detail} />

      <div className="grid gap-4 lg:grid-cols-2">
        <TenantStatusForm
          companyId={detail.tenant.id}
          status={detail.tenant.status}
          suspensionReason={detail.tenant.suspensionReason}
        />

        <EntitlementManager companyId={detail.tenant.id} overrides={detail.overrides} />
      </div>
    </div>
  );
}

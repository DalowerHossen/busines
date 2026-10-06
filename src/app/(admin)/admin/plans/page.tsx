// src/app/(admin)/admin/plans/page.tsx
// What the platform sells: the plans, their prices and the discount codes
// that can be claimed against them.

import type { Metadata } from 'next';

import { CouponManager } from '@/components/admin/coupon-manager';
import { PlanCatalogue } from '@/components/admin/plan-catalogue';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { loadPlanCatalogue } from '@/features/admin/queries/list-plans';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Plans and codes',
  description: 'The plans the platform sells and the discount codes it hands out.',
  path: '/admin/plans',
  noIndex: true,
});

/**
 * Renders the catalogue page.
 *
 * @returns The rendered page.
 */
export default async function AdminPlansPage() {
  const catalogue = await loadPlanCatalogue();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Plans and codes"
        description="Changing a plan takes effect the moment it is saved. Nobody already subscribed is repriced without a deliberate plan change on their account."
      />

      {catalogue.isDegraded ? (
        <Alert tone="warning" title="Part of the catalogue could not be read">
          Reload before you change anything, so you are not editing an incomplete picture.
        </Alert>
      ) : null}

      <PlanCatalogue plans={catalogue.plans} />

      <CouponManager coupons={catalogue.coupons} />
    </div>
  );
}

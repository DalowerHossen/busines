// src/app/(app)/dashboard/payments/instalments/[planId]/page.tsx
// One arrangement, its schedule, and the decisions still open on it.

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { InstalmentPlanPanel } from '@/components/instalments/instalment-plan-panel';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadInstalmentPlan } from '@/features/instalments/queries/get-plan';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export interface InstalmentPlanPageProps {
  /** The address of the arrangement being opened. */
  params: { planId: string };
}

export const metadata: Metadata = buildMetadata({
  title: 'Instalment plan',
  description: 'One instalment arrangement and every payment in its schedule.',
  path: `${ROUTES.payments}/instalments`,
  noIndex: true,
});

/**
 * Renders one arrangement.
 *
 * @param props The address of the arrangement.
 * @returns The rendered page.
 */
export default async function InstalmentPlanPage({ params }: InstalmentPlanPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Instalment plan"
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
        <PageHeader
          title="Instalment plan"
          description="You do not have access to the money pages."
        />
        <Alert tone="warning" title="You cannot see instalment plans">
          Ask the owner of this business to give your account permission to view payments.
        </Alert>
      </>
    );
  }

  const plan = await loadInstalmentPlan(params.planId);

  if (!plan) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={plan.planReference}
        description="The figures below were worked out when the client accepted and cannot drift afterwards. Payments are matched to the invoice as they arrive."
      />

      <InstalmentPlanPanel plan={plan} canDecide={user.role === 'owner' && !company.isReadOnly} />
    </div>
  );
}

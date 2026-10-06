// src/app/(app)/dashboard/billing/page.tsx
// What this business pays us: the plan it is on, what it has used of it, the
// plans it could move to, and every charge we have raised.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { CurrentPlanCard } from '@/components/billing/current-plan-card';
import { PlanPicker } from '@/components/billing/plan-picker';
import { PlatformInvoiceTable } from '@/components/billing/platform-invoice-table';
import { UsageMeters } from '@/components/billing/usage-meters';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadBillingOverview } from '@/features/billing/queries/get-billing-overview';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Plan and billing',
  description: 'The plan your business is on, what it has used, and what we have charged.',
  path: ROUTES.billing,
  noIndex: true,
});

/**
 * Renders the billing page.
 *
 * @returns The rendered page.
 */
export default async function BillingPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Plan and billing"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  const isOwner = user.role === 'owner' || user.role === 'super_admin';

  if (!isOwner) {
    return (
      <>
        <PageHeader
          title="Plan and billing"
          description="Only the owner of the business can see and change the plan."
        />
        <Alert tone="info" title="The plan is managed by the owner">
          Everything you need for your own work stays available. Ask the owner if an allowance needs
          raising.
        </Alert>
      </>
    );
  }

  const overview = await loadBillingOverview(company.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan and billing"
        description="Everything about what you pay us, in one place. No charge appears here without the period it covers and the fees it includes."
      />

      {overview.isDegraded ? (
        <Alert tone="warning" title="Part of this page could not be read">
          Nothing has been changed. Reload in a moment before making a decision about your plan.
        </Alert>
      ) : null}

      {overview.current === null ? (
        <Alert tone="info" title="No plan is attached to this business yet">
          Choose one below and it starts straight away. The free plan never expires and never asks
          for a card.
        </Alert>
      ) : (
        <CurrentPlanCard current={overview.current} canManage />
      )}

      <UsageMeters meters={overview.meters} />

      <PlanPicker
        plans={overview.plans}
        currentPlanId={overview.current?.planId ?? null}
        currentInterval={overview.current?.interval ?? 'monthly'}
        currency={overview.current?.currency ?? company.baseCurrency}
        canChange
      />

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">What we have charged you</h2>
        <PlatformInvoiceTable invoices={overview.invoices} />
      </section>
    </div>
  );
}

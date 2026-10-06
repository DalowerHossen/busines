// src/app/(app)/dashboard/settings/storefronts/page.tsx
// Where an online shop is wired to this account and watched afterwards.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SettingsNav } from '@/components/settings/settings-nav';
import { StorefrontManager } from '@/components/storefronts/storefront-manager';
import { StorefrontOrderTable } from '@/components/storefronts/storefront-order-table';
import { StorefrontSetupGuide } from '@/components/storefronts/storefront-setup-guide';
import { StorefrontSummary } from '@/components/storefronts/storefront-summary';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { absoluteUrl } from '@/env/client';
import { loadStorefrontBoard } from '@/features/storefronts/queries/list-connections';
import { loadStorefrontOrders } from '@/features/storefronts/queries/list-orders';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Online shop',
  description: 'Connect your online shop so its orders are invoiced and collected here.',
  path: `${ROUTES.settings}/storefronts`,
  noIndex: true,
});

/**
 * Renders the online shop settings.
 *
 * @returns The rendered page.
 */
export default async function StorefrontSettingsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Online shop"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </div>
    );
  }

  const canManage = user.role === 'owner' || user.role === 'super_admin';
  const [board, orders] = await Promise.all([
    loadStorefrontBoard(company.id),
    loadStorefrontOrders(company.id),
  ]);
  const baseUrl = absoluteUrl('/').replace(/\/+$/, '');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Online shop"
        description="Orders from your shop become invoices here, and the shopper pays on a page served by the payment provider itself."
      />

      <SettingsNav />

      {board.isDegraded ? (
        <Alert tone="warning" title="The shop list could not be read">
          Nothing has changed. Reload the page in a moment before you connect anything new.
        </Alert>
      ) : null}

      <StorefrontSummary overview={board.overview} currency={company.baseCurrency} />

      <StorefrontManager
        connections={board.connections}
        isVerified={board.overview.isVerified}
        canManage={canManage && !company.isReadOnly}
        currency={company.baseCurrency}
        baseUrl={baseUrl}
      />

      <Card>
        <CardHeader>
          <CardTitle>Orders from your shops</CardTitle>
          <CardDescription>
            The hundred most recent orders, newest first, with the invoice each one raised.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StorefrontOrderTable orders={orders} canManage={canManage && !company.isReadOnly} />
        </CardContent>
      </Card>

      <StorefrontSetupGuide baseUrl={baseUrl} />
    </div>
  );
}

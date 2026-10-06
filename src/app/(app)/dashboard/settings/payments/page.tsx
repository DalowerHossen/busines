// src/app/(app)/dashboard/settings/payments/page.tsx
// Payment settings: which providers this business can be paid through.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { GatewayList } from '@/components/gateways/gateway-list';
import { CardAcceptancePanel } from '@/components/payments/card-acceptance-panel';
import { PaymentRailPanel } from '@/components/payments/payment-rail-panel';
import { SettingsNav } from '@/components/settings/settings-nav';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadCheckoutPreferences } from '@/features/checkout/queries/get-preferences';
import { loadGatewayConnections } from '@/features/gateways/queries/list-gateways';
import { loadPaymentRails } from '@/features/payouts/queries/list-payment-rails';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Payment settings',
  description: 'Connect the providers your clients pay you through.',
  path: `${ROUTES.settings}/payments`,
  noIndex: true,
});

/**
 * Renders the payment settings.
 *
 * @returns The rendered page.
 */
export default async function PaymentSettingsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Getting paid"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'settings', 'view')) {
    return (
      <>
        <PageHeader title="Getting paid" description="You do not have access to the settings." />
        <Alert tone="warning" title="You cannot see the settings">
          Ask the owner of this business to give your account permission to view settings.
        </Alert>
      </>
    );
  }

  const [overview, rails, preferences] = await Promise.all([
    loadGatewayConnections(company.id),
    loadPaymentRails(company.id),
    loadCheckoutPreferences(company.id),
  ]);
  const canManage = user.role === 'owner' || user.role === 'super_admin';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Getting paid"
        description="Connect a provider and your clients can pay the moment they open an invoice. Keys are encrypted before they are stored and are never shown again."
      />

      <SettingsNav />

      {overview.isDegraded || rails.isDegraded ? (
        <Alert tone="warning" title="Your connections could not be read">
          Nothing has been changed. Try again in a moment before you save anything here.
        </Alert>
      ) : null}

      {canManage ? null : (
        <Alert tone="info" title="You are looking, not changing">
          Only the owner of this business can connect a payment provider or change its keys.
        </Alert>
      )}

      <CardAcceptancePanel
        preferences={preferences}
        canManage={canManage}
        currency={company.baseCurrency}
      />

      <GatewayList connections={overview.connections} canManage={canManage} />

      <PaymentRailPanel
        accounts={rails.accounts}
        canManage={canManage}
        baseCurrency={company.baseCurrency}
        countryCode={company.countryCode}
      />
    </div>
  );
}

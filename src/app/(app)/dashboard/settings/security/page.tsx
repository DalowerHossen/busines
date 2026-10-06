// src/app/(app)/dashboard/settings/security/page.tsx
// Security settings: how the team signs in, how client links behave and what
// a staff member may approve without the owner.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SecurityPolicyForm } from '@/components/settings/security-policy-form';
import { SettingsNav } from '@/components/settings/settings-nav';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadCompanySettings } from '@/features/settings/queries/get-settings';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Security settings',
  description: 'Sign in rules, client link behaviour and staff approval limits.',
  path: `${ROUTES.settings}/security`,
  noIndex: true,
});

/**
 * Renders the security settings.
 *
 * @returns The rendered page.
 */
export default async function SecuritySettingsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Security"
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
        <PageHeader title="Security" description="You do not have access to the settings." />
        <Alert tone="warning" title="You cannot see the settings">
          Ask the owner of this business to give your account permission to view settings.
        </Alert>
      </>
    );
  }

  const settings = await loadCompanySettings(
    company.id,
    company.legalName || company.displayName,
    company.countryCode
  );

  const canEdit = user.role === 'owner' || user.role === 'super_admin';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="The rules everyone in this business works under. Changes take effect the next time each person signs in."
      />

      <SettingsNav />

      {settings.isDegraded ? (
        <Alert tone="warning" title="These are the standard rules">
          Your saved rules could not be read just now, so the defaults are shown. Try again in a
          moment before saving, so you do not overwrite anything.
        </Alert>
      ) : null}

      <SecurityPolicyForm
        security={settings.security}
        currency={company.baseCurrency}
        canEdit={canEdit}
      />
    </div>
  );
}

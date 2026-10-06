// src/app/(app)/dashboard/settings/page.tsx
// The business profile: the identity that heads every document you send.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { CompanyProfileForm } from '@/components/settings/company-profile-form';
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
  title: 'Business profile',
  description: 'The name, address and registration numbers printed on your documents.',
  path: ROUTES.settings,
  noIndex: true,
});

/**
 * Renders the business profile settings.
 *
 * @returns The rendered page.
 */
export default async function SettingsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Settings"
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
        <PageHeader title="Settings" description="You do not have access to the settings." />
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
        title="Settings"
        description="Your business details, document defaults and the rules your team works under."
      />

      <SettingsNav />

      {settings.isDegraded ? (
        <Alert tone="warning" title="These are the standard settings">
          Your saved settings could not be read just now, so the defaults are shown. Try again in a
          moment before saving, so you do not overwrite anything.
        </Alert>
      ) : null}

      <CompanyProfileForm profile={settings.profile} canEdit={canEdit} />
    </div>
  );
}

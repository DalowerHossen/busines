// src/app/(app)/dashboard/settings/invoicing/page.tsx
// Document settings: numbering, default wording and the look of what a client
// receives.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { InvoiceDefaultsForm } from '@/components/settings/invoice-defaults-form';
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
  title: 'Document settings',
  description: 'Numbering, default wording and the look of your invoices.',
  path: `${ROUTES.settings}/invoicing`,
  noIndex: true,
});

/**
 * Renders the document settings.
 *
 * @returns The rendered page.
 */
export default async function InvoicingSettingsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Document settings"
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
        <PageHeader
          title="Document settings"
          description="You do not have access to the settings."
        />
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
        title="Document settings"
        description="These apply to documents you create from now on. Anything already issued keeps the wording and numbering it was issued with."
      />

      <SettingsNav />

      {settings.isDegraded ? (
        <Alert tone="warning" title="These are the standard settings">
          Your saved settings could not be read just now, so the defaults are shown. Try again in a
          moment before saving, so you do not overwrite anything.
        </Alert>
      ) : null}

      <InvoiceDefaultsForm profile={settings.profile} canEdit={canEdit} />
    </div>
  );
}

// src/app/(app)/dashboard/settings/accountants/page.tsx
// Where an owner gives an accountant the keys to the books, and takes them
// back again.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AccountantAccessManager } from '@/components/settings/accountant-access-manager';
import { SettingsNav } from '@/components/settings/settings-nav';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadAccountantGrants } from '@/features/accountants/queries/list-grants';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Accountant access',
  description: 'Give your accountant access to the books, with an end date if you want one.',
  path: `${ROUTES.settings}/accountants`,
  noIndex: true,
});

/**
 * Renders the accountant access settings.
 *
 * @returns The rendered page.
 */
export default async function AccountantAccessPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Accountant"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </div>
    );
  }

  if (user.role !== 'owner' && user.role !== 'super_admin') {
    return (
      <div className="space-y-6">
        <PageHeader title="Accountant" description="Only the owner decides who reads the books." />
        <SettingsNav />
        <Alert tone="info" title="This is the owner's decision">
          Ask the owner of this business to grant or withdraw accountant access.
        </Alert>
      </div>
    );
  }

  const { grants, isDegraded } = await loadAccountantGrants(company.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accountant"
        description="Your accountant signs in with their own login and sees only what you allow here. Every time they open your books it is recorded."
      />

      <SettingsNav />

      {isDegraded ? (
        <Alert tone="warning" title="The access list could not be read">
          Nothing has changed. Reload the page in a moment before you grant anything new.
        </Alert>
      ) : null}

      <AccountantAccessManager grants={grants} isWritable={company.status === 'active'} />
    </div>
  );
}

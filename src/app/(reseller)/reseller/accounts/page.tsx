// src/app/(reseller)/reseller/accounts/page.tsx
// The book of accounts a partner holds, and the form that adds to it.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SubTenantManager } from '@/components/reseller/sub-tenant-manager';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadResellerWorkspace } from '@/features/resellers/queries/get-reseller';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Partner accounts',
  description: 'The accounts you manage under your own brand.',
  path: `${ROUTES.reseller}/accounts`,
  noIndex: true,
});

/**
 * Renders the account list.
 *
 * @returns The rendered page.
 */
export default async function ResellerAccountsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const workspace = await loadResellerWorkspace(user.id);

  if (workspace.profile === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Accounts"
          description="This account is not part of the partner programme yet."
        />
        <Alert tone="info" title="Nothing to show yet">
          Apply from the overview page and the accounts you open will be listed here.
        </Alert>
      </div>
    );
  }

  const profile = workspace.profile;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Opening an account creates a business on the platform that bills through you. You manage it; you never see inside it."
      />

      <SubTenantManager
        accounts={workspace.accounts}
        currency={profile.billingCurrency}
        isApproved={profile.status === 'approved'}
        maxAccounts={profile.maxSubTenants}
      />
    </div>
  );
}

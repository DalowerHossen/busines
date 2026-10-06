// src/app/(reseller)/reseller/brand/page.tsx
// How the partner's brand appears to the accounts they sell to.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BrandSettingsForm } from '@/components/reseller/brand-settings-form';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadResellerWorkspace } from '@/features/resellers/queries/get-reseller';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Partner brand',
  description: 'The name, colours and domain your clients see.',
  path: `${ROUTES.reseller}/brand`,
  noIndex: true,
});

/**
 * Renders the brand settings page.
 *
 * @returns The rendered page.
 */
export default async function ResellerBrandPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const workspace = await loadResellerWorkspace(user.id);

  if (workspace.profile === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Brand"
          description="This account is not part of the partner programme yet."
        />
        <Alert tone="info" title="Nothing to set up yet">
          Apply from the overview page and your brand settings will appear here.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brand"
        description="Everything on this page is what the businesses you sell to will see in place of ours."
      />

      <BrandSettingsForm profile={workspace.profile} />
    </div>
  );
}

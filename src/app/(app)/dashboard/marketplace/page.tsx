// src/app/(app)/dashboard/marketplace/page.tsx
// The marketplace as a business sees it: what is on sale, and what is
// already running here.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CatalogueFilters } from '@/components/marketplace/catalogue-filters';
import { CatalogueGrid } from '@/components/marketplace/catalogue-grid';
import { InstalledTemplates } from '@/components/marketplace/installed-templates';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadCatalogue } from '@/features/marketplace/queries/list-catalogue';
import { loadInstalledTemplates } from '@/features/marketplace/queries/list-installs';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Template marketplace',
  description: 'Invoice layouts, charts of accounts and reminder sets built by other businesses.',
  path: ROUTES.marketplace,
  noIndex: true,
});

export interface MarketplacePageProps {
  /** Filters from the address bar. */
  searchParams: { category?: string; q?: string };
}

/**
 * Renders the marketplace.
 *
 * @param props The filters asked for.
 * @returns The rendered page.
 */
export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Template marketplace"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </div>
    );
  }

  const category = searchParams.category ?? '';
  const search = searchParams.q ?? '';

  const [catalogue, installed] = await Promise.all([
    loadCatalogue({
      category: category.length > 0 ? category : null,
      search: search.length > 0 ? search : null,
    }),
    loadInstalledTemplates(company.id),
  ]);

  const canManage = user.role === 'owner' || user.role === 'super_admin';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Template marketplace"
        description="Work other businesses have packaged up: invoice layouts, charts of accounts, reminder sets and report packs. Install one and it is yours to edit."
        actions={
          <Link
            href={`${ROUTES.marketplace}/vendor`}
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
          >
            Sell your own
          </Link>
        }
      />

      {catalogue.isDegraded ? (
        <Alert tone="warning" title="The shopfront could not be read">
          Your installed templates are unaffected. Reload the page in a moment.
        </Alert>
      ) : null}

      <CatalogueFilters category={category} search={search} />

      <CatalogueGrid entries={catalogue.entries} />

      <Card>
        <CardHeader>
          <CardTitle>Installed here</CardTitle>
          <CardDescription>
            Everything this business runs from the marketplace, with the version it is on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {installed.isDegraded ? (
            <Alert tone="warning" title="The installed list could not be read">
              Nothing has been removed. Reload the page in a moment.
            </Alert>
          ) : (
            <InstalledTemplates installs={installed.installs} canManage={canManage} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

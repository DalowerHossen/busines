// src/app/(app)/dashboard/clients/new/page.tsx
// Adding a client. The company defaults are passed in so the form opens with
// the right currency and country already chosen.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ClientForm } from '@/components/clients/client-form';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Add a client',
  description: 'Record the details an invoice needs before you raise it.',
  path: `${ROUTES.clients}/new`,
  noIndex: true,
});

/**
 * Renders the add client page.
 *
 * @returns The rendered page.
 */
export default async function NewClientPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company || !can(user, 'clients', 'create')) {
    return (
      <>
        <PageHeader title="Add a client" description="You cannot add clients to this business." />
        <Alert tone="warning" title="You cannot add a client">
          Ask the owner of this business to give your account permission to create clients.
        </Alert>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add a client"
        description="Enter it once. Every invoice you raise for this client is filled in from here."
        breadcrumbs={[{ label: 'Clients', href: ROUTES.clients }, { label: 'Add a client' }]}
      />

      <ClientForm defaultCurrency={company.baseCurrency} defaultCountry={company.countryCode} />
    </div>
  );
}

// src/app/(app)/dashboard/clients/[clientId]/edit/page.tsx
// Editing a client. The same form used to add one, opened with the values
// already held against the record.

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { ClientForm } from '@/components/clients/client-form';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { getClient } from '@/features/clients/queries/get-client';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Edit client',
  description: 'Change the details, billing terms and tax numbers of a client.',
  path: ROUTES.clients,
  noIndex: true,
});

export interface EditClientPageProps {
  /** The client identifier taken from the address. */
  params: { clientId: string };
}

/**
 * Renders the edit client page.
 *
 * @param props The client identifier from the address.
 * @returns The rendered page.
 */
export default async function EditClientPage({ params }: EditClientPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company || !can(user, 'clients', 'edit')) {
    return (
      <>
        <PageHeader title="Edit client" description="You cannot change clients in this business." />
        <Alert tone="warning" title="You cannot edit this client">
          Ask the owner of this business to give your account permission to edit clients.
        </Alert>
      </>
    );
  }

  const client = await getClient(company.id, params.clientId);

  if (client === null) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${client.displayName}`}
        description="Changes apply to invoices you raise from now on. Invoices already sent keep the details they were issued with."
        breadcrumbs={[
          { label: 'Clients', href: ROUTES.clients },
          { label: client.displayName, href: `${ROUTES.clients}/${client.id}` },
          { label: 'Edit' },
        ]}
      />

      <ClientForm
        client={client}
        defaultCurrency={company.baseCurrency}
        defaultCountry={company.countryCode}
      />
    </div>
  );
}

// src/app/(app)/dashboard/clients/[clientId]/page.tsx
// One client: who they are, what they owe and the people who receive their
// invoices.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ClientBillingCard } from '@/components/clients/client-billing-card';
import { ClientContactsCard } from '@/components/clients/client-contacts-card';
import { ClientProfileCard } from '@/components/clients/client-profile-card';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { getClient, getClientBillingSummary } from '@/features/clients/queries/get-client';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Client',
  description: 'The details, billing terms and contacts of one client.',
  path: ROUTES.clients,
  noIndex: true,
});

export interface ClientPageProps {
  /** The client identifier taken from the address. */
  params: { clientId: string };
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  archived: 'Archived',
};

/**
 * Renders the page of one client.
 *
 * @param props The client identifier from the address.
 * @returns The rendered page.
 */
export default async function ClientPage({ params }: ClientPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company || !can(user, 'clients', 'view')) {
    return (
      <>
        <PageHeader title="Client" description="You do not have access to the client book." />
        <Alert tone="warning" title="You cannot see clients">
          Ask the owner of this business to give your account permission to view clients.
        </Alert>
      </>
    );
  }

  const client = await getClient(company.id, params.clientId);

  if (client === null) {
    notFound();
  }

  const summary = await getClientBillingSummary(
    company.id,
    client.id,
    client.billingCurrency ?? company.baseCurrency
  );

  const canEdit = can(user, 'clients', 'edit');

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.displayName}
        description={`Client ${client.clientNumber}`}
        breadcrumbs={[{ label: 'Clients', href: ROUTES.clients }, { label: client.displayName }]}
        badge={
          <Badge
            tone={client.isArchived ? 'danger' : client.status === 'active' ? 'success' : 'neutral'}
          >
            {client.isArchived ? 'Deleted' : (STATUS_LABELS[client.status] ?? 'Active')}
          </Badge>
        }
        actions={
          canEdit ? (
            <Link
              href={`${ROUTES.clients}/${client.id}/edit`}
              className={cn(buttonVariants({ variant: 'secondary' }))}
            >
              Edit client
            </Link>
          ) : null
        }
      />

      {client.isArchived ? (
        <Alert tone="warning" title="This client has been deleted">
          It no longer appears in your working lists. Restore it from the deleted view when you need
          it again.
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <ClientBillingCard client={client} summary={summary} />
          <ClientProfileCard client={client} />
        </div>
        <ClientContactsCard contacts={client.contacts} fallbackEmail={client.email} />
      </div>
    </div>
  );
}

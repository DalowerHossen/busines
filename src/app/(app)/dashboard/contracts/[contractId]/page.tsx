// src/app/(app)/dashboard/contracts/[contractId]/page.tsx
// One agreement: its wording, its parties, and everything that has happened
// to it. A draft can still be rewritten here; anything sent cannot.

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { ContractDetailPanel } from '@/components/contracts/contract-detail-panel';
import { ContractEditor } from '@/components/contracts/contract-editor';
import { ContractTrail } from '@/components/contracts/contract-trail';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadContract } from '@/features/contracts/queries/get-contract';
import { loadClientChoices } from '@/features/contracts/queries/list-client-choices';
import { loadContractWording } from '@/features/contracts/queries/list-contracts';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Agreement',
  description: 'One agreement, its parties and its full trail.',
  path: ROUTES.contracts,
  noIndex: true,
});

export interface ContractPageProps {
  /** The address of the agreement being looked at. */
  params: { contractId: string };
}

/**
 * Renders one agreement.
 *
 * @param props The agreement being looked at.
 * @returns The rendered page.
 */
export default async function ContractPage({ params }: ContractPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Agreement"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'contracts', 'view')) {
    return (
      <>
        <PageHeader title="Agreement" description="You do not have access to the agreements." />
        <Alert tone="warning" title="You cannot see the agreements">
          Ask the owner of this business to give your account permission to view contracts.
        </Alert>
      </>
    );
  }

  const contract = await loadContract(params.contractId);

  if (contract === null) {
    notFound();
  }

  const canEdit =
    contract.status === 'draft' && !company.isReadOnly && can(user, 'contracts', 'edit');

  const [wording, clients] = canEdit
    ? await Promise.all([loadContractWording(company.id), loadClientChoices(company.id)])
    : [[], []];

  return (
    <div className="space-y-6">
      <PageHeader
        title={contract.title}
        description={`${contract.contractNumber} · ${contract.signedCount} of ${contract.signerCount} parties have signed.`}
      />

      {canEdit ? (
        <ContractEditor
          wording={wording}
          clients={clients}
          contract={contract}
          baseCurrency={company.baseCurrency}
        />
      ) : null}

      <ContractDetailPanel
        contract={contract}
        canSend={user.role === 'owner' && !company.isReadOnly}
        fallbackCurrency={company.baseCurrency}
      />

      <ContractTrail events={contract.events} />
    </div>
  );
}

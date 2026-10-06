// src/app/(app)/dashboard/contracts/new/page.tsx
// Drafting a new agreement from wording the platform ships with.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ContractEditor } from '@/components/contracts/contract-editor';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadClientChoices } from '@/features/contracts/queries/list-client-choices';
import { loadContractWording } from '@/features/contracts/queries/list-contracts';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Draft an agreement',
  description: 'Write an agreement and name the people who have to sign it.',
  path: `${ROUTES.contracts}/new`,
  noIndex: true,
});

/**
 * Renders the drafting page.
 *
 * @returns The rendered page.
 */
export default async function NewContractPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Draft an agreement"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (company.isReadOnly || !can(user, 'contracts', 'create')) {
    return (
      <>
        <PageHeader
          title="Draft an agreement"
          description="You do not have permission to write agreements."
        />
        <Alert tone="warning" title="You cannot draft agreements">
          Ask the owner of this business to give your account permission to create contracts.
        </Alert>
      </>
    );
  }

  const [wording, clients] = await Promise.all([
    loadContractWording(company.id),
    loadClientChoices(company.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Draft an agreement"
        description="Pick wording to start from or write your own, say what it is worth and when it runs, and name everybody who has to sign."
      />

      <ContractEditor
        wording={wording}
        clients={clients}
        contract={null}
        baseCurrency={company.baseCurrency}
      />
    </div>
  );
}

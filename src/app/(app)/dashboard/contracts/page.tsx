// src/app/(app)/dashboard/contracts/page.tsx
// Agreements: what is being written, what is out for signature, and what has
// been agreed.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ContractList } from '@/components/contracts/contract-list';
import { ContractSummary } from '@/components/contracts/contract-summary';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadContracts } from '@/features/contracts/queries/list-contracts';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Agreements',
  description: 'Draft, send and track the agreements your clients sign.',
  path: ROUTES.contracts,
  noIndex: true,
});

/**
 * Renders the agreements page.
 *
 * @returns The rendered page.
 */
export default async function ContractsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Agreements"
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
        <PageHeader title="Agreements" description="You do not have access to the agreements." />
        <Alert tone="warning" title="You cannot see the agreements">
          Ask the owner of this business to give your account permission to view contracts.
        </Alert>
      </>
    );
  }

  const { contracts, overview, isDegraded } = await loadContracts(company.id);
  const canCreate = !company.isReadOnly && can(user, 'contracts', 'create');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agreements"
        description="Write an agreement, send it to the people who have to sign, and keep the proof. The wording is frozen the moment it goes out, and every view and signature is recorded."
        actions={
          canCreate ? (
            <Link
              href={`${ROUTES.contracts}/new`}
              className={cn(buttonVariants({ variant: 'primary' }))}
            >
              Draft an agreement
            </Link>
          ) : null
        }
      />

      {isDegraded ? (
        <Alert tone="warning" title="The agreements could not be read">
          Nothing has been changed. Refresh the page in a moment and the list will come back.
        </Alert>
      ) : null}

      <ContractSummary overview={overview} currency={company.baseCurrency} />

      <ContractList contracts={contracts} fallbackCurrency={company.baseCurrency} />
    </div>
  );
}

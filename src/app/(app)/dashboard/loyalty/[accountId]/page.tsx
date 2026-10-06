// src/app/(app)/dashboard/loyalty/[accountId]/page.tsx
// One membership, every movement behind the balance, and what was claimed.

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { LoyaltyMemberPanel } from '@/components/loyalty/loyalty-member-panel';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadLoyaltyMember } from '@/features/loyalty/queries/get-member';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export interface LoyaltyMemberPageProps {
  /** The address of the membership being opened. */
  params: { accountId: string };
}

export const metadata: Metadata = buildMetadata({
  title: 'Loyalty member',
  description: 'One membership and every point movement behind its balance.',
  path: ROUTES.loyalty,
  noIndex: true,
});

/**
 * Renders one membership.
 *
 * @param props The address of the membership.
 * @returns The rendered page.
 */
export default async function LoyaltyMemberPage({ params }: LoyaltyMemberPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Loyalty member"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'clients', 'view')) {
    return (
      <>
        <PageHeader
          title="Loyalty member"
          description="You do not have access to the client records."
        />
        <Alert tone="warning" title="You cannot see this membership">
          Ask the owner of this business to give your account permission to view clients.
        </Alert>
      </>
    );
  }

  const member = await loadLoyaltyMember(params.accountId);

  if (!member) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={member.membershipNumber}
        description="The balance below is the sum of the movements, not a number somebody typed. That is what makes it worth trusting."
      />

      <LoyaltyMemberPanel member={member} />
    </div>
  );
}

// src/app/(app)/dashboard/team/page.tsx
// The people of the business: who has an account, what each of them may do,
// and which invitations are still waiting.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { InvitationTable } from '@/components/team/invitation-table';
import { InviteMemberDialog } from '@/components/team/invite-member-dialog';
import { TeamMembersTable } from '@/components/team/team-members-table';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadTeamOverview } from '@/features/team/queries/list-team';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Team',
  description: 'Invite colleagues and your accountant, and decide what each of them may do.',
  path: ROUTES.team,
  noIndex: true,
});

/**
 * Renders the team page.
 *
 * @returns The rendered page.
 */
export default async function TeamPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader title="Team" description="This account is not attached to a business yet." />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'team', 'view')) {
    return (
      <>
        <PageHeader title="Team" description="You do not have access to the team." />
        <Alert tone="warning" title="You cannot see the team">
          Ask the owner of this business to give your account permission to view the team.
        </Alert>
      </>
    );
  }

  const canManage = user.role === 'owner' || user.role === 'super_admin';
  const overview = await loadTeamOverview(company.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Everybody who works in this business, and exactly what each of them may do."
        actions={canManage ? <InviteMemberDialog /> : null}
      />

      {overview.isDegraded ? (
        <Alert tone="warning" title="The team could not be read just now">
          Nothing has been lost. Refresh the page in a moment to see everybody again.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>People with an account</CardTitle>
          <CardDescription>
            Only you, as the owner, can send documents to a client. Staff prepare the work and you
            send it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamMembersTable
            members={overview.members}
            currentUserId={user.id}
            canManage={canManage}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invitations</CardTitle>
          <CardDescription>
            An invitation link can be used once and stops working after fourteen days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvitationTable invitations={overview.invitations} canManage={canManage} />
        </CardContent>
      </Card>
    </div>
  );
}

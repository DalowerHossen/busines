// src/app/(app)/dashboard/projects/[projectId]/page.tsx
// One project: the hours, the milestones and whether it is making money.

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { ProjectDetailView } from '@/components/projects/project-detail-view';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/config/app';
import { loadProjectDetail } from '@/features/projects/queries/list-projects';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Project',
  description: 'The hours on this project and what it has earned.',
  path: '/dashboard/projects',
  noIndex: true,
});

export interface ProjectDetailPageProps {
  /** The project being opened. */
  params: { projectId: string };
}

/**
 * Renders one project.
 *
 * @param props The project being opened.
 * @returns The rendered page.
 */
export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader title="Project" description="This account is not attached to a business yet." />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </div>
    );
  }

  if (!can(user, 'clients', 'view')) {
    return (
      <div className="space-y-6">
        <PageHeader title="Project" description="You do not have access to the work book." />
        <Alert tone="warning" title="You cannot see projects">
          Ask the owner of this business to give your account permission to view clients.
        </Alert>
      </div>
    );
  }

  const detail = await loadProjectDetail(company.id, params.projectId);

  if (detail.project === null) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.project.name}
        description={
          detail.project.clientName === null
            ? `${detail.project.projectCode}. No client attached yet.`
            : `${detail.project.projectCode} for ${detail.project.clientName}.`
        }
        badge={
          <Badge tone={detail.project.status === 'active' ? 'success' : 'neutral'}>
            {detail.project.status.replace('_', ' ')}
          </Badge>
        }
      />

      {detail.isDegraded ? (
        <Alert tone="warning" title="Some of this could not be read">
          The figures below may be incomplete. Reload before acting on them.
        </Alert>
      ) : null}

      <ProjectDetailView
        project={detail.project}
        entries={detail.entries}
        milestones={detail.milestones}
        profit={detail.profit}
        canEdit={can(user, 'clients', 'edit') && !company.isReadOnly}
      />
    </div>
  );
}

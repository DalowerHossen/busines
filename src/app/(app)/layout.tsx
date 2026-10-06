// src/app/(app)/layout.tsx
// The frame around a business workspace.
//
// Every page inside reads one tenant's money, so the guard is here rather
// than repeated on each page: no session means the login page, and an
// account that belongs somewhere else is sent to its own landing page. The
// navigation is filtered by role from the single central map, so a staff
// member never sees a link they cannot open.

import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { CommandLauncher } from '@/components/layout/command-launcher';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { ROUTES } from '@/config/app';
import { landingPathForRole } from '@/config/roles';
import { visibleNavSections } from '@/lib/navigation/visible-nav';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { listNotifications } from '@/features/notifications/queries/list-notifications';
import { AppProviders } from '@/providers/app-providers';

export interface ApplicationLayoutProps {
  /** The page being rendered. */
  children: ReactNode;
}

/** Roles that work inside a single business workspace. */
const WORKSPACE_ROLES = new Set(['owner', 'staff']);

/**
 * Renders the business workspace frame.
 *
 * @param props The page being rendered.
 * @returns The rendered layout.
 */
export default async function ApplicationLayout({ children }: ApplicationLayoutProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  if (!WORKSPACE_ROLES.has(user.role)) {
    redirect(landingPathForRole(user.role));
  }

  if (!user.companyId) {
    redirect(ROUTES.setup);
  }

  const company = await loadCompany(user.companyId);
  const notifications = await listNotifications(user.id, user.companyId);
  const sections = visibleNavSections(user);

  return (
    <AppProviders initialState={{ notifications }}>
      <div className="flex min-h-screen bg-surface-muted">
        <Sidebar sections={sections} company={company} planName={null} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar sections={sections} user={user} company={company} fallbackTitle="Workspace" />

          <div className="flex justify-end border-b border-border bg-surface px-4 py-2 sm:px-6 lg:px-8">
            <CommandLauncher role={user.role} />
          </div>

          <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-content space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </AppProviders>
  );
}

// src/app/(admin)/layout.tsx
// The frame around the platform console. Only the platform team reaches it,
// and it deliberately looks different from a tenant workspace so nobody
// confuses the two.

import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { ADMIN_NAV_SECTIONS } from '@/config/admin-navigation';
import { ROUTES } from '@/config/app';
import { landingPathForRole } from '@/config/roles';
import { getSessionUser } from '@/lib/auth/session';

export interface AdminLayoutProps {
  /** The page being rendered. */
  children: ReactNode;
}

/**
 * Renders the console frame for the platform team.
 *
 * @param props The page being rendered.
 * @returns The rendered layout.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  if (user.role !== 'super_admin') {
    redirect(landingPathForRole(user.role));
  }

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <Sidebar sections={ADMIN_NAV_SECTIONS} company={null} planName={null} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          sections={ADMIN_NAV_SECTIONS}
          user={user}
          company={null}
          fallbackTitle="Platform console"
        />

        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-content space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

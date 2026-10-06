// src/app/(accountant)/layout.tsx
// The frame around the bookkeeping portal. Only an accountant and the
// platform team may open it, because every page inside reads somebody
// else's books.

import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { ACCOUNTANT_NAV_SECTIONS } from '@/config/accountant-navigation';
import { ROUTES } from '@/config/app';
import { landingPathForRole } from '@/config/roles';
import { getSessionUser } from '@/lib/auth/session';

export interface AccountantLayoutProps {
  /** The page being rendered. */
  children: ReactNode;
}

/**
 * Renders the bookkeeping portal frame.
 *
 * @param props The page being rendered.
 * @returns The rendered layout.
 */
export default async function AccountantLayout({ children }: AccountantLayoutProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  if (user.role !== 'accountant' && user.role !== 'super_admin') {
    redirect(landingPathForRole(user.role));
  }

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <Sidebar sections={ACCOUNTANT_NAV_SECTIONS} company={null} planName={null} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          sections={ACCOUNTANT_NAV_SECTIONS}
          user={user}
          company={null}
          fallbackTitle="Bookkeeping"
        />

        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-content space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

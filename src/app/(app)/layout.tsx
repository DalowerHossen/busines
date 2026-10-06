// src/app/(app)/layout.tsx
// The frame around every page that needs an account: the navigation column,
// the top bar, the notices that apply today and the page itself.

import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { AccountNotices } from '@/components/layout/account-notices';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { ROUTES } from '@/config/app';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { landingPathForRole } from '@/config/roles';
import { visibleNavSections } from '@/lib/navigation/visible-nav';

export interface AppLayoutProps {
  /** The page being rendered. */
  children: ReactNode;
}

/**
 * Renders the application frame for a signed in account.
 *
 * @param props The page being rendered.
 * @returns The rendered layout.
 */
export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  if (user.status === 'suspended' || user.status === 'banned' || user.status === 'closed') {
    redirect(`${ROUTES.login}?error=account_unavailable`);
  }

  if (user.role !== 'owner' && user.role !== 'staff' && user.role !== 'accountant') {
    redirect(landingPathForRole(user.role));
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;
  const sections = visibleNavSections(user);

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <Sidebar sections={sections} company={company} planName={null} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar sections={sections} user={user} company={company} />

        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-content space-y-6">
            <AccountNotices user={user} company={company} />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

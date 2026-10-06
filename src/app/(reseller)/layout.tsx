// src/app/(reseller)/layout.tsx
// The frame around the white label portal. Any signed in account may open it,
// because applying is open to everybody, and the portal shows nothing but
// that account's own partner record.

import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { ROUTES } from '@/config/app';
import { RESELLER_NAV_SECTIONS } from '@/config/reseller-navigation';
import { getSessionUser } from '@/lib/auth/session';

export interface ResellerLayoutProps {
  /** The page being rendered. */
  children: ReactNode;
}

/**
 * Renders the partner portal frame.
 *
 * @param props The page being rendered.
 * @returns The rendered layout.
 */
export default async function ResellerLayout({ children }: ResellerLayoutProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <Sidebar sections={RESELLER_NAV_SECTIONS} company={null} planName={null} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          sections={RESELLER_NAV_SECTIONS}
          user={user}
          company={null}
          fallbackTitle="Partner programme"
        />

        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-content space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

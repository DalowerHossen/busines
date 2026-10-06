// src/app/(affiliate)/layout.tsx
// The frame around the referral portal. Any signed in account may open it,
// because joining the programme is open to everybody, and the portal itself
// shows nothing but that account's own referral figures.

import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { AFFILIATE_NAV_SECTIONS } from '@/config/affiliate-navigation';
import { ROUTES } from '@/config/app';
import { getSessionUser } from '@/lib/auth/session';

export interface AffiliateLayoutProps {
  /** The page being rendered. */
  children: ReactNode;
}

/**
 * Renders the referral portal frame.
 *
 * @param props The page being rendered.
 * @returns The rendered layout.
 */
export default async function AffiliateLayout({ children }: AffiliateLayoutProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <Sidebar sections={AFFILIATE_NAV_SECTIONS} company={null} planName={null} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          sections={AFFILIATE_NAV_SECTIONS}
          user={user}
          company={null}
          fallbackTitle="Referral programme"
        />

        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-content space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

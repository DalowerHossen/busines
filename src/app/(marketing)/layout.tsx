// src/app/(marketing)/layout.tsx
// The frame around every public page: the navigation bar, the content region
// and the footer.

import type { ReactNode } from 'react';

import { MeasurementScripts } from '@/components/analytics/measurement-scripts';
import { CookieBanner } from '@/components/consent/cookie-banner';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import { loadActiveDestinations } from '@/features/analytics/queries/list-destinations';

export interface MarketingLayoutProps {
  /** The page being rendered. */
  children: ReactNode;
}

/**
 * Renders the public website frame.
 *
 * @param props The page being rendered.
 * @returns The rendered layout.
 */
export default async function MarketingLayout({ children }: MarketingLayoutProps) {
  // Read on the server so marketing can add a property without a deployment,
  // and gated in the browser so nothing loads before the visitor agrees.
  const destinations = await loadActiveDestinations('marketing');

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <CookieBanner />
      <MeasurementScripts destinations={destinations} />
    </div>
  );
}

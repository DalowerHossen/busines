// src/app/d/layout.tsx
// The frame around every page a client opens from a link. There is no
// navigation and nothing about the platform to click: the document is the
// whole page.

import type { ReactNode } from 'react';

import { BRAND } from '@/config/brand';

export interface PortalLayoutProps {
  /** The page being framed. */
  children: ReactNode;
}

/**
 * Renders the client facing frame.
 *
 * @param props The page content.
 * @returns The rendered frame.
 */
export default function PortalLayout({ children }: PortalLayoutProps) {
  return (
    <div className="min-h-screen bg-surface-muted px-4 py-8 sm:py-12">
      <div className="space-y-6">{children}</div>
      <p className="mt-10 text-center text-xs text-muted-foreground">
        Sent securely with {BRAND.name}. Never share this link with anybody else.
      </p>
    </div>
  );
}

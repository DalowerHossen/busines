// src/app/sign/layout.tsx
// The frame around the signing page. There is no navigation and nothing
// about the platform to click: the agreement is the whole page.

import type { ReactNode } from 'react';

import { BRAND } from '@/config/brand';

export interface SigningLayoutProps {
  /** The page being framed. */
  children: ReactNode;
}

/**
 * Renders the signing frame.
 *
 * @param props The page content.
 * @returns The rendered frame.
 */
export default function SigningLayout({ children }: SigningLayoutProps) {
  return (
    <div className="min-h-screen bg-surface-muted px-4 py-8 sm:py-12">
      <div className="space-y-6">{children}</div>
      <p className="mt-10 text-center text-xs text-muted-foreground">
        Sent securely with {BRAND.name}. Never share this link with anybody else.
      </p>
    </div>
  );
}

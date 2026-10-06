// src/app/pay/layout.tsx
// The frame around the payment pages. There is no navigation and nothing
// about the platform to click: paying the invoice is the whole page.

import type { ReactNode } from 'react';

import { BRAND } from '@/config/brand';

export interface CheckoutLayoutProps {
  /** The page being framed. */
  children: ReactNode;
}

/**
 * Renders the client facing payment frame.
 *
 * @param props The page content.
 * @returns The rendered frame.
 */
export default function CheckoutLayout({ children }: CheckoutLayoutProps) {
  return (
    <div className="min-h-screen bg-surface-muted px-4 py-8 sm:py-12">
      <div className="space-y-6">{children}</div>
      <p className="mt-10 text-center text-xs text-muted-foreground">
        Payments are taken by the provider your supplier chose. {BRAND.name} never sees your card
        details.
      </p>
    </div>
  );
}

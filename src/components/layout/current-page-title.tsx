// src/components/layout/current-page-title.tsx
// Names the page in the top bar by matching the address against the
// navigation, so the title never falls out of step with the menu.

'use client';

import { usePathname } from 'next/navigation';

import type { NavSection } from '@/config/navigation';
import { activeNavItem } from '@/lib/navigation/visible-nav';

export interface CurrentPageTitleProps {
  /** Sections already filtered for the signed in account. */
  sections: readonly NavSection[];
  /** Name used when the page is not one of the menu entries. */
  fallback: string;
}

/**
 * Renders the name of the page that is open.
 *
 * @param props Navigation sections and a fallback name.
 * @returns The rendered title.
 */
export function CurrentPageTitle({ sections, fallback }: CurrentPageTitleProps) {
  const pathname = usePathname();
  const item = activeNavItem(sections, pathname);

  return <span className="truncate">{item?.label ?? fallback}</span>;
}

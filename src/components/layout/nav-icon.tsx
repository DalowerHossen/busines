// src/components/layout/nav-icon.tsx
// Maps a navigation entry to its icon, so the navigation configuration stays
// free of components.

import { createElement } from 'react';

import { getNavIcon } from '@/components/layouts/nav-icons';
import type { NavIconName } from '@/config/navigation';

export interface NavIconProps {
  /** Name recorded against the navigation entry. */
  name: NavIconName;
  /** Extra classes, usually the size. */
  className?: string;
}

/**
 * Renders the icon for a navigation entry.
 *
 * @param props Icon name and classes.
 * @returns The rendered icon.
 */
export function NavIcon({ name, className }: NavIconProps) {
  return createElement(getNavIcon(name), { 'aria-hidden': true, className });
}

// src/lib/navigation/visible-nav.ts
// Works out which navigation entries one account may see. An entry is shown
// only when the page exists, the role is allowed and the permission is held,
// so nobody is ever offered a link that refuses them or leads nowhere.

import { NAV_SECTIONS, type NavSection, type NavSectionItem } from '@/config/navigation';
import type { PermissionResource } from '@/config/permissions';
import { can } from '@/lib/auth/permissions';
import type { SessionUser } from '@/lib/auth/types';

/**
 * Reports whether one entry belongs in this account navigation.
 *
 * @param item Entry being considered.
 * @param user Signed in account.
 * @returns True when the entry should be rendered.
 */
function isVisible(item: NavSectionItem, user: SessionUser): boolean {
  if (!item.isBuilt || !item.roles.includes(user.role)) {
    return false;
  }

  if (!item.permission) {
    return true;
  }

  return can(user, item.permission as PermissionResource, 'view');
}

/**
 * Filters the navigation down to what this account may use.
 *
 * @param user Signed in account.
 * @returns Sections with at least one visible entry.
 */
export function visibleNavSections(user: SessionUser): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => isVisible(item, user)),
  })).filter((section) => section.items.length > 0);
}

/**
 * Finds the entry that matches the current address, for the page title and
 * the highlighted state in the sidebar.
 *
 * @param sections Sections already filtered for this account.
 * @param pathname Path of the current page.
 * @returns The matching entry, or null when the page is not in the menu.
 */
export function activeNavItem(
  sections: readonly NavSection[],
  pathname: string
): NavSectionItem | null {
  let match: NavSectionItem | null = null;

  for (const section of sections) {
    for (const item of section.items) {
      const isMatch = item.isExact ? pathname === item.href : pathname.startsWith(item.href);

      if (isMatch && (!match || item.href.length > match.href.length)) {
        match = item;
      }
    }
  }

  return match;
}

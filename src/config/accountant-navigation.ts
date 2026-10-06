// src/config/accountant-navigation.ts
// The navigation of the bookkeeping portal. An accountant works across
// several businesses, so the portal opens on the list of them and every
// other route sits underneath whichever one is being worked on.

import { ROUTES } from '@/config/app';
import type { NavSection } from '@/config/navigation';

/** Roles that may open the bookkeeping portal. */
const BOOKKEEPING_VIEWERS = ['accountant', 'super_admin'] as const;

/** Sections shown to an accountant. */
export const ACCOUNTANT_NAV_SECTIONS: readonly NavSection[] = [
  {
    key: 'bookkeeping',
    label: 'Bookkeeping',
    items: [
      {
        key: 'accountant-companies',
        label: 'Businesses',
        href: ROUTES.accountant,
        icon: 'accountant',
        roles: BOOKKEEPING_VIEWERS,
        isBuilt: true,
        isExact: true,
      },
    ],
  },
];

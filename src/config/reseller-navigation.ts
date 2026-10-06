// src/config/reseller-navigation.ts
// The navigation of the white label portal. A partner runs a book of
// accounts and a brand, so the portal holds exactly those three things and
// no route into any account.

import { ROUTES } from '@/config/app';
import type { NavSection } from '@/config/navigation';

/** Roles that may open the partner portal; the portal itself shows only own data. */
const PARTNER_VIEWERS = [
  'reseller',
  'owner',
  'staff',
  'accountant',
  'affiliate',
  'super_admin',
] as const;

/** Sections shown to a white label partner. */
export const RESELLER_NAV_SECTIONS: readonly NavSection[] = [
  {
    key: 'partner',
    label: 'Partner',
    items: [
      {
        key: 'reseller-overview',
        label: 'Overview',
        href: ROUTES.reseller,
        icon: 'dashboard',
        roles: PARTNER_VIEWERS,
        isBuilt: true,
        isExact: true,
      },
      {
        key: 'reseller-accounts',
        label: 'Accounts',
        href: `${ROUTES.reseller}/accounts`,
        icon: 'reseller',
        roles: PARTNER_VIEWERS,
        isBuilt: true,
      },
      {
        key: 'reseller-earnings',
        label: 'Earnings',
        href: `${ROUTES.reseller}/earnings`,
        icon: 'payouts',
        roles: PARTNER_VIEWERS,
        isBuilt: true,
      },
      {
        key: 'reseller-brand',
        label: 'Brand',
        href: `${ROUTES.reseller}/brand`,
        icon: 'settings',
        roles: PARTNER_VIEWERS,
        isBuilt: true,
      },
    ],
  },
];

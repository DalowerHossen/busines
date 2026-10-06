// src/config/affiliate-navigation.ts
// The navigation of the referral portal. It is short on purpose: a partner
// sees traffic, earnings and their own details, and has no route into any
// business on the platform.

import { ROUTES } from '@/config/app';
import type { NavSection } from '@/config/navigation';

/** Sections shown to a referral partner. */
export const AFFILIATE_NAV_SECTIONS: readonly NavSection[] = [
  {
    key: 'referrals',
    label: 'Referrals',
    items: [
      {
        key: 'affiliate-overview',
        label: 'Overview',
        href: ROUTES.affiliate,
        icon: 'dashboard',
        roles: ['affiliate', 'owner', 'staff', 'accountant', 'reseller', 'super_admin'],
        isBuilt: true,
        isExact: true,
      },
      {
        key: 'affiliate-earnings',
        label: 'Earnings',
        href: `${ROUTES.affiliate}/earnings`,
        icon: 'payouts',
        roles: ['affiliate', 'owner', 'staff', 'accountant', 'reseller', 'super_admin'],
        isBuilt: true,
      },
      {
        key: 'affiliate-settings',
        label: 'Your details',
        href: `${ROUTES.affiliate}/settings`,
        icon: 'settings',
        roles: ['affiliate', 'owner', 'staff', 'accountant', 'reseller', 'super_admin'],
        isBuilt: true,
      },
    ],
  },
];

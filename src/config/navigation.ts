// src/config/navigation.ts
// Central navigation map (R9.1 in docs/planning/FEATURE-REGISTRY.md). Every
// sidebar, topbar, mobile drawer, bottom nav, and breadcrumb trail reads
// from this single source so a route's label, icon, and role visibility
// never drifts between components. `iconName` matches a `lucide-react`
// export name; the sidebar component (added in a later phase) resolves it
// to the actual icon component.
import { ROUTES } from '@/config/app';
import type { AccountRole } from '@/types/auth';

/**
 * One entry in the central navigation map.
 */
export interface NavItem {
  readonly key: string;
  readonly label: string;
  readonly href: string;
  readonly iconName: string;
  /** Roles allowed to see this item. `client` access never appears here - clients never see app navigation. */
  readonly allowedRoles: readonly AccountRole[];
  readonly permission?: string;
  readonly children?: readonly NavItem[];
}

const OWNER_AND_STAFF: readonly AccountRole[] = ['owner', 'staff'];
const OWNER_STAFF_ACCOUNTANT: readonly AccountRole[] = ['owner', 'staff', 'accountant'];
const OWNER_ONLY: readonly AccountRole[] = ['owner'];

/**
 * The full, role-aware navigation tree for the authenticated application
 * shell. Public site navigation (marketing pages) is defined separately
 * since it has no role gating.
 */
export const NAV_MAP: readonly NavItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: ROUTES.dashboard,
    iconName: 'LayoutDashboard',
    allowedRoles: OWNER_STAFF_ACCOUNTANT,
  },
  {
    key: 'clients',
    label: 'Clients',
    href: ROUTES.clients,
    iconName: 'Users',
    allowedRoles: OWNER_AND_STAFF,
  },
  {
    key: 'invoices',
    label: 'Invoices',
    href: ROUTES.invoices,
    iconName: 'FileText',
    allowedRoles: OWNER_STAFF_ACCOUNTANT,
  },
  {
    key: 'estimates',
    label: 'Estimates',
    href: ROUTES.estimates,
    iconName: 'FileSignature',
    allowedRoles: OWNER_AND_STAFF,
  },
  {
    key: 'contracts',
    label: 'Contracts',
    href: ROUTES.contracts,
    iconName: 'FileCheck2',
    allowedRoles: OWNER_AND_STAFF,
  },
  {
    key: 'subscriptions',
    label: 'Recurring billing',
    href: ROUTES.subscriptions,
    iconName: 'RefreshCw',
    allowedRoles: OWNER_AND_STAFF,
  },
  {
    key: 'payments',
    label: 'Payments',
    href: ROUTES.payments,
    iconName: 'CreditCard',
    allowedRoles: OWNER_STAFF_ACCOUNTANT,
  },
  {
    key: 'products',
    label: 'Products & Services',
    href: ROUTES.products,
    iconName: 'Package',
    allowedRoles: OWNER_AND_STAFF,
  },
  {
    key: 'inventory',
    label: 'Inventory',
    href: `${ROUTES.products}/stock`,
    iconName: 'Warehouse',
    allowedRoles: OWNER_AND_STAFF,
  },
  {
    key: 'expenses',
    label: 'Expenses & Accounting',
    href: ROUTES.expenses,
    iconName: 'Receipt',
    allowedRoles: OWNER_STAFF_ACCOUNTANT,
  },
  {
    key: 'banking',
    label: 'Banking',
    href: ROUTES.banking,
    iconName: 'Landmark',
    allowedRoles: OWNER_STAFF_ACCOUNTANT,
  },
  {
    key: 'projects',
    label: 'Projects & Time',
    href: ROUTES.projects,
    iconName: 'FolderKanban',
    allowedRoles: OWNER_AND_STAFF,
  },
  {
    key: 'reports',
    label: 'Reports',
    href: ROUTES.reports,
    iconName: 'BarChart3',
    allowedRoles: OWNER_STAFF_ACCOUNTANT,
  },
  {
    key: 'wallet',
    label: 'Wallet & Payouts',
    href: ROUTES.payouts,
    iconName: 'Wallet',
    allowedRoles: OWNER_ONLY,
  },
  {
    key: 'loyalty',
    label: 'Loyalty & Reviews',
    href: ROUTES.loyalty,
    iconName: 'Gift',
    allowedRoles: OWNER_AND_STAFF,
  },
  {
    key: 'marketing',
    label: 'Marketing',
    href: ROUTES.marketing,
    iconName: 'Megaphone',
    allowedRoles: OWNER_ONLY,
  },
  {
    key: 'marketplace',
    label: 'Marketplace',
    href: ROUTES.marketplace,
    iconName: 'Store',
    allowedRoles: OWNER_ONLY,
  },
  {
    key: 'channels',
    label: 'Messaging Channels',
    href: ROUTES.messages,
    iconName: 'MessageCircle',
    allowedRoles: OWNER_ONLY,
  },
  {
    key: 'files',
    label: 'Files',
    href: ROUTES.files,
    iconName: 'FolderOpen',
    allowedRoles: OWNER_AND_STAFF,
  },
  {
    key: 'developers',
    label: 'Developer apps',
    href: ROUTES.developers,
    iconName: 'Code2',
    allowedRoles: OWNER_ONLY,
  },
  {
    key: 'billing',
    label: 'Plan & billing',
    href: ROUTES.billing,
    iconName: 'BadgeDollarSign',
    allowedRoles: OWNER_ONLY,
  },
  {
    key: 'affiliate',
    label: 'Affiliate Program',
    href: ROUTES.affiliate,
    iconName: 'Share2',
    allowedRoles: ['affiliate'],
  },
  {
    key: 'reseller',
    label: 'My Sub-Tenants',
    href: ROUTES.reseller,
    iconName: 'Building2',
    allowedRoles: ['reseller'],
  },
  {
    key: 'team',
    label: 'Team',
    href: ROUTES.team,
    iconName: 'UserCog',
    allowedRoles: OWNER_ONLY,
  },
  {
    key: 'settings',
    label: 'Settings',
    href: ROUTES.settings,
    iconName: 'Settings',
    allowedRoles: OWNER_ONLY,
  },
  {
    key: 'admin',
    label: 'Super Admin',
    href: ROUTES.admin,
    iconName: 'ShieldCheck',
    allowedRoles: ['super_admin'],
    children: [
      {
        key: 'admin-tenants',
        label: 'Tenants',
        href: `${ROUTES.admin}/tenants`,
        iconName: 'Building',
        allowedRoles: ['super_admin'],
      },
      {
        key: 'admin-verification',
        label: 'KYC Review',
        href: `${ROUTES.admin}/verification`,
        iconName: 'BadgeCheck',
        allowedRoles: ['super_admin'],
      },
      {
        key: 'admin-integrations',
        label: 'Gateways',
        href: `${ROUTES.admin}/integrations`,
        iconName: 'Plug',
        allowedRoles: ['super_admin'],
      },
      {
        key: 'admin-content',
        label: 'CMS & Blog',
        href: `${ROUTES.admin}/content`,
        iconName: 'Newspaper',
        allowedRoles: ['super_admin'],
      },
      {
        key: 'admin-platform',
        label: 'Platform Settings',
        href: `${ROUTES.admin}/platform`,
        iconName: 'Cog',
        allowedRoles: ['super_admin'],
      },
    ],
  },
];

/**
 * Filters the central nav map down to the items a given role is allowed to
 * see, preserving nested children's own role filtering.
 *
 * @param role The role to filter navigation for.
 * @returns Only the nav items (and matching children) visible to `role`.
 */
export function getNavItemsForRole(role: AccountRole): readonly NavItem[] {
  return NAV_MAP.filter((item) => item.allowedRoles.includes(role)).map((item) =>
    item.children
      ? { ...item, children: item.children.filter((child) => child.allowedRoles.includes(role)) }
      : item
  );
}

export type NavIconName = string;
export interface NavSectionItem {
  readonly key: string;
  readonly label: string;
  readonly href: string;
  readonly icon: NavIconName;
  readonly roles: readonly AccountRole[];
  readonly permission?: string;
  readonly isBuilt?: boolean;
  readonly isExact?: boolean;
}
export interface NavSection {
  readonly key: string;
  readonly label: string;
  readonly items: readonly NavSectionItem[];
}
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    key: 'main',
    label: 'Main',
    items: NAV_MAP.map((item) => ({
      key: item.key,
      label: item.label,
      href: item.href,
      icon: item.iconName,
      roles: item.allowedRoles,
      isBuilt: true,
    })),
  },
];

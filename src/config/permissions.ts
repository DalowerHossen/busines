// src/config/permissions.ts
// Central role capability matrix. This is the single source of truth both
// UI gating and the server-side authorization layer (added in Phase 20)
// read from, so a permission rule is defined in exactly one place. See
// docs/planning/ARCHITECTURE-DECISIONS.md section 2 for the locked role
// model this matrix encodes.
import type { AccountRole } from '@/types/auth';

/**
 * Every capability the platform checks access for. Grouped by domain with
 * a `resource.action` naming convention for readability.
 */
export type Capability =
  | 'clients.manage'
  | 'invoices.manage_drafts'
  | 'invoices.send'
  | 'invoices.request_send'
  | 'estimates.manage'
  | 'payments.view'
  | 'payments.refund'
  | 'expenses.manage'
  | 'reports.view'
  | 'reports.export'
  | 'journal.manage'
  | 'wallet.manage'
  | 'payouts.request'
  | 'team.manage'
  | 'settings.manage'
  | 'kyc.submit'
  | 'kyc.review'
  | 'gateways.configure'
  | 'reseller.manage_sub_tenants'
  | 'affiliate.view_own_stats'
  | 'platform.manage_tenants'
  | 'platform.manage_cms';

/**
 * The complete, explicit capability grant for every account role. A role
 * not listed for a capability is denied by default (deny-by-default,
 * matching the project's RLS posture).
 */
export const ROLE_CAPABILITIES: Readonly<Record<AccountRole, readonly Capability[]>> = {
  super_admin: [
    'clients.manage',
    'invoices.manage_drafts',
    'invoices.send',
    'estimates.manage',
    'payments.view',
    'payments.refund',
    'expenses.manage',
    'reports.view',
    'reports.export',
    'journal.manage',
    'wallet.manage',
    'payouts.request',
    'team.manage',
    'settings.manage',
    'kyc.review',
    'gateways.configure',
    'reseller.manage_sub_tenants',
    'platform.manage_tenants',
    'platform.manage_cms',
  ],
  reseller: ['reseller.manage_sub_tenants'],
  owner: [
    'clients.manage',
    'invoices.manage_drafts',
    'invoices.send',
    'estimates.manage',
    'payments.view',
    'payments.refund',
    'expenses.manage',
    'reports.view',
    'reports.export',
    'wallet.manage',
    'payouts.request',
    'team.manage',
    'settings.manage',
    'kyc.submit',
    'gateways.configure',
  ],
  staff: [
    'clients.manage',
    'invoices.manage_drafts',
    'invoices.request_send',
    'estimates.manage',
    'payments.view',
    'expenses.manage',
    'reports.view',
  ],
  accountant: ['payments.view', 'reports.view', 'reports.export', 'journal.manage'],
  affiliate: ['affiliate.view_own_stats'],
};

/**
 * Checks whether a role has been granted a given capability.
 *
 * @param role The account role to check.
 * @param capability The capability being requested.
 * @returns `true` if the role is explicitly granted the capability.
 */
export function roleHasCapability(role: AccountRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

import type { PermissionAction } from '@/types/enums';
export type PermissionResource =
  | 'clients'
  | 'invoices'
  | 'payments'
  | 'expenses'
  | 'reports'
  | 'team'
  | 'products'
  | 'estimates'
  | 'settings'
  | 'subscriptions'
  | 'banking'
  | 'contracts'
  | 'accounting'
  | 'files';
export type PermissionMap = Partial<Record<PermissionResource, PermissionAction[]>>;
export const PERMISSION_RESOURCES = [
  'clients',
  'invoices',
  'payments',
  'expenses',
  'reports',
  'team',
  'products',
  'estimates',
  'settings',
  'subscriptions',
  'banking',
  'contracts',
  'accounting',
  'files',
] as const;
export const RESOURCE_DEFINITIONS: Readonly<
  Record<string, { label: string; description: string; actions: readonly PermissionAction[] }>
> = {
  clients: {
    label: 'Clients',
    description: 'Client records and contacts.',
    actions: ['view', 'create', 'edit', 'delete', 'export'],
  },
  invoices: {
    label: 'Invoices',
    description: 'Invoices and collections.',
    actions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  },
  payments: {
    label: 'Payments',
    description: 'Payments and refunds.',
    actions: ['view', 'create', 'approve', 'export'],
  },
  expenses: {
    label: 'Expenses',
    description: 'Expenses and accounting.',
    actions: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  },
  reports: { label: 'Reports', description: 'Reports and exports.', actions: ['view', 'export'] },
  team: {
    label: 'Team',
    description: 'Team access.',
    actions: ['view', 'create', 'edit', 'delete'],
  },
};
export const RESOURCE_GROUPS = [
  {
    key: 'business',
    label: 'Business',
    resources: ['clients', 'invoices', 'payments', 'expenses'] as PermissionResource[],
  },
  { key: 'oversight', label: 'Oversight', resources: ['reports', 'team'] as PermissionResource[] },
] as const;
export const DEFAULT_STAFF_PERMISSIONS: PermissionMap = {
  clients: ['view', 'create', 'edit'],
  invoices: ['view', 'create', 'edit'],
  payments: ['view'],
  expenses: ['view', 'create', 'edit'],
  reports: ['view'],
};
export const ACCOUNTANT_PERMISSIONS: PermissionMap = {
  payments: ['view', 'export'],
  expenses: ['view', 'export'],
  reports: ['view', 'export'],
};
export function sanitisePermissionMap(value: unknown): PermissionMap {
  if (!value || typeof value !== 'object') return {};
  const result: PermissionMap = {};
  for (const resource of PERMISSION_RESOURCES) {
    const actions = (value as Record<string, unknown>)[resource];
    if (Array.isArray(actions))
      result[resource] = actions.filter(
        (action): action is PermissionAction => typeof action === 'string'
      ) as PermissionAction[];
  }
  return result;
}

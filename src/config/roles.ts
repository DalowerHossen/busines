// src/config/roles.ts
// What each account role is for, where it lands after signing in, and the
// permissions it starts with before any per account tuning.

import { ROUTES } from '@/config/app';
import {
  ACCOUNTANT_PERMISSIONS,
  DEFAULT_STAFF_PERMISSIONS,
  type PermissionMap,
} from '@/config/permissions';
import type { UserRole } from '@/types/enums';

export interface RoleDefinition {
  role: UserRole;
  label: string;
  description: string;
  landingPath: string;
  canSendClientEmail: boolean;
  belongsToOneCompany: boolean;
  defaultPermissions: PermissionMap;
}

export const ROLE_DEFINITIONS: Readonly<Record<UserRole, RoleDefinition>> = {
  super_admin: {
    role: 'super_admin',
    label: 'Platform administrator',
    description: 'Runs the platform, every tenant and every global setting.',
    landingPath: ROUTES.admin,
    canSendClientEmail: true,
    belongsToOneCompany: false,
    defaultPermissions: {},
  },
  reseller: {
    role: 'reseller',
    label: 'Reseller',
    description:
      'Sells the platform under its own brand and manages its sub tenants, without reading their invoices or clients.',
    landingPath: ROUTES.reseller,
    canSendClientEmail: false,
    belongsToOneCompany: false,
    defaultPermissions: {},
  },
  owner: {
    role: 'owner',
    label: 'Company owner',
    description:
      'Owns one company, holds every permission inside it and is the only account that sends client email.',
    landingPath: ROUTES.dashboard,
    canSendClientEmail: true,
    belongsToOneCompany: true,
    defaultPermissions: {},
  },
  staff: {
    role: 'staff',
    label: 'Team member',
    description:
      'Works inside one company with the permissions the owner granted. May draft and request a send, never send.',
    landingPath: ROUTES.dashboard,
    canSendClientEmail: false,
    belongsToOneCompany: true,
    defaultPermissions: DEFAULT_STAFF_PERMISSIONS,
  },
  accountant: {
    role: 'accountant',
    label: 'Accountant',
    description: 'Reads the books of every company that invited them and posts journal entries.',
    landingPath: ROUTES.accountant,
    canSendClientEmail: false,
    belongsToOneCompany: false,
    defaultPermissions: ACCOUNTANT_PERMISSIONS,
  },
  affiliate: {
    role: 'affiliate',
    label: 'Affiliate',
    description: 'Sees only their own referral clicks, signups, commission and payouts.',
    landingPath: ROUTES.affiliate,
    canSendClientEmail: false,
    belongsToOneCompany: false,
    defaultPermissions: {},
  },
};

/** Roles a company owner may invite into their own company. */
export const INVITABLE_ROLES: readonly UserRole[] = ['staff', 'accountant'];

/** Roles that work inside the tenant dashboard. */
export const TENANT_ROLES: readonly UserRole[] = ['owner', 'staff'];

/**
 * Returns the definition of an account role.
 *
 * @param role Account role to describe.
 * @returns The matching role definition.
 */
export function describeRole(role: UserRole): RoleDefinition {
  return ROLE_DEFINITIONS[role];
}

/**
 * Returns the first page a signed in account should see.
 *
 * @param role Account role of the signed in user.
 * @returns An application path.
 */
export function landingPathForRole(role: UserRole): string {
  return ROLE_DEFINITIONS[role].landingPath;
}

/**
 * Reports whether a role may send email to a client.
 *
 * @param role Account role to check.
 * @returns True for owners and platform administrators only.
 */
export function canSendClientEmail(role: UserRole): boolean {
  return ROLE_DEFINITIONS[role].canSendClientEmail;
}

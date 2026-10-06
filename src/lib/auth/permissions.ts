// src/lib/auth/permissions.ts
// Permission checks against a session. The same rules run in the database, so
// a check here is a fast first answer, never the only line of defence.

import {
  RESOURCE_DEFINITIONS,
  type PermissionMap,
  type PermissionResource,
} from '@/config/permissions';
import { ROLE_DEFINITIONS } from '@/config/roles';
import type { SessionUser } from '@/lib/auth/types';
import type { PermissionAction, UserRole } from '@/types/enums';

/**
 * Reports whether a role holds every permission inside its company.
 *
 * @param role Account role to inspect.
 * @returns True for owners and platform administrators.
 */
export function roleHoldsEveryPermission(role: UserRole): boolean {
  return role === 'owner' || role === 'super_admin';
}

/**
 * Reports whether a permission map allows an action on a resource.
 *
 * @param permissions Permission map held by the account.
 * @param resource Resource being reached.
 * @param action Action being attempted.
 * @returns True when the action is allowed.
 */
export function mapAllows(
  permissions: PermissionMap,
  resource: PermissionResource,
  action: PermissionAction
): boolean {
  return permissions[resource]?.includes(action) ?? false;
}

/**
 * Reports whether an account may perform an action on a resource.
 *
 * @param user Signed in account.
 * @param resource Resource being reached.
 * @param action Action being attempted.
 * @returns True when the action is allowed.
 */
export function can(
  user: SessionUser,
  resource: PermissionResource,
  action: PermissionAction
): boolean {
  if (user.status !== 'active') {
    return false;
  }

  if (roleHoldsEveryPermission(user.role)) {
    return true;
  }

  if (user.role === 'staff' || user.role === 'accountant') {
    const granted = mapAllows(user.permissions, resource, action);
    const roleDefault = ROLE_DEFINITIONS[user.role].defaultPermissions;
    return granted || (user.role === 'accountant' && mapAllows(roleDefault, resource, action));
  }

  return false;
}

/**
 * Reports whether an account may read a resource at all.
 *
 * @param user Signed in account.
 * @param resource Resource being reached.
 * @returns True when the resource may be opened.
 */
export function canView(user: SessionUser, resource: PermissionResource): boolean {
  return can(user, resource, 'view');
}

/**
 * Lists the resources an account may open, for building the navigation.
 *
 * @param user Signed in account.
 * @returns The resources with at least view access.
 */
export function visibleResources(user: SessionUser): PermissionResource[] {
  return (Object.keys(RESOURCE_DEFINITIONS) as PermissionResource[]).filter((resource) =>
    canView(user, resource)
  );
}

/**
 * Reports whether the account is the only role allowed to send client email.
 *
 * @param user Signed in account.
 * @returns True for an owner or a platform administrator.
 */
export function canSendToClients(user: SessionUser): boolean {
  return ROLE_DEFINITIONS[user.role].canSendClientEmail && user.status === 'active';
}

/**
 * Reports whether the account may only ask an owner to send on its behalf.
 *
 * @param user Signed in account.
 * @returns True when the account must raise a send request.
 */
export function mustRequestSend(user: SessionUser): boolean {
  return user.role === 'staff';
}

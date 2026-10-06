// src/lib/auth/guards.ts
// Guards used at the top of every server action, route handler and protected
// page. Each one either returns the context the caller needs or throws an
// error that the wrappers translate into the right answer.

import 'server-only';

import type { PermissionResource } from '@/config/permissions';
import { can, canSendToClients } from '@/lib/auth/permissions';
import { resolveCompanyContext } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import type { CompanyContext, SessionUser, TenantContext } from '@/lib/auth/types';
import { AppError, forbiddenError, unauthenticatedError } from '@/lib/errors';
import type { PermissionAction, UserRole } from '@/types/enums';

/**
 * Requires a signed in account in good standing.
 *
 * @returns The signed in account.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    throw unauthenticatedError();
  }

  if (user.status === 'suspended' || user.status === 'banned') {
    throw forbiddenError('This account is suspended. Please contact support.');
  }

  if (user.status === 'closed') {
    throw forbiddenError('This account has been closed.');
  }

  return user;
}

/**
 * Requires the signed in account to hold one of the given roles.
 *
 * @param roles Roles that may continue.
 * @returns The signed in account.
 */
export async function requireRole(roles: readonly UserRole[]): Promise<SessionUser> {
  const user = await requireUser();

  if (!roles.includes(user.role)) {
    throw forbiddenError('You do not have access to this area.');
  }

  return user;
}

/**
 * Requires a platform administrator.
 *
 * @returns The signed in account.
 */
export async function requireSuperAdmin(): Promise<SessionUser> {
  return requireRole(['super_admin']);
}

/**
 * Requires an account that works inside a company, and resolves that company.
 *
 * @param requestedCompanyId Company asked for by an accountant or an
 * administrator who is not tied to one tenant.
 * @returns The account and the company it is acting inside.
 */
export async function requireTenant(requestedCompanyId?: string | null): Promise<TenantContext> {
  const user = await requireUser();
  const company = await resolveCompanyContext(requestedCompanyId);

  return {
    user,
    company,
    isGuestAccess: user.companyId !== company.id,
  };
}

/**
 * Requires the owner of the company being acted inside.
 *
 * @param requestedCompanyId Company asked for, when the caller is not tied to
 * one tenant.
 * @returns The account and the company it owns.
 */
export async function requireOwner(requestedCompanyId?: string | null): Promise<TenantContext> {
  const context = await requireTenant(requestedCompanyId);

  if (context.user.role !== 'owner' && context.user.role !== 'super_admin') {
    throw forbiddenError('Only the company owner can do this.');
  }

  return context;
}

/**
 * Requires a permission on a resource inside a company.
 *
 * @param resource Resource being reached.
 * @param action Action being attempted.
 * @param requestedCompanyId Company asked for, when the caller is not tied to
 * one tenant.
 * @returns The account and the company it is acting inside.
 */
export async function requirePermission(
  resource: PermissionResource,
  action: PermissionAction,
  requestedCompanyId?: string | null
): Promise<TenantContext> {
  const context = await requireTenant(requestedCompanyId);

  if (!can(context.user, resource, action)) {
    throw forbiddenError('You do not have permission to do this.');
  }

  return context;
}

/**
 * Requires that the company may still be written to.
 *
 * @param company Company being written to.
 * @returns Nothing.
 */
export function requireWritableCompany(company: CompanyContext): void {
  if (company.isReadOnly) {
    throw new AppError(
      'forbidden',
      'This workspace is read only at the moment. Please contact support to restore full access.'
    );
  }
}

/**
 * Requires the right to send email to a client.
 *
 * @param requestedCompanyId Company asked for, when the caller is not tied to
 * one tenant.
 * @returns The account and the company it is acting inside.
 */
export async function requireSender(requestedCompanyId?: string | null): Promise<TenantContext> {
  const context = await requireTenant(requestedCompanyId);

  if (!canSendToClients(context.user)) {
    throw forbiddenError(
      'Only the company owner can send email to a client. Ask the owner to approve your send request.'
    );
  }

  requireWritableCompany(context.company);

  return context;
}

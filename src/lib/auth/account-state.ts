// src/lib/auth/account-state.ts
// The checks that decide what a signed in account is allowed to see today:
// email verification, two factor enforcement, tenant standing and the
// verification a tenant needs before it can collect money.

import type { CompanyContext, SessionUser } from '@/lib/auth/types';
import { ROUTES } from '@/config/app';
import type { KycStatus } from '@/types/enums';

export type AccountGateReason =
  | 'email_unverified'
  | 'two_factor_required'
  | 'account_suspended'
  | 'company_suspended'
  | 'company_read_only'
  | 'onboarding_incomplete';

export interface AccountGate {
  isBlocked: boolean;
  reason: AccountGateReason | null;
  message: string;
  redirectTo: string | null;
}

const ALLOWED: AccountGate = {
  isBlocked: false,
  reason: null,
  message: '',
  redirectTo: null,
};

/**
 * Decides whether an account may use the application right now.
 *
 * @param user Signed in account.
 * @param company Company being acted inside, when there is one.
 * @param twoFactorRequired True when the tenant policy forces two factor.
 * @returns What to do with the request.
 */
export function evaluateAccountGate(
  user: SessionUser,
  company: CompanyContext | null,
  twoFactorRequired = false
): AccountGate {
  if (user.status === 'suspended' || user.status === 'banned') {
    return {
      isBlocked: true,
      reason: 'account_suspended',
      message: 'This account is suspended. Please contact support.',
      redirectTo: ROUTES.login,
    };
  }

  if (!user.emailVerifiedAt) {
    return {
      isBlocked: true,
      reason: 'email_unverified',
      message: 'Confirm your email address to continue.',
      redirectTo: ROUTES.verifyEmail,
    };
  }

  if (twoFactorRequired && !user.twoFactorEnabled) {
    return {
      isBlocked: true,
      reason: 'two_factor_required',
      message: 'Two step verification is required in this workspace.',
      redirectTo: ROUTES.twoFactor,
    };
  }

  if (company && company.status === 'suspended') {
    return {
      isBlocked: true,
      reason: 'company_suspended',
      message: 'This workspace is suspended. Please contact support.',
      redirectTo: ROUTES.dashboard,
    };
  }

  if (company && company.status === 'closed') {
    return {
      isBlocked: true,
      reason: 'company_suspended',
      message: 'This workspace has been closed.',
      redirectTo: ROUTES.login,
    };
  }

  return ALLOWED;
}

/**
 * Reports whether a tenant has finished the verification needed to be paid
 * through the platform as merchant of record.
 *
 * @param status Verification status of the tenant.
 * @returns True when payouts may be released.
 */
export function isKycComplete(status: KycStatus): boolean {
  return status === 'verified';
}

/**
 * Describes the verification state in words a tenant understands.
 *
 * @param status Verification status of the tenant.
 * @returns A sentence for the banner at the top of the dashboard.
 */
export function describeKycStatus(status: KycStatus): string {
  switch (status) {
    case 'not_started':
      return 'Verify your business to start receiving payouts.';
    case 'in_progress':
      return 'Your verification is saved but not submitted yet.';
    case 'submitted':
      return 'Your documents are with our team.';
    case 'under_review':
      return 'Your verification is being reviewed.';
    case 'verified':
      return 'Your business is verified.';
    case 'rejected':
      return 'Your verification was declined. Please upload clearer documents.';
    case 'expired':
      return 'Your verification has expired. Please upload current documents.';
    default:
      return 'Your verification status is unavailable.';
  }
}

/**
 * Reports how much of a storage quota has been used.
 *
 * @param company Company being measured.
 * @returns A percentage between zero and one hundred.
 */
export function storageUsedPercentage(company: CompanyContext): number {
  if (company.storageQuotaBytes <= 0) {
    return 0;
  }

  return Math.min(100, (company.storageUsedBytes / company.storageQuotaBytes) * 100);
}

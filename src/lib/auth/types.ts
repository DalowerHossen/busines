// src/lib/auth/types.ts
// The shapes that describe who is making a request and what they may reach.

import type { PermissionMap } from '@/config/permissions';
import type { CompanyStatus, KycStatus, UserRole, UserStatus } from '@/types/enums';

/** The signed in account, as the application needs it on every request. */
export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  companyId: string | null;
  permissions: PermissionMap;
  avatarUrl: string | null;
  timeZone: string;
  locale: string;
  twoFactorEnabled: boolean;
  emailVerifiedAt: string | null;
  suspendedAt: string | null;
  lastLoginAt: string | null;
}

/** The company a request is being made against. */
export interface CompanyContext {
  id: string;
  slug: string;
  displayName: string;
  legalName: string;
  status: CompanyStatus;
  countryCode: string;
  baseCurrency: string;
  timeZone: string;
  dateFormat: string;
  kycStatus: KycStatus;
  morEnabled: boolean;
  storageQuotaBytes: number;
  storageUsedBytes: number;
  trialEndsAt: string | null;
  isReadOnly: boolean;
}

/** A signed in account together with the company it is acting inside. */
export interface TenantContext {
  user: SessionUser;
  company: CompanyContext;
  /** True when the account reaches this company through an access grant. */
  isGuestAccess: boolean;
}

/** What a client holding a signed link may see, with no account at all. */
export interface LinkAccessContext {
  companyId: string;
  documentId: string;
  recipientId: string | null;
  purpose: string;
  expiresAt: number;
}

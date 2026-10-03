// src/types/auth.ts
// Authentication, account, and role types. See
// docs/planning/ARCHITECTURE-DECISIONS.md section 2 for the locked role
// model: six account roles plus one account-less "client" access mode that
// is intentionally NOT part of this union (clients never sign in; see
// src/types/invoice.ts ClientAccessToken for how they reach a document).
import type { ISODateString, PlatformEntity, TenantScopedEntity, UUID } from '@/types/core';

/**
 * Every account role in the system. There is no separate "client" role:
 * end customers never hold an account, they only use tokenized links (see
 * ClientAccessToken in src/types/invoice.ts).
 */
export type AccountRole =
  | 'super_admin'
  | 'reseller'
  | 'owner'
  | 'staff'
  | 'accountant'
  | 'affiliate';

/**
 * A platform user. One `User` can belong to multiple companies through
 * `CompanyMembership` (for example an accountant invited by several
 * owners), except `super_admin` and `reseller` which operate above the
 * per-company membership model.
 */
export interface User extends PlatformEntity {
  readonly email: string;
  readonly fullName: string;
  readonly avatarProviderFileId: string | null;
  readonly isEmailVerified: boolean;
  readonly isTwoFactorEnabled: boolean;
  readonly lastLoginAt: ISODateString | null;
}

/**
 * Links a `User` to a `Company` with exactly one role in that company. A
 * `super_admin` and `reseller` are platform-level and do not require a row
 * here to act, but `owner`, `staff`, and `affiliate` always belong to
 * exactly one company, and `accountant` may belong to several (see
 * AccountantCompanyAccess).
 */
export interface CompanyMembership extends TenantScopedEntity {
  readonly userId: UUID;
  readonly role: Extract<AccountRole, 'owner' | 'staff' | 'affiliate'>;
  readonly invitedByUserId: UUID | null;
  readonly isActive: boolean;
  readonly permissions: readonly StaffPermission[];
}

/**
 * Fine-grained permissions assignable to a `staff` member by the `owner`.
 * `send_client_email` is intentionally never grantable to staff: only the
 * owner may send client-facing emails (staff can only prepare a draft and
 * request the owner send it), per the locked client-access model.
 */
export type StaffPermission =
  | 'manage_clients'
  | 'manage_products'
  | 'manage_invoices'
  | 'manage_estimates'
  | 'manage_expenses'
  | 'manage_inventory'
  | 'view_reports'
  | 'request_send_client_email';

/**
 * Grants an `accountant` read and journal access to a specific company,
 * independent of the single-company `CompanyMembership` model used by
 * owner/staff/affiliate. An accountant can hold one row per company they
 * have been invited into.
 */
export interface AccountantCompanyAccess extends TenantScopedEntity {
  readonly accountantUserId: UUID;
  readonly invitedByUserId: UUID;
  readonly isActive: boolean;
}

/**
 * Links a `reseller` user to the companies created under their white-label
 * program. A reseller can see only its own sub-tenants' billing metadata
 * (plan, invoiced amount, status), never the sub-tenant's own
 * invoice/client data.
 */
export interface ResellerSubTenant extends PlatformEntity {
  readonly resellerUserId: UUID;
  readonly companyId: UUID;
}

/**
 * The company (tenant) record. Every `owner`, `staff` member, and piece of
 * business data (clients, invoices, products) belongs to exactly one
 * company.
 */
export interface Company extends PlatformEntity {
  readonly ownerUserId: UUID;
  readonly name: string;
  readonly slug: string;
  readonly planId: UUID;
  readonly logoProviderFileId: string | null;
  readonly defaultCurrency: string;
  readonly invoicePrefix: string;
  readonly kycStatus: KycStatus;
  readonly isSuspended: boolean;
}

/**
 * Manual KYC review state for a company that wants to opt into the
 * platform's Merchant-of-Record payment path. KYC review is always manual
 * (no OCR/automated verification of the documents themselves), per the
 * locked MoR/KYC decision.
 */
export type KycStatus = 'not_started' | 'pending_review' | 'approved' | 'rejected';

/**
 * An authenticated session, mirroring the Supabase Auth session plus the
 * application-level role resolved for the active company context.
 */
export interface AuthSession {
  readonly userId: UUID;
  readonly email: string;
  readonly activeCompanyId: UUID | null;
  readonly role: AccountRole | null;
  readonly expiresAt: ISODateString;
}

/**
 * Supported second factor methods for account security.
 */
export type TwoFactorMethod = 'totp' | 'sms';

// src/types/enums.ts
// Mirrors of the PostgreSQL enumerated types. Every list here is kept in the
// same order as the migration that creates it, so a value accepted by the
// compiler is always accepted by the database.

export const USER_ROLES = [
  'super_admin',
  'reseller',
  'owner',
  'staff',
  'accountant',
  'affiliate',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = [
  'pending_verification',
  'active',
  'suspended',
  'banned',
  'closed',
] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export const COMPANY_STATUSES = [
  'onboarding',
  'trialing',
  'active',
  'past_due',
  'suspended',
  'read_only',
  'closed',
] as const;

export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const INVITATION_STATUSES = ['pending', 'accepted', 'expired', 'revoked'] as const;

export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const RESELLER_STATUSES = ['pending_review', 'approved', 'suspended', 'terminated'] as const;

export type ResellerStatus = (typeof RESELLER_STATUSES)[number];

export const AFFILIATE_STATUSES = [
  'pending_review',
  'approved',
  'suspended',
  'terminated',
] as const;

export type AffiliateStatus = (typeof AFFILIATE_STATUSES)[number];

export const TWO_FACTOR_METHODS = ['totp', 'recovery_code'] as const;

export type TwoFactorMethod = (typeof TWO_FACTOR_METHODS)[number];

export const AUTH_PROVIDERS = ['email', 'google', 'github'] as const;

export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export const PERMISSION_ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'approve',
  'export',
  'send',
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const ACCESS_GRANT_STATUSES = ['active', 'revoked', 'expired'] as const;

export type AccessGrantStatus = (typeof ACCESS_GRANT_STATUSES)[number];

export const DOCUMENT_TYPES = [
  'invoice',
  'estimate',
  'credit_note',
  'debit_note',
  'proforma_invoice',
  'deposit_invoice',
  'recurring_invoice',
  'purchase_order',
  'supplier_bill',
  'delivery_note',
  'contract',
  'payment_receipt',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const INVOICE_STATUSES = [
  'draft',
  'scheduled',
  'sent',
  'viewed',
  'partially_paid',
  'paid',
  'overdue',
  'disputed',
  'written_off',
  'cancelled',
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const ESTIMATE_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'approved',
  'declined',
  'expired',
  'converted',
  'cancelled',
] as const;

export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export const RECURRENCE_FREQUENCIES = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
  'custom',
] as const;

export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const RECURRING_SCHEDULE_STATUSES = [
  'draft',
  'active',
  'paused',
  'completed',
  'cancelled',
] as const;

export type RecurringScheduleStatus = (typeof RECURRING_SCHEDULE_STATUSES)[number];

export const EXPENSE_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'reimbursed',
] as const;

export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const TAX_MODES = ['exclusive', 'inclusive', 'none'] as const;

export type TaxMode = (typeof TAX_MODES)[number];

export const DISCOUNT_TYPES = ['percentage', 'fixed_amount'] as const;

export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const PAYMENT_STATUSES = [
  'pending',
  'requires_action',
  'authorized',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
  'partially_refunded',
  'refunded',
  'disputed',
  'charged_back',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const REFUND_STATUSES = [
  'requested',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
] as const;

export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const DISPUTE_STATUSES = [
  'open',
  'evidence_required',
  'evidence_submitted',
  'under_review',
  'won',
  'lost',
  'withdrawn',
] as const;

export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const PAYOUT_METHODS = [
  'bank_transfer',
  'bkash',
  'nagad',
  'paypal',
  'adyen_transfer',
  'nium_transfer',
  'wallet_credit',
] as const;

export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const PAYOUT_STATUSES = [
  'requested',
  'under_review',
  'approved',
  'processing',
  'completed',
  'failed',
  'rejected',
  'cancelled',
] as const;

export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const WALLET_TRANSACTION_TYPES = [
  'credit',
  'debit',
  'platform_fee',
  'gateway_fee',
  'hold',
  'release',
  'payout',
  'payout_reversal',
  'refund',
  'chargeback',
  'commission',
  'adjustment',
] as const;

export type WalletTransactionType = (typeof WALLET_TRANSACTION_TYPES)[number];

export const PAYMENT_METHOD_TYPES = [
  'card',
  'bank_transfer',
  'mobile_money',
  'digital_wallet',
  'buy_now_pay_later',
  'cash',
  'cheque',
  'platform_wallet',
  'other',
] as const;

export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

export const GATEWAY_PROVIDERS = [
  'stripe',
  'paypal',
  'paddle',
  'nmi',
  'twocheckout',
  'adyen',
  'nium',
  'bkash',
  'nagad',
  'manual',
  'bnpl_partner',
  'custom',
] as const;

export type GatewayProvider = (typeof GATEWAY_PROVIDERS)[number];

export const GATEWAY_MODES = ['test', 'live'] as const;

export type GatewayMode = (typeof GATEWAY_MODES)[number];

export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'paused',
  'cancelled',
  'expired',
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const COUPON_TYPES = ['percentage', 'fixed_amount', 'free_trial_extension'] as const;

export type CouponType = (typeof COUPON_TYPES)[number];

export const BILLING_INTERVALS = ['monthly', 'annual', 'lifetime'] as const;

export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const KYC_STATUSES = [
  'not_started',
  'in_progress',
  'submitted',
  'under_review',
  'verified',
  'rejected',
  'expired',
] as const;

export type KycStatus = (typeof KYC_STATUSES)[number];

export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];

export const CLIENT_TYPES = ['individual', 'business'] as const;

export type ClientType = (typeof CLIENT_TYPES)[number];

export const CLIENT_STATUSES = ['active', 'inactive', 'archived'] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const ADDRESS_TYPES = ['billing', 'shipping'] as const;

export type AddressType = (typeof ADDRESS_TYPES)[number];

export const PRODUCT_TYPES = [
  'goods',
  'service',
  'digital',
  'subscription',
  'billable_expense',
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_STATUSES = ['active', 'inactive', 'archived'] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const TAX_RATE_KINDS = [
  'vat',
  'gst',
  'sales_tax',
  'service_tax',
  'withholding',
  'other',
] as const;

export type TaxRateKind = (typeof TAX_RATE_KINDS)[number];

export const MESSAGE_CHANNELS = [
  'email',
  'whatsapp',
  'sms',
  'telegram',
  'viber',
  'in_app',
] as const;

export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const MESSAGE_STATUSES = [
  'queued',
  'scheduled',
  'sending',
  'sent',
  'delivered',
  'read',
  'failed',
  'bounced',
  'complained',
  'suppressed',
] as const;

export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const AUDIT_ACTIONS = [
  'insert',
  'update',
  'soft_delete',
  'restore',
  'hard_delete',
  'login',
  'logout',
  'login_failed',
  'password_change',
  'two_factor_change',
  'permission_change',
  'impersonation_start',
  'impersonation_end',
  'export',
  'import',
  'send',
  'view_sensitive',
  'download',
  'approve',
  'reject',
  'settings_change',
  'secret_change',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Reports whether a value is one of the six account roles.
 *
 * @param value Candidate role string.
 * @returns True when the value is a known account role.
 */
export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.includes(value as UserRole);
}

/**
 * Reports whether a value is a permission action the database accepts.
 *
 * @param value Candidate action string.
 * @returns True when the value is a known action.
 */
export function isPermissionAction(value: unknown): value is PermissionAction {
  return typeof value === 'string' && PERMISSION_ACTIONS.includes(value as PermissionAction);
}

/**
 * Reports whether an invoice status still expects money to arrive.
 *
 * @param status Invoice status to inspect.
 * @returns True when a balance may still be collected.
 */
export function isCollectableInvoiceStatus(status: InvoiceStatus): boolean {
  return (
    status === 'sent' ||
    status === 'viewed' ||
    status === 'partially_paid' ||
    status === 'overdue' ||
    status === 'disputed'
  );
}

/**
 * Reports whether a company may still write data.
 *
 * @param status Company status to inspect.
 * @returns True when the tenant is not suspended, read only or closed.
 */
export function isWritableCompanyStatus(status: CompanyStatus): boolean {
  return (
    status === 'onboarding' || status === 'trialing' || status === 'active' || status === 'past_due'
  );
}

// src/types/invoice.ts
// Invoice-family domain types: invoices, estimates, recurring invoices,
// credit/debit notes, and the tokenized no-login client access model that
// replaces a traditional client login portal (see
// docs/planning/ARCHITECTURE-DECISIONS.md section 3 and
// docs/planning/FEATURE-REGISTRY.md group T1). Full Client/CRM record
// types (groups, tags, reminders, credit balance) are added in the phase
// that implements the clients migration; only the minimal snapshot and
// reference needed by an invoice are defined here.
import type { Address, ISODateString, Money, TenantScopedEntity, UUID } from '@/types/core';

/**
 * Lifecycle status of an invoice. `viewed` is set the first time a client
 * opens the tokenized link; `partially_paid` reflects the partial-payment
 * feature.
 */
export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'void';

/**
 * A frozen copy of the company's branding and profile data at the moment
 * an invoice was issued, so a later change to the company's logo or
 * address never alters a previously sent document. The logo-on-new-
 * invoices-only rule depends on this snapshot existing per invoice.
 */
export interface CompanyProfileSnapshot {
  readonly companyName: string;
  readonly logoProviderFileId: string | null;
  readonly address: Address;
  readonly taxId: string | null;
  readonly email: string;
  readonly phone: string | null;
}

/**
 * A frozen copy of the client's billing details at the moment an invoice
 * was issued, independent of the live `Client` CRM record.
 */
export interface InvoiceClientSnapshot {
  readonly clientId: UUID;
  readonly displayName: string;
  readonly email: string;
  readonly billingAddress: Address | null;
}

/**
 * One line item on an invoice or estimate.
 */
export interface InvoiceLineItem {
  readonly id: UUID;
  readonly productId: UUID | null;
  readonly description: string;
  readonly quantity: string;
  readonly unitPrice: Money;
  readonly taxRatePercent: string | null;
  readonly discountPercent: string | null;
  readonly lineTotal: Money;
  readonly sortOrder: number;
}

/**
 * A file attached to an invoice, stored through the configured storage
 * provider (Google Drive by default). Only the resulting reference is kept
 * here; see src/types/storage.ts for the upload contract.
 */
export interface InvoiceAttachment {
  readonly id: UUID;
  readonly providerFileId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeInBytes: number;
  readonly uploadedByUserId: UUID;
  readonly uploadedAt: ISODateString;
}

/**
 * A single scheduled or recorded installment on an invoice that supports
 * partial/installment payment.
 */
export interface InvoiceInstallment {
  readonly id: UUID;
  readonly dueDate: ISODateString;
  readonly amountDue: Money;
  readonly amountPaid: Money;
  readonly isPaid: boolean;
}

/**
 * An internal comment/note thread entry on an invoice, visible only to the
 * owner and staff (never the client).
 */
export interface InvoiceComment {
  readonly id: UUID;
  readonly authorUserId: UUID;
  readonly body: string;
  readonly createdAt: ISODateString;
}

/**
 * A reusable visual layout for rendering an invoice or estimate as a PDF
 * (for example "Classic" or "Modern Blue"). `companyId` is `null` for a
 * platform-provided built-in template available to every company, and set
 * for a company's own custom template. This is deliberately the simple
 * per-document layout selector only -- a much larger buy/sell Template
 * Marketplace (author profiles, ratings, revenue share, moderation) is a
 * separate system added much later (see docs/planning/PHASE-PLAN.md Phase
 * 61, FEATURE-REGISTRY.md group EE3) and extends this same table rather
 * than replacing it.
 */
export interface InvoiceTemplate {
  readonly id: UUID;
  readonly companyId: UUID | null;
  readonly name: string;
  readonly slug: string;
  readonly isBuiltIn: boolean;
  readonly layoutConfig: Record<string, unknown>;
  readonly thumbnailProviderFileId: string | null;
  readonly isActive: boolean;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  readonly deletedAt: ISODateString | null;
}

/**
 * The core invoice record.
 */
export interface Invoice extends TenantScopedEntity {
  readonly invoiceNumber: string;
  readonly status: InvoiceStatus;
  readonly clientSnapshot: InvoiceClientSnapshot;
  readonly companyProfileSnapshot: CompanyProfileSnapshot;
  readonly issueDate: ISODateString;
  readonly dueDate: ISODateString;
  readonly lineItems: readonly InvoiceLineItem[];
  readonly subtotal: Money;
  readonly taxTotal: Money;
  readonly discountTotal: Money;
  readonly total: Money;
  readonly amountPaid: Money;
  readonly amountDue: Money;
  readonly notes: string | null;
  readonly internalNotes: string | null;
  readonly templateId: UUID | null;
  readonly createdByUserId: UUID;
  readonly sentAt: ISODateString | null;
  readonly firstViewedAt: ISODateString | null;
}

/**
 * Lifecycle status of an estimate/quote.
 */
export type EstimateStatus = 'draft' | 'sent' | 'viewed' | 'approved' | 'declined' | 'expired';

/**
 * An estimate/quote, convertible into an `Invoice` once approved.
 */
export interface Estimate extends TenantScopedEntity {
  readonly estimateNumber: string;
  readonly status: EstimateStatus;
  readonly clientSnapshot: InvoiceClientSnapshot;
  readonly companyProfileSnapshot: CompanyProfileSnapshot;
  readonly issueDate: ISODateString;
  readonly expiryDate: ISODateString | null;
  readonly lineItems: readonly InvoiceLineItem[];
  readonly subtotal: Money;
  readonly taxTotal: Money;
  readonly discountTotal: Money;
  readonly total: Money;
  readonly notes: string | null;
  readonly convertedToInvoiceId: UUID | null;
  readonly createdByUserId: UUID;
}

/**
 * How often a recurring invoice template regenerates a new `Invoice`.
 */
export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * A recurring invoice template that a scheduled job uses to create new
 * `Invoice` records on a cadence.
 */
export interface RecurringInvoiceTemplate extends TenantScopedEntity {
  readonly clientId: UUID;
  readonly frequency: RecurringFrequency;
  readonly nextRunDate: ISODateString;
  readonly endDate: ISODateString | null;
  readonly lineItems: readonly InvoiceLineItem[];
  readonly isActive: boolean;
  readonly lastGeneratedInvoiceId: UUID | null;
}

/**
 * A credit note issued against a previously sent invoice (for example a
 * refund or billing correction that reduces what the client owes).
 */
export interface CreditNote extends TenantScopedEntity {
  readonly creditNoteNumber: string;
  readonly invoiceId: UUID;
  readonly reason: string;
  readonly lineItems: readonly InvoiceLineItem[];
  readonly total: Money;
  readonly issueDate: ISODateString;
}

/**
 * A debit note issued against a previously sent invoice (for example an
 * additional charge after the original invoice was issued).
 */
export interface DebitNote extends TenantScopedEntity {
  readonly debitNoteNumber: string;
  readonly invoiceId: UUID;
  readonly reason: string;
  readonly lineItems: readonly InvoiceLineItem[];
  readonly total: Money;
  readonly issueDate: ISODateString;
}

/**
 * Which kind of document a tokenized client access link points to.
 */
export type ClientAccessDocumentType = 'invoice' | 'estimate' | 'client_hub';

/**
 * A signed, expiring, no-login access token that lets a client open one
 * invoice, one estimate, or their full client hub (all documents for that
 * client) without ever creating an account. This is the full and final
 * replacement for a traditional client login portal, per the locked
 * client-access model.
 */
export interface ClientAccessToken extends TenantScopedEntity {
  readonly token: string;
  readonly documentType: ClientAccessDocumentType;
  readonly documentId: UUID | null;
  readonly clientId: UUID;
  readonly requiresEmailOtp: boolean;
  readonly expiresAt: ISODateString | null;
  readonly revokedAt: ISODateString | null;
  readonly lastViewedAt: ISODateString | null;
  readonly viewCount: number;
}

/**
 * One row in the view/access audit log for a {@link ClientAccessToken},
 * capturing IP and user agent for both anti-fraud and dispute-evidence
 * purposes.
 */
export interface ClientAccessLogEntry {
  readonly id: UUID;
  readonly tokenId: UUID;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly viewedAt: ISODateString;
}

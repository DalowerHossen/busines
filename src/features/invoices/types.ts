// src/features/invoices/types.ts
// The shapes the invoice module works with: the rows of the list, the lines of
// a document, and the full document shown on its own page.

import type { InvoiceStatus } from '@/types/enums';

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  clientId: string;
  clientName: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
  isLocked: boolean;
  isDeleted: boolean;
}

export interface InvoiceLine {
  id: string;
  lineNumber: number;
  description: string;
  longDescription: string | null;
  quantity: string;
  unitLabel: string | null;
  unitPrice: string;
  discountValue: string;
  discountAmount: string;
  taxPercentage: string;
  taxName: string | null;
  taxAmount: string;
  lineSubtotal: string;
  lineTotal: string;
  productId: string | null;
  taxRateId: string | null;
}

export interface InvoiceParty {
  name: string | null;
  attentionTo: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  countryCode: string | null;
}

export interface InvoiceDetail extends InvoiceSummary {
  clientEmail: string | null;
  billTo: InvoiceParty;
  subtotalAmount: string;
  lineDiscountAmount: string;
  documentDiscountAmount: string;
  taxAmount: string;
  shippingAmount: string;
  creditedAmount: string;
  paymentTermsDays: number | null;
  purchaseOrderReference: string | null;
  notes: string | null;
  termsAndConditions: string | null;
  footerNote: string | null;
  internalMemo: string | null;
  issuedAt: string | null;
  sentAt: string | null;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  paidAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string | null;
  lines: InvoiceLine[];
}

export interface InvoiceListFilters {
  /** Free text matched against the number and the client name. */
  search: string | null;
  /** Status to narrow by, or null for every status. */
  status: InvoiceStatus | null;
  /** Client to narrow by, or null for every client. */
  clientId: string | null;
  /** Earliest issue date to include. */
  fromDate: string | null;
  /** Latest issue date to include. */
  toDate: string | null;
  /** True to list invoices that have been deleted. */
  includeDeleted: boolean;
}

export interface InvoiceTotals {
  currency: string;
  outstandingTotal: string;
  overdueTotal: string;
  draftCount: number;
  overdueCount: number;
  totalCount: number;
}

export interface InvoiceClientOption {
  id: string;
  name: string;
  currency: string | null;
  paymentTermsDays: number | null;
  email: string | null;
}

export interface InvoiceProductOption {
  id: string;
  name: string;
  sku: string | null;
  unitPrice: string;
  taxRateId: string | null;
  description: string | null;
}

export interface InvoiceTaxOption {
  id: string;
  name: string;
  percentage: string;
}

export interface InvoiceFormData {
  clients: readonly InvoiceClientOption[];
  products: readonly InvoiceProductOption[];
  taxRates: readonly InvoiceTaxOption[];
}

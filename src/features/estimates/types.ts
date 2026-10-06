// src/features/estimates/types.ts
// The shapes the estimate module works with: the rows of the list, the lines
// of a quotation, and the full document shown on its own page.

import type { EstimateStatus } from '@/types/enums';

export interface EstimateSummary {
  id: string;
  estimateNumber: string | null;
  status: EstimateStatus;
  title: string | null;
  clientId: string;
  clientName: string;
  currency: string;
  issueDate: string;
  validUntil: string | null;
  totalAmount: string;
  convertedInvoiceId: string | null;
  isDeleted: boolean;
}

export interface EstimateLine {
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
  isOptional: boolean;
  isSelected: boolean;
}

export interface EstimateParty {
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

export interface EstimateDetail extends EstimateSummary {
  clientEmail: string | null;
  billTo: EstimateParty;
  subtotalAmount: string;
  discountAmount: string;
  taxAmount: string;
  shippingAmount: string;
  notes: string | null;
  termsAndConditions: string | null;
  footerNote: string | null;
  sentAt: string | null;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  approvedAt: string | null;
  approvedByName: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  convertedAt: string | null;
  createdAt: string | null;
  lines: EstimateLine[];
}

export interface EstimateListFilters {
  /** Free text matched against the number, the title and the client name. */
  search: string | null;
  /** Status to narrow by, or null for every status. */
  status: EstimateStatus | null;
  /** Client to narrow by, or null for every client. */
  clientId: string | null;
  /** Earliest issue date to include. */
  fromDate: string | null;
  /** Latest issue date to include. */
  toDate: string | null;
  /** True to list estimates that have been deleted. */
  includeDeleted: boolean;
}

export interface EstimateTotals {
  currency: string;
  openTotal: string;
  approvedTotal: string;
  draftCount: number;
  expiringCount: number;
  totalCount: number;
}

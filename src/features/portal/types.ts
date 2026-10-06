// src/features/portal/types.ts
// The shapes a client sees. A client never holds an account, so everything on
// the page comes from the one document their link unlocks, and nothing else
// about the business is exposed.

export interface PortalBrand {
  legalName: string;
  tradeName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  addressLines: readonly string[];
  taxRegistrationLabel: string;
  taxId: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  showPlatformBadge: boolean;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankRoutingNumber: string | null;
  bankSwiftCode: string | null;
  bankIban: string | null;
  remitToInstructions: string | null;
}

export interface PortalParty {
  name: string | null;
  attentionTo: string | null;
  email: string | null;
  addressLines: readonly string[];
  taxId: string | null;
}

export interface PortalLine {
  id: string;
  description: string;
  longDescription: string | null;
  quantity: string;
  unitLabel: string | null;
  unitPrice: string;
  discountAmount: string;
  taxPercentage: string;
  taxAmount: string;
  lineTotal: string;
}

/** One piece of proof the client is allowed to see. */
export interface PortalEvidence {
  evidenceId: string;
  kind: string;
  title: string;
  description: string | null;
  fileId: string | null;
  fileName: string | null;
  byteSize: number;
  externalUrl: string | null;
  hoursWorked: string | null;
  performedOn: string | null;
}

export interface PortalDocument {
  kind: 'invoice' | 'estimate';
  id: string;
  number: string;
  status: string;
  currency: string;
  issueDate: string;
  dueDate: string | null;
  validUntil: string | null;
  purchaseOrderReference: string | null;
  subtotalAmount: string;
  discountAmount: string;
  taxAmount: string;
  shippingAmount: string;
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
  notes: string | null;
  termsAndConditions: string | null;
  footerNote: string | null;
  billTo: PortalParty;
  brand: PortalBrand;
  lines: readonly PortalLine[];
  /** What the seller attached to show the work was done. */
  evidence: readonly PortalEvidence[];
}

export type PortalFailureReason = 'invalid' | 'expired' | 'revoked' | 'used' | 'unavailable';

export interface PortalFailure {
  isAvailable: false;
  reason: PortalFailureReason;
  message: string;
}

export interface PortalSuccess {
  isAvailable: true;
  document: PortalDocument;
}

export type PortalResult = PortalSuccess | PortalFailure;

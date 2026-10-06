// src/features/storefronts/types.ts
// The shapes the online shop screens work with: the shops wired to this
// account and the orders they have sent us to collect.

export interface StorefrontConnection {
  connectionId: string;
  platform: string;
  storeName: string;
  storeDomain: string;
  status: string;
  statusReason: string | null;
  keyMaskedHint: string | null;
  keyIssuedAt: string | null;
  notifyUrl: string | null;
  defaultCurrency: string;
  autoIssueInvoice: boolean;
  orderCount: number;
  paidCount: number;
  lastOrderAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
}

export interface StorefrontOrderRecord {
  orderId: string;
  connectionId: string;
  storeName: string;
  externalOrderId: string;
  externalOrderNumber: string | null;
  customerEmail: string | null;
  customerName: string | null;
  currency: string;
  totalAmount: string;
  status: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  balanceDue: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface StorefrontOverview {
  connectionCount: number;
  liveCount: number;
  orderCount: number;
  awaitingPayment: number;
  collectedAmount: string;
  isVerified: boolean;
}

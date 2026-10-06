// src/features/purchasing/types.ts
// The shapes the supplier screens work with.

export interface SupplierRow {
  vendorId: string;
  reference: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  countryCode: string | null;
  paymentTermsDays: number;
  totalBilled: string;
  totalPaid: string;
  status: string;
}

export interface SupplierBillRow {
  billId: string;
  billNumber: string;
  vendorName: string | null;
  vendorInvoiceNumber: string | null;
  status: string;
  billDate: string;
  dueDate: string;
  currency: string;
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
  isOverdue: boolean;
}

export interface PurchaseOrderRow {
  orderId: string;
  orderNumber: string;
  vendorName: string | null;
  status: string;
  orderDate: string;
  expectedDate: string | null;
  currency: string;
  totalAmount: string;
  receivedValue: string;
  billedValue: string;
}

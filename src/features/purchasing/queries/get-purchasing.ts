// src/features/purchasing/queries/get-purchasing.ts
// Reading who this business buys from, and what it owes them.

import type { PurchaseOrderRow, SupplierBillRow, SupplierRow } from '@/features/purchasing/types';
import { todayIso } from '@/lib/dates';
import { logger } from '@/lib/logger';
import { asRow, asRows, readAmount, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface PurchasingBoard {
  suppliers: readonly SupplierRow[];
  bills: readonly SupplierBillRow[];
  orders: readonly PurchaseOrderRow[];
  /** Everything still owed to suppliers. */
  outstandingTotal: string;
  /** What is owed and already late. */
  overdueTotal: string;
  /** True when something could not be read. */
  isDegraded: boolean;
}

/**
 * Reads the suppliers, bills and orders of one business.
 *
 * @param companyId Business being read.
 * @returns What is owed, to whom, and what is on order.
 */
export async function loadPurchasingBoard(companyId: string): Promise<PurchasingBoard> {
  const supabase = createServerSupabaseClient();

  const [suppliers, bills, orders] = await Promise.all([
    supabase
      .from('vendors')
      .select(
        'id, vendor_reference, display_name, email, phone, country_code, payment_terms_days, total_billed, total_paid, status'
      )
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('display_name', { ascending: true }),
    supabase
      .from('supplier_bills')
      .select(
        'id, bill_number, vendor_invoice_number, status, bill_date, due_date, currency, total_amount, paid_amount, balance_due, vendors(display_name)'
      )
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('due_date', { ascending: true })
      .limit(100),
    supabase
      .from('purchase_orders')
      .select(
        'id, order_number, status, order_date, expected_date, currency, total_amount, received_value, billed_value, vendors(display_name)'
      )
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('order_date', { ascending: false })
      .limit(50),
  ]);

  if (suppliers.error || bills.error) {
    logger.error('The supplier book could not be read', suppliers.error ?? bills.error, {
      companyId,
    });

    return {
      suppliers: [],
      bills: [],
      orders: [],
      outstandingTotal: '0',
      overdueTotal: '0',
      isDegraded: true,
    };
  }

  const today = todayIso();

  const billRows = asRows(bills.data).map((row) => {
    const vendor = asRow(row['vendors']);
    const dueDate = readString(row, 'due_date') ?? '';
    const balance = readAmount(row, 'balance_due');

    return {
      billId: readString(row, 'id') ?? '',
      billNumber: readString(row, 'bill_number') ?? '',
      vendorName: vendor === null ? null : readString(vendor, 'display_name'),
      vendorInvoiceNumber: readString(row, 'vendor_invoice_number'),
      status: readString(row, 'status') ?? 'sent',
      billDate: readString(row, 'bill_date') ?? '',
      dueDate,
      currency: readString(row, 'currency') ?? 'USD',
      totalAmount: readAmount(row, 'total_amount'),
      paidAmount: readAmount(row, 'paid_amount'),
      balanceDue: balance,
      isOverdue: Number.parseFloat(balance) > 0 && dueDate !== '' && dueDate < today,
    };
  });

  const outstanding = billRows.reduce(
    (running, bill) => running + Number.parseFloat(bill.balanceDue),
    0
  );
  const overdue = billRows
    .filter((bill) => bill.isOverdue)
    .reduce((running, bill) => running + Number.parseFloat(bill.balanceDue), 0);

  return {
    suppliers: asRows(suppliers.data).map((row) => ({
      vendorId: readString(row, 'id') ?? '',
      reference: readString(row, 'vendor_reference') ?? '',
      displayName: readString(row, 'display_name') ?? '',
      email: readString(row, 'email'),
      phone: readString(row, 'phone'),
      countryCode: readString(row, 'country_code'),
      paymentTermsDays: readNumber(row, 'payment_terms_days') ?? 30,
      totalBilled: readAmount(row, 'total_billed'),
      totalPaid: readAmount(row, 'total_paid'),
      status: readString(row, 'status') ?? 'active',
    })),
    bills: billRows,
    orders: asRows(orders.data).map((row) => {
      const vendor = asRow(row['vendors']);

      return {
        orderId: readString(row, 'id') ?? '',
        orderNumber: readString(row, 'order_number') ?? '',
        vendorName: vendor === null ? null : readString(vendor, 'display_name'),
        status: readString(row, 'status') ?? 'draft',
        orderDate: readString(row, 'order_date') ?? '',
        expectedDate: readString(row, 'expected_date'),
        currency: readString(row, 'currency') ?? 'USD',
        totalAmount: readAmount(row, 'total_amount'),
        receivedValue: readAmount(row, 'received_value'),
        billedValue: readAmount(row, 'billed_value'),
      };
    }),
    outstandingTotal: outstanding.toFixed(2),
    overdueTotal: overdue.toFixed(2),
    isDegraded: false,
  };
}

// src/features/invoices/actions/line-rows.ts
// Turning the lines submitted by the builder into the rows the database
// expects. Amounts are left to the database triggers, which are the single
// place line and document totals are worked out.

import 'server-only';

import type { InvoiceLineValues } from '@/features/invoices/validation/invoice';
import type { Json } from '@/types/json';

export interface InvoiceItemRow extends Record<string, Json> {
  company_id: string;
  invoice_id: string;
  line_number: number;
  line_type: string;
  product_id: string | null;
  description: string;
  quantity: string;
  unit_label: string | null;
  unit_price: string;
  discount_type: string | null;
  discount_value: string;
  tax_rate_id: string | null;
  tax_percentage: string;
  is_taxable: boolean;
  created_by: string;
  updated_by: string;
}

/**
 * Builds the rows for the lines of one invoice.
 *
 * @param lines Lines submitted by the builder, in display order.
 * @param companyId Company the invoice belongs to.
 * @param invoiceId Invoice the lines belong to.
 * @param userId Account saving the invoice.
 * @returns The rows to insert.
 */
export function toInvoiceItemRows(
  lines: readonly InvoiceLineValues[],
  companyId: string,
  invoiceId: string,
  userId: string
): InvoiceItemRow[] {
  return lines.map((line, index) => ({
    company_id: companyId,
    invoice_id: invoiceId,
    line_number: index + 1,
    line_type: line.productId === null ? 'service' : 'item',
    product_id: line.productId,
    description: line.description,
    quantity: line.quantity,
    unit_label: line.unitLabel,
    unit_price: line.unitPrice,
    discount_type: Number.parseFloat(line.discountValue) > 0 ? 'fixed_amount' : null,
    discount_value: line.discountValue,
    tax_rate_id: line.taxRateId,
    tax_percentage: line.taxPercentage,
    is_taxable: Number.parseFloat(line.taxPercentage) > 0,
    created_by: userId,
    updated_by: userId,
  }));
}

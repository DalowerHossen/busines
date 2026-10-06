// src/features/invoices/queries/get-invoice.ts
// Reading one invoice with its lines, in the order they are printed.

import { toInvoiceDetail } from '@/features/invoices/mappers';
import type { InvoiceDetail } from '@/features/invoices/types';
import { logger } from '@/lib/logger';
import { asRow, asRows } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const DETAIL_COLUMNS =
  'id, invoice_number, status, client_id, client_name_snapshot, bill_to, currency, issue_date, due_date, payment_terms_days, subtotal_amount, line_discount_amount, document_discount_amount, tax_amount, shipping_amount, total_amount, paid_amount, credited_amount, balance_due, purchase_order_reference, notes, terms_and_conditions, footer_note, internal_memo, issued_at, sent_at, first_viewed_at, last_viewed_at, view_count, paid_at, cancelled_at, cancellation_reason, is_locked, created_at, deleted_at, clients(display_name, email)';

const LINE_COLUMNS =
  'id, line_number, description, long_description, quantity, unit_label, unit_price, discount_value, discount_amount, tax_percentage, tax_name_snapshot, tax_amount, line_subtotal, line_total, product_id, tax_rate_id';

/**
 * Reads one invoice of a company with its lines.
 *
 * @param companyId Company the invoice must belong to.
 * @param invoiceId Invoice being opened.
 * @returns The invoice, or null when it does not exist.
 */
export async function getInvoice(
  companyId: string,
  invoiceId: string
): Promise<InvoiceDetail | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('invoices')
    .select(DETAIL_COLUMNS)
    .eq('company_id', companyId)
    .eq('id', invoiceId)
    .maybeSingle();

  if (error) {
    logger.error('Could not read an invoice', error, { companyId, invoiceId });
    return null;
  }

  const row = asRow(data);

  if (row === null) {
    return null;
  }

  const lines = await supabase
    .from('invoice_items')
    .select(LINE_COLUMNS)
    .eq('company_id', companyId)
    .eq('invoice_id', invoiceId)
    .is('deleted_at', null)
    .order('line_number', { ascending: true });

  if (lines.error) {
    logger.error('Could not read the invoice lines', lines.error, { companyId, invoiceId });
  }

  return toInvoiceDetail(row, asRows(lines.data));
}

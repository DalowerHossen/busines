// src/features/payments/queries/get-payment.ts
// Reading one payment with the invoices it has been applied to.

import { toPaymentDetail } from '@/features/payments/mappers';
import type { PaymentDetail } from '@/features/payments/types';
import { logger } from '@/lib/logger';
import { asRow, asRows } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const DETAIL_COLUMNS =
  'id, payment_number, status, method_type, provider, client_id, amount, currency, allocated_amount, unallocated_amount, refunded_amount, gateway_fee_amount, net_amount, received_at, value_date, provider_payment_reference, bank_reference, cheque_number, payer_name, payer_email, notes, reconciled_at, is_manual, created_at, deleted_at, clients(display_name)';

/**
 * Reads one payment of a company with its allocations.
 *
 * @param companyId Company the payment must belong to.
 * @param paymentId Payment being opened.
 * @returns The payment, or null when it does not exist.
 */
export async function getPayment(
  companyId: string,
  paymentId: string
): Promise<PaymentDetail | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('payments')
    .select(DETAIL_COLUMNS)
    .eq('company_id', companyId)
    .eq('id', paymentId)
    .maybeSingle();

  if (error) {
    logger.error('Could not read a payment', error, { companyId, paymentId });
    return null;
  }

  const row = asRow(data);

  if (row === null) {
    return null;
  }

  const allocations = await supabase
    .from('payment_allocations')
    .select(
      'id, invoice_id, amount, allocated_at, reversed_at, reversal_reason, invoices(invoice_number)'
    )
    .eq('company_id', companyId)
    .eq('payment_id', paymentId)
    .order('allocated_at', { ascending: false });

  if (allocations.error) {
    logger.error('Could not read the payment allocations', allocations.error, {
      companyId,
      paymentId,
    });
  }

  return toPaymentDetail(row, asRows(allocations.data));
}

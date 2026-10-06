// src/lib/storefronts/settle-from-intent.ts
// Closing the loop back to the shop once the money has actually arrived.
//
// A shopper who closes the tab on the way back from the payment page is the
// normal case, not the exception, so the shop is told by us rather than by
// the browser. The order is only marked paid when the invoice behind it has
// nothing left owing.

import 'server-only';

import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { notifyStore } from '@/lib/storefronts/notify-store';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

/**
 * Settles the shop order behind one payment attempt, if there is one.
 *
 * @param intentId Payment attempt that has just succeeded.
 * @returns True when a shop order was settled.
 */
export async function settleStorefrontOrderForIntent(intentId: string): Promise<boolean> {
  const supabase = getServiceSupabaseClient();

  const { data: intentData } = await supabase
    .from('payment_intents')
    .select('invoice_id')
    .eq('id', intentId)
    .maybeSingle();

  const intent = asRow(intentData);
  const invoiceId = intent === null ? null : readString(intent, 'invoice_id');

  if (invoiceId === null) {
    return false;
  }

  const { data: orderData } = await supabase
    .from('storefront_orders')
    .select('id, connection_id, external_order_id, currency, total_amount')
    .eq('invoice_id', invoiceId)
    .maybeSingle();

  const order = asRow(orderData);

  if (order === null) {
    return false;
  }

  const orderId = readString(order, 'id') ?? '';

  const { data: settled, error } = await supabase.rpc('settle_storefront_order', {
    p_order_id: orderId,
  });

  if (error) {
    logger.error('A shop order could not be settled', error, { orderId });

    return false;
  }

  if (settled !== true) {
    return false;
  }

  await notifyStore({
    connectionId: readString(order, 'connection_id') ?? '',
    externalOrderId: readString(order, 'external_order_id') ?? '',
    status: 'paid',
    amount: readString(order, 'total_amount') ?? '0',
    currency: readString(order, 'currency') ?? 'USD',
  });

  return true;
}

// src/lib/settlements/reverse.ts
// Taking money back out of a seller wallet when a payment goes away again.
//
// A refund that has been paid back, or a chargeback that has been lost, has
// to be reflected in the balance the platform owes the seller. If it is not,
// the platform pays out money it no longer holds, which is the one mistake a
// business like this cannot afford to make twice.

import 'server-only';

import { logger } from '@/lib/logger';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

/**
 * Reverses the settlement behind one payment, if there is one.
 *
 * @param paymentId Payment that has gone away again.
 * @param reason Why it is being reversed, written to the ledger.
 * @param returnPlatformFee True when the platform gives its fee back as well.
 * @returns True when a settlement was reversed.
 */
export async function reverseSettlementForPayment(
  paymentId: string,
  reason: string,
  returnPlatformFee = false
): Promise<boolean> {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase.rpc('reverse_settlement', {
    p_payment_id: paymentId,
    p_reason: reason,
    p_return_platform_fee: returnPlatformFee,
  });

  if (error) {
    // A payment that was never settled has nothing to reverse, which is a
    // normal outcome for a manual payment rather than a failure.
    logger.warn('A settlement could not be reversed', {
      paymentId,
      message: error.message,
    });

    return false;
  }

  return data === true;
}

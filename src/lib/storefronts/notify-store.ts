// src/lib/storefronts/notify-store.ts
// Telling a shop that one of its orders has been paid.
//
// The shop is the system of record for fulfilment, so it has to hear about a
// payment even if the shopper closed the tab on the way back. The call is
// signed with the same secret the shop signs its own notifications with, and
// a failure is written against the connection rather than thrown away.

import 'server-only';

import { decryptSecret } from '@/lib/crypto/encryption';
import { logger } from '@/lib/logger';
import { signStorefrontBody } from '@/lib/storefronts/signatures';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { asRow, readString } from '@/lib/records';

export interface StoreNotification {
  connectionId: string;
  externalOrderId: string;
  status: 'paid' | 'cancelled' | 'refunded';
  amount: string;
  currency: string;
}

/** How long we wait for a shop to answer before giving up. */
const TIMEOUT_MILLISECONDS = 8000;

/**
 * Tells a shop what happened to one of its orders.
 *
 * @param notification What the shop is being told.
 * @returns True when the shop acknowledged the call.
 */
export async function notifyStore(notification: StoreNotification): Promise<boolean> {
  const supabase = getServiceSupabaseClient();

  const { data } = await supabase
    .from('storefront_connections')
    .select('notify_url, webhook_secret_encrypted')
    .eq('id', notification.connectionId)
    .maybeSingle();

  const row = asRow(data);

  if (row === null) {
    return false;
  }

  const notifyUrl = readString(row, 'notify_url');
  const secretEnvelope = readString(row, 'webhook_secret_encrypted');

  if (notifyUrl === null || secretEnvelope === null) {
    return false;
  }

  const body = JSON.stringify({
    order_id: notification.externalOrderId,
    status: notification.status,
    amount: notification.amount,
    currency: notification.currency,
    sent_at: new Date().toISOString(),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MILLISECONDS);

  try {
    const response = await fetch(notifyUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-storefront-signature': signStorefrontBody(body, decryptSecret(secretEnvelope)),
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      await supabase.rpc('record_storefront_error', {
        p_connection_id: notification.connectionId,
        p_message: `The shop answered ${String(response.status)} when told about an order.`,
      });

      return false;
    }

    return true;
  } catch (cause) {
    logger.error('A shop could not be told about a payment', cause, {
      connectionId: notification.connectionId,
    });

    await supabase.rpc('record_storefront_error', {
      p_connection_id: notification.connectionId,
      p_message: 'The shop could not be reached when told about an order.',
    });

    return false;
  } finally {
    clearTimeout(timer);
  }
}

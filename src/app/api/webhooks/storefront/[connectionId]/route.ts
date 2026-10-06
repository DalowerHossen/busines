// src/app/api/webhooks/storefront/[connectionId]/route.ts
// Where a shop platform tells us an order changed.
//
// The body is read as raw bytes so the signature can be checked against
// exactly what arrived. Only two things are acted on: an order the shop
// cancelled, which stops us chasing payment for it, and an order the shop
// says was paid elsewhere, which is reconciled against the invoice rather
// than taken on trust.

import type { NextRequest, NextResponse } from 'next/server';

import { decryptSecret } from '@/lib/crypto/encryption';
import {
  errorResponse,
  HTTP_STATUS,
  jsonResponse,
  rateLimitedResponse,
} from '@/lib/http/responses';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { readStorefrontSignature, storefrontSignatureMatches } from '@/lib/storefronts/signatures';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { isJsonObject } from '@/types/json';

export const dynamic = 'force-dynamic';

export interface StorefrontWebhookContext {
  /** The connection the notification is addressed to. */
  params: { connectionId: string };
}

/**
 * Reads the order reference out of whatever the platform sent.
 *
 * @param body Parsed notification body.
 * @returns The reference, or null when there is none.
 */
function readOrderReference(body: unknown): string | null {
  if (!isJsonObject(body)) {
    return null;
  }

  for (const key of ['order_id', 'id', 'number', 'order_number']) {
    const value = body[key];

    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }

    if (typeof value === 'number') {
      return String(value);
    }
  }

  return null;
}

/**
 * Reads what the platform says happened.
 *
 * @param body Parsed notification body.
 * @returns The state, lower cased, or null.
 */
function readState(body: unknown): string | null {
  if (!isJsonObject(body)) {
    return null;
  }

  const value = body['status'] ?? body['financial_status'] ?? body['state'];

  return typeof value === 'string' ? value.trim().toLowerCase() : null;
}

/**
 * Receives one notification from a shop platform.
 *
 * @param request Incoming request.
 * @param context The connection taken from the address.
 * @returns What was done with the notification.
 */
export async function POST(
  request: NextRequest,
  context: StorefrontWebhookContext
): Promise<NextResponse> {
  const decision = await consumeRateLimit({
    kind: 'storefront_webhook',
    key: context.params.connectionId,
    limit: 240,
    windowSeconds: 60,
  });

  if (!decision.isAllowed) {
    return rateLimitedResponse(decision.retryAfterSeconds, decision.limit);
  }

  const supabase = getServiceSupabaseClient();

  const { data } = await supabase
    .from('storefront_connections')
    .select('id, company_id, platform, status, webhook_secret_encrypted')
    .eq('id', context.params.connectionId)
    .is('deleted_at', null)
    .maybeSingle();

  const connection = asRow(data);

  if (connection === null) {
    return errorResponse('No shop of ours is connected here.', HTTP_STATUS.notFound, 'not_found');
  }

  const secretEnvelope = readString(connection, 'webhook_secret_encrypted');

  if (secretEnvelope === null) {
    return errorResponse(
      'This shop has no signing secret yet.',
      HTTP_STATUS.forbidden,
      'forbidden'
    );
  }

  const rawBody = await request.text();
  const platform = readString(connection, 'platform') ?? 'custom';
  const signature = readStorefrontSignature(request.headers, platform);

  if (!storefrontSignatureMatches(rawBody, decryptSecret(secretEnvelope), signature)) {
    await supabase.rpc('record_storefront_error', {
      p_connection_id: context.params.connectionId,
      p_message: 'A notification arrived without a signature we recognise.',
    });

    return errorResponse(
      'That notification was not signed by this shop.',
      HTTP_STATUS.unauthorised,
      'unauthenticated'
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return errorResponse(
      'Send the notification as JSON.',
      HTTP_STATUS.badRequest,
      'validation_failed'
    );
  }

  const reference = readOrderReference(parsed);

  if (reference === null) {
    return errorResponse(
      'The notification named no order.',
      HTTP_STATUS.unprocessable,
      'validation_failed'
    );
  }

  const { data: orderData } = await supabase
    .from('storefront_orders')
    .select('id, status')
    .eq('connection_id', context.params.connectionId)
    .eq('external_order_id', reference)
    .maybeSingle();

  const order = asRow(orderData);

  if (order === null) {
    return jsonResponse({ received: true, action: 'ignored' });
  }

  const orderId = readString(order, 'id') ?? '';
  const state = readState(parsed);

  if (state === 'cancelled' || state === 'canceled' || state === 'voided') {
    const { error } = await supabase.rpc('cancel_storefront_order', {
      p_order_id: orderId,
      p_reason: 'The shop cancelled this order.',
    });

    if (error) {
      logger.warn('A cancelled shop order could not be stopped', { orderId });

      return jsonResponse({ received: true, action: 'ignored' });
    }

    return jsonResponse({ received: true, action: 'cancelled' });
  }

  if (state === 'paid' || state === 'completed' || state === 'processing') {
    const { data: settled } = await supabase.rpc('settle_storefront_order', {
      p_order_id: orderId,
    });

    return jsonResponse({
      received: true,
      action: settled === true ? 'settled' : 'awaiting_payment',
    });
  }

  return jsonResponse({ received: true, action: 'noted' });
}

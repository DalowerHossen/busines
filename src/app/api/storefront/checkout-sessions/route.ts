// src/app/api/storefront/checkout-sessions/route.ts
// Where an online shop asks for a payment address for one of its orders.
//
// The shop sends the order and we send back a hosted address. The shopper
// enters their card on the page the payment provider serves, not on ours, so
// no card number ever reaches this application. That single decision is what
// keeps every business using the platform inside the lightest scope of the
// card industry rules.

import type { NextRequest, NextResponse } from 'next/server';

import { checkoutSessionSchema } from '@/features/storefronts/validation/storefronts';
import { absoluteUrl } from '@/env/client';
import { randomSecret, sha256Hex } from '@/lib/crypto/hashing';
import {
  createdResponse,
  errorResponse,
  HTTP_STATUS,
  rateLimitedResponse,
} from '@/lib/http/responses';
import { logger } from '@/lib/logger';
import { asRow, readNumber, readString } from '@/lib/records';
import { authenticateStoreRequest } from '@/lib/storefronts/authenticate-store-request';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { toFieldErrors } from '@/lib/validation/primitives';

export const dynamic = 'force-dynamic';

/** How long a shop checkout address stays usable. */
const LINK_TTL_DAYS = 14;

const MILLISECONDS_IN_A_DAY = 24 * 60 * 60 * 1000;

/**
 * Creates a hosted payment address for one shop order.
 *
 * @param request Incoming request from the shop.
 * @returns The payment address, or an explanation in the usual shape.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const outcome = await authenticateStoreRequest(request);

  if (outcome.kind === 'rate_limited') {
    return rateLimitedResponse(outcome.retryAfterSeconds, 120);
  }

  if (outcome.kind === 'refused') {
    return errorResponse(outcome.message, HTTP_STATUS.unauthorised, 'unauthenticated');
  }

  if (outcome.kind === 'not_live') {
    return errorResponse(outcome.message, HTTP_STATUS.forbidden, 'forbidden');
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return errorResponse('Send the order as JSON.', HTTP_STATUS.badRequest, 'validation_failed');
  }

  const parsed = checkoutSessionSchema.safeParse(payload);

  if (!parsed.success) {
    return errorResponse(
      'That order could not be read.',
      HTTP_STATUS.unprocessable,
      'validation_failed',
      toFieldErrors(parsed.error)
    );
  }

  const order = parsed.data;
  const supabase = getServiceSupabaseClient();

  const { data: orderId, error: orderError } = await supabase.rpc('register_storefront_order', {
    p_connection_id: outcome.caller.connectionId,
    p_external_order_id: order.orderId,
    p_total_amount: order.amount,
    p_currency: order.currency ?? outcome.caller.defaultCurrency,
    p_customer_email: order.customerEmail ?? null,
    p_customer_name: order.customerName ?? null,
    p_external_order_number: order.orderNumber ?? null,
    p_description: order.description ?? null,
    p_payload: {},
  });

  if (orderError || typeof orderId !== 'string') {
    logger.error('A shop order could not be registered', orderError, {
      connectionId: outcome.caller.connectionId,
    });

    return errorResponse(
      orderError?.message ?? 'That order could not be accepted.',
      HTTP_STATUS.unprocessable,
      'integration_failure'
    );
  }

  const { data: stored } = await supabase
    .from('storefront_orders')
    .select('invoice_id, document_link_id, status, customer_email, currency, total_amount')
    .eq('id', orderId)
    .maybeSingle();

  const row = asRow(stored);
  const invoiceId = row === null ? null : readString(row, 'invoice_id');

  if (row === null || invoiceId === null) {
    return errorResponse(
      'That order has no invoice behind it yet.',
      HTTP_STATUS.conflict,
      'conflict'
    );
  }

  const existingLinkId = readString(row, 'document_link_id');

  if (existingLinkId !== null) {
    return createdResponse({
      order_id: orderId,
      status: readString(row, 'status') ?? 'awaiting_payment',
      message: 'This order already has a payment address. Reuse the one you were given.',
    });
  }

  const token = randomSecret(32);
  const expiresAt = new Date(Date.now() + LINK_TTL_DAYS * MILLISECONDS_IN_A_DAY).toISOString();

  const { data: link, error: linkError } = await supabase
    .from('document_links')
    .insert({
      company_id: outcome.caller.companyId,
      document_kind: 'invoice',
      document_id: invoiceId,
      token_hash: sha256Hex(token),
      short_code: randomSecret(9),
      recipient_email: readString(row, 'customer_email'),
      requires_email_otp: false,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  const linkRow = asRow(link);

  if (linkError || linkRow === null) {
    logger.error('A shop payment address could not be created', linkError, {
      connectionId: outcome.caller.connectionId,
    });

    return errorResponse(
      'The payment address could not be created.',
      HTTP_STATUS.serverError,
      'database_failure'
    );
  }

  await supabase.rpc('attach_storefront_checkout', {
    p_order_id: orderId,
    p_link_id: readString(linkRow, 'id'),
    p_expires_at: expiresAt,
  });

  return createdResponse({
    order_id: orderId,
    checkout_url: absoluteUrl(`/pay/${token}`),
    expires_at: expiresAt,
    currency: readString(row, 'currency') ?? outcome.caller.defaultCurrency,
    amount: readNumber(row, 'total_amount') ?? order.amount,
    hosted_by_provider: true,
  });
}

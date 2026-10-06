// src/app/api/storefront/orders/[orderId]/route.ts
// Where a shop asks what became of an order it sent us.
//
// A shop that lost the shopper on the way back needs a way to ask rather
// than guess, so this answers with the state of the order and what is still
// owed on the invoice behind it.

import type { NextRequest, NextResponse } from 'next/server';

import {
  errorResponse,
  HTTP_STATUS,
  jsonResponse,
  rateLimitedResponse,
} from '@/lib/http/responses';
import { asRow, readString } from '@/lib/records';
import { authenticateStoreRequest } from '@/lib/storefronts/authenticate-store-request';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export interface StorefrontOrderRouteContext {
  /** The address of the order being asked about. */
  params: { orderId: string };
}

/**
 * Reports the state of one shop order.
 *
 * @param request Incoming request from the shop.
 * @param context The order reference taken from the address.
 * @returns The state of the order, or an explanation in the usual shape.
 */
export async function GET(
  request: NextRequest,
  context: StorefrontOrderRouteContext
): Promise<NextResponse> {
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

  const supabase = getServiceSupabaseClient();

  const { data } = await supabase
    .from('storefront_orders')
    .select('id, external_order_id, status, currency, total_amount, paid_at, invoice_id')
    .eq('connection_id', outcome.caller.connectionId)
    .eq('external_order_id', context.params.orderId)
    .maybeSingle();

  const row = asRow(data);

  if (row === null) {
    return errorResponse(
      'No order of ours carries that reference.',
      HTTP_STATUS.notFound,
      'not_found'
    );
  }

  const invoiceId = readString(row, 'invoice_id');
  let balanceDue: string | null = null;

  if (invoiceId !== null) {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('balance_due')
      .eq('id', invoiceId)
      .maybeSingle();

    const invoiceRow = asRow(invoice);
    balanceDue = invoiceRow === null ? null : readString(invoiceRow, 'balance_due');
  }

  return jsonResponse({
    order_id: readString(row, 'external_order_id') ?? context.params.orderId,
    status: readString(row, 'status') ?? 'received',
    currency: readString(row, 'currency') ?? outcome.caller.defaultCurrency,
    amount: readString(row, 'total_amount') ?? '0',
    balance_due: balanceDue,
    paid_at: readString(row, 'paid_at'),
  });
}

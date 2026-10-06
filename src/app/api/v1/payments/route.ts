// src/app/api/v1/payments/route.ts
// Reading payments through the public interface.
//
// Paged with a cursor for the same reason the invoice list is: an
// integration that polls must never miss a payment because an older row
// moved while it was reading.

import type { NextRequest, NextResponse } from 'next/server';

import {
  authenticateDeveloperRequest,
  grantAllows,
  rateLimitHeaders,
} from '@/lib/api/developer-auth';
import { errorResponse, HTTP_STATUS, jsonResponse } from '@/lib/http/responses';
import { logger } from '@/lib/logger';
import { asRows, readAmount, readString } from '@/lib/records';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

/** Most payments one page may carry. */
const MAX_PAGE_SIZE = 100;

/**
 * Lists payments for the account behind the token.
 *
 * @param request Incoming request.
 * @returns A page of payments, or an explanation in the usual shape.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const outcome = await authenticateDeveloperRequest(request);

  if (outcome.kind === 'rate_limited') {
    return errorResponse(
      `Too many requests. Try again in ${outcome.retryAfterSeconds} seconds.`,
      HTTP_STATUS.tooManyRequests,
      'rate_limited'
    );
  }

  if (outcome.kind === 'unauthenticated') {
    return errorResponse(outcome.message, HTTP_STATUS.unauthorised, 'unauthenticated');
  }

  if (!grantAllows(outcome.grant, 'payments:read')) {
    return errorResponse(
      'This application was not given permission to read payments.',
      HTTP_STATUS.forbidden,
      'forbidden'
    );
  }

  const url = new URL(request.url);
  const requestedSize = Number.parseInt(url.searchParams.get('limit') ?? '25', 10);
  const pageSize = Number.isFinite(requestedSize)
    ? Math.min(Math.max(requestedSize, 1), MAX_PAGE_SIZE)
    : 25;
  const cursor = url.searchParams.get('cursor');
  const status = url.searchParams.get('status');

  const supabase = getServiceSupabaseClient();

  let query = supabase
    .from('payments')
    .select(
      'id, amount, currency, status, method_type, provider, received_at, client_id, gateway_fee_amount, platform_fee_amount, created_at'
    )
    .eq('company_id', outcome.grant.companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1);

  if (status !== null && status.length > 0) {
    query = query.eq('status', status);
  }

  if (cursor !== null && cursor.length > 0) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('The payment list could not be read for an application', error, {
      companyId: outcome.grant.companyId,
    });

    return errorResponse(
      'The payments could not be read. Please try again.',
      HTTP_STATUS.serverError,
      'database_failure'
    );
  }

  const rows = asRows(data);
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const lastRow = page[page.length - 1];

  const response = jsonResponse({
    data: page.map((row) => ({
      id: readString(row, 'id') ?? '',
      amount: readAmount(row, 'amount'),
      currency: readString(row, 'currency') ?? 'USD',
      status: readString(row, 'status') ?? 'succeeded',
      method: readString(row, 'method_type'),
      provider: readString(row, 'provider'),
      received_at: readString(row, 'received_at'),
      client_id: readString(row, 'client_id'),
      gateway_fee_amount: readAmount(row, 'gateway_fee_amount'),
      platform_fee_amount: readAmount(row, 'platform_fee_amount'),
      created_at: readString(row, 'created_at'),
    })),
    page: {
      has_more: hasMore,
      next_cursor: hasMore && lastRow !== undefined ? readString(lastRow, 'created_at') : null,
    },
  });

  for (const [name, value] of Object.entries(rateLimitHeaders(outcome.grant))) {
    response.headers.set(name, value);
  }

  return response;
}

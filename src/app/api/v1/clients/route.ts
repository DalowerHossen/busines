// src/app/api/v1/clients/route.ts
// Reading the client list through the public interface, paged with a cursor
// so a long list can be walked without ever repeating or skipping a row.

import type { NextRequest, NextResponse } from 'next/server';

import {
  authenticateDeveloperRequest,
  grantAllows,
  rateLimitHeaders,
} from '@/lib/api/developer-auth';
import { errorResponse, HTTP_STATUS, jsonResponse } from '@/lib/http/responses';
import { logger } from '@/lib/logger';
import { asRows, readString } from '@/lib/records';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

/** Most clients one page may carry. */
const MAX_PAGE_SIZE = 100;

/**
 * Lists clients for the account behind the token.
 *
 * @param request Incoming request.
 * @returns A page of clients, or an explanation in the usual shape.
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

  if (!grantAllows(outcome.grant, 'clients:read')) {
    return errorResponse(
      'This application was not given permission to read clients.',
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

  const supabase = getServiceSupabaseClient();
  let query = supabase
    .from('clients')
    .select('id, display_name, email, phone, billing_currency, country_code, status, created_at')
    .eq('company_id', outcome.grant.companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(pageSize + 1);

  if (cursor !== null && cursor.length > 0) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('The client list could not be read for an application', error, {
      companyId: outcome.grant.companyId,
    });

    return errorResponse(
      'The clients could not be read. Please try again.',
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
      display_name: readString(row, 'display_name') ?? '',
      email: readString(row, 'email'),
      phone: readString(row, 'phone'),
      billing_currency: readString(row, 'billing_currency') ?? 'USD',
      country_code: readString(row, 'country_code'),
      status: readString(row, 'status') ?? 'active',
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

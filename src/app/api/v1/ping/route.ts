// src/app/api/v1/ping/route.ts
// The call an integration makes first: it proves the token works and says
// which account the application is looking at.

import type { NextRequest, NextResponse } from 'next/server';

import { authenticateDeveloperRequest, rateLimitHeaders } from '@/lib/api/developer-auth';
import { errorResponse, HTTP_STATUS, jsonResponse } from '@/lib/http/responses';
import { asRow, readString } from '@/lib/records';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

/**
 * Answers with the account behind the token.
 *
 * @param request Incoming request.
 * @returns The account summary, or an explanation in the usual shape.
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

  const supabase = getServiceSupabaseClient();
  const { data } = await supabase
    .from('companies')
    .select('display_name, base_currency')
    .eq('id', outcome.grant.companyId)
    .is('deleted_at', null)
    .maybeSingle();

  const company = asRow(data);

  const response = jsonResponse({
    account: {
      company_id: outcome.grant.companyId,
      display_name: company === null ? null : readString(company, 'display_name'),
      base_currency: company === null ? 'USD' : (readString(company, 'base_currency') ?? 'USD'),
    },
    scopes: [...outcome.grant.scopes],
  });

  for (const [name, value] of Object.entries(rateLimitHeaders(outcome.grant))) {
    response.headers.set(name, value);
  }

  return response;
}

// src/app/api/cron/release-funds/route.ts
// The scheduler calls this once an hour to let held money out.
//
// The hold window is the promise the platform makes to itself: time for a
// payer to dispute a charge before the seller can take the money away. When
// that window has passed, the balance becomes withdrawable without anybody
// having to ask.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { serverEnv } from '@/env/server';
import { signaturesMatch } from '@/lib/crypto/hashing';
import { errorResponse, HTTP_STATUS } from '@/lib/http/responses';
import { logger } from '@/lib/logger';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

/**
 * Releases every settlement whose hold window has passed.
 *
 * @param request Incoming request, carrying the shared secret.
 * @returns How many settlements were released.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const provided =
    request.headers.get('x-cron-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    '';

  if (!signaturesMatch(provided, serverEnv.CRON_SECRET)) {
    return errorResponse(
      'This endpoint is for the scheduler only.',
      HTTP_STATUS.unauthorised,
      'unauthenticated'
    );
  }

  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase.rpc('release_matured_settlements');

  if (error) {
    logger.error('Held funds could not be released', error);

    return errorResponse(
      'The release run did not finish.',
      HTTP_STATUS.serverError,
      'database_failure'
    );
  }

  const released = typeof data === 'number' ? data : 0;

  return NextResponse.json(
    { success: true, data: { released } },
    { status: HTTP_STATUS.ok, headers: { 'cache-control': 'no-store' } }
  );
}

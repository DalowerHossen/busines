// src/app/api/cron/read-receipts/route.ts
// The scheduler calls this a few times an hour to read the receipts people
// have photographed. Nothing without the shared secret gets in.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { serverEnv } from '@/env/server';
import { signaturesMatch } from '@/lib/crypto/hashing';
import { errorResponse, HTTP_STATUS } from '@/lib/http/responses';
import { readWaitingReceipts } from '@/lib/ocr/read-receipts';

export const dynamic = 'force-dynamic';

/** How many receipts one run attempts. */
const BATCH_SIZE = 10;

/**
 * Reads the receipts that are waiting.
 *
 * @param request Incoming request, carrying the shared secret.
 * @returns What the run managed to do.
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

  const summary = await readWaitingReceipts(BATCH_SIZE);

  return NextResponse.json(
    { success: true, data: summary },
    { status: HTTP_STATUS.ok, headers: { 'cache-control': 'no-store' } }
  );
}

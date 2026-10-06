// src/app/api/cron/dispatch-messages/route.ts
// The worker that empties the outbox. A scheduler calls it every minute with
// the shared secret; nothing else can reach it.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { serverEnv } from '@/env/server';
import { dispatchDueMessages } from '@/lib/email/dispatch';
import { advanceDueRoutes } from '@/lib/messaging/advance';
import { errorResponse, HTTP_STATUS } from '@/lib/http/responses';
import { signaturesMatch } from '@/lib/crypto/hashing';

export const dynamic = 'force-dynamic';

/** How many messages one run attempts. */
const BATCH_SIZE = 25;

/**
 * Sends the messages that are due.
 *
 * @param request Incoming request, carrying the shared secret.
 * @returns What happened to the batch.
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

  const summary = await dispatchDueMessages(BATCH_SIZE);
  const advanced = await advanceDueRoutes(BATCH_SIZE);

  return NextResponse.json(
    { success: true, data: { ...summary, routesAdvanced: advanced } },
    { status: HTTP_STATUS.ok, headers: { 'cache-control': 'no-store' } }
  );
}

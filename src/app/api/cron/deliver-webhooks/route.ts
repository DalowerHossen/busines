// src/app/api/cron/deliver-webhooks/route.ts
// Sending the events a business asked to be told about.
//
// Each delivery is claimed by exactly one worker, attempted once with a
// short timeout, and recorded. A failure backs off and is tried again; after
// the attempts are used up it lands in the dead letter list where somebody
// can replay it. Nothing is lost quietly.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { serverEnv } from '@/lib/env/env.server';
import { decryptSecret } from '@/lib/crypto/encryption';
import { signaturesMatch } from '@/lib/crypto/hashing';
import { errorResponse, HTTP_STATUS } from '@/lib/http/responses';
import { logger } from '@/lib/logger';
import { asRow, asRows, readNumber, readString } from '@/lib/records';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { signWebhookBody } from '@/lib/webhooks/signature';

export const dynamic = 'force-dynamic';

/** How many deliveries one run attempts. */
const BATCH_SIZE = 20;

/** How long a receiver is given to answer. */
const TIMEOUT_MILLISECONDS = 10000;

/**
 * Attempts the deliveries that are due.
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

  const supabase = getServiceSupabaseClient();
  const workerId = `worker-${String(Date.now())}`;

  // Deliveries reserved by a worker that never came back are freed first,
  // otherwise they sit reserved forever and the receiving business never
  // learns what happened.
  const { error: releaseError } = await supabase.rpc('release_stalled_deliveries', {
    p_stalled_minutes: 10,
  });

  if (releaseError) {
    logger.warn('Stalled deliveries could not be freed', { message: releaseError.message });
  }

  const { data, error } = await supabase.rpc('claim_webhook_deliveries', {
    p_worker_id: workerId,
    p_limit: BATCH_SIZE,
  });

  if (error) {
    logger.error('Webhook deliveries could not be claimed', error);

    return errorResponse(
      'The delivery run did not start.',
      HTTP_STATUS.serverError,
      'database_failure'
    );
  }

  const deliveries = asRows(data);
  let delivered = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    const deliveryId = readString(delivery, 'id') ?? '';
    const endpointId = readString(delivery, 'endpoint_id') ?? '';
    const eventId = readString(delivery, 'event_id') ?? '';

    const [endpointResult, eventResult] = await Promise.all([
      supabase
        .from('webhook_endpoints')
        .select('target_url, signing_secret_encrypted, timeout_seconds, api_version')
        .eq('id', endpointId)
        .maybeSingle(),
      supabase
        .from('outbound_events')
        .select('event_type, resource_type, resource_id, payload, created_at')
        .eq('id', eventId)
        .maybeSingle(),
    ]);

    const endpoint = asRow(endpointResult.data);
    const event = asRow(eventResult.data);

    if (endpoint === null || event === null) {
      await supabase.rpc('record_webhook_attempt', {
        p_delivery_id: deliveryId,
        p_status_code: 0,
        p_duration_ms: 0,
        p_error: 'The endpoint or the event behind this delivery no longer exists.',
        p_response_excerpt: null,
      });

      failed += 1;

      continue;
    }

    const body = JSON.stringify({
      id: eventId,
      type: readString(event, 'event_type'),
      api_version: readString(endpoint, 'api_version'),
      created_at: readString(event, 'created_at'),
      data: event['payload'] ?? {},
    });

    let secret = '';

    try {
      secret = decryptSecret(readString(endpoint, 'signing_secret_encrypted') ?? '');
    } catch (cause) {
      logger.error('A webhook signing secret could not be read', cause, { endpointId });
    }

    const signed = signWebhookBody(body, secret);
    const startedAt = Date.now();
    let statusCode = 0;
    let failureMessage: string | null = null;
    let excerpt: string | null = null;

    try {
      const response = await fetch(readString(endpoint, 'target_url') ?? '', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'KD SOLUTION IT webhooks',
          'x-kd-signature': signed.signature,
          'x-kd-event-id': eventId,
          'x-kd-delivery-id': deliveryId,
        },
        body,
        signal: AbortSignal.timeout(
          Math.min((readNumber(endpoint, 'timeout_seconds') ?? 10) * 1000, TIMEOUT_MILLISECONDS)
        ),
      });

      statusCode = response.status;
      excerpt = (await response.text()).slice(0, 300);

      if (!response.ok) {
        failureMessage = `The endpoint answered with ${String(response.status)}.`;
      }
    } catch {
      failureMessage = 'The endpoint could not be reached.';
    }

    if (failureMessage === null) {
      delivered += 1;
    } else {
      failed += 1;
    }

    const { error: recordError } = await supabase.rpc('record_webhook_attempt', {
      p_delivery_id: deliveryId,
      p_status_code: statusCode,
      p_duration_ms: Date.now() - startedAt,
      p_error: failureMessage,
      p_response_excerpt: excerpt,
    });

    if (recordError) {
      logger.error('A webhook attempt could not be recorded', recordError, { deliveryId });
    }
  }

  return NextResponse.json(
    { success: true, data: { claimed: deliveries.length, delivered, failed } },
    { status: HTTP_STATUS.ok, headers: { 'cache-control': 'no-store' } }
  );
}

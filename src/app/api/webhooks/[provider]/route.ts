// src/app/api/webhooks/[provider]/route.ts
// Where payment providers tell us what happened.
//
// The body is read as raw bytes so the signature can be checked against
// exactly what arrived, every delivery is written down before it is acted on,
// and a provider that sends the same event twice changes nothing the second
// time.

import type { NextRequest, NextResponse } from 'next/server';

import { decryptSecret } from '@/lib/crypto/encryption';
import { sha256Hex } from '@/lib/crypto/hashing';
import {
  errorResponse,
  HTTP_STATUS,
  jsonResponse,
  rateLimitedResponse,
} from '@/lib/http/responses';
import { logger } from '@/lib/logger';
import { interpretWebhookEvent } from '@/lib/payments/webhooks/interpret-event';
import { verifyWebhookSignature } from '@/lib/payments/webhooks/verify';
import { asRows, readString } from '@/lib/records';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { settleStorefrontOrderForIntent } from '@/lib/storefronts/settle-from-intent';
import { contextFromRequest } from '@/lib/security/request-context';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { GATEWAY_PROVIDERS, type GatewayProvider } from '@/types/enums';
import { isJsonObject, type JsonObject } from '@/types/json';

export const dynamic = 'force-dynamic';

/** Signature headers, in the order they are looked for. */
const SIGNATURE_HEADERS = [
  'stripe-signature',
  'paypal-transmission-sig',
  'x-signature',
  'x-webhook-signature',
  'verif-hash',
  'x-nium-signature',
];

export interface WebhookContext {
  /** Route parameters of the request. */
  params: { provider: string };
}

/**
 * Finds the signature the caller sent, whatever they chose to call it.
 *
 * @param request Incoming request.
 * @returns The signature, or null when none was sent.
 */
function readSignature(request: NextRequest): string | null {
  for (const name of SIGNATURE_HEADERS) {
    const value = request.headers.get(name);

    if (value) {
      return value;
    }
  }

  return null;
}

/**
 * Reads the event name out of a payload, whichever field the provider uses.
 *
 * @param payload Payload the provider sent.
 * @returns The event name.
 */
function readEventType(payload: JsonObject): string {
  for (const key of ['type', 'event_type', 'event', 'eventType', 'template']) {
    const value = payload[key];

    if (typeof value === 'string' && value.length > 0) {
      return value.slice(0, 120);
    }
  }

  return 'unknown';
}

/**
 * Reads the provider identifier of the delivery, so a replay is harmless.
 *
 * @param payload Payload the provider sent.
 * @param fallback Hash of the body, used when the provider sends no id.
 * @returns The identifier to store the event under.
 */
function readEventId(payload: JsonObject, fallback: string): string {
  for (const key of ['id', 'event_id', 'transmission_id', 'eventId']) {
    const value = payload[key];

    if (typeof value === 'string' && value.length > 0) {
      return value.slice(0, 200);
    }
  }

  return fallback;
}

/**
 * Receives one webhook from a payment provider.
 *
 * @param request Incoming request.
 * @param context Route parameters of the request.
 * @returns An acknowledgement, or an explanation in the usual shape.
 */
export async function POST(request: NextRequest, context: WebhookContext): Promise<NextResponse> {
  const started = Date.now();
  const candidate = context.params.provider;

  if (!GATEWAY_PROVIDERS.includes(candidate as GatewayProvider)) {
    return errorResponse('That provider is not known here.', HTTP_STATUS.notFound, 'not_found');
  }

  const provider = candidate as GatewayProvider;
  const requestContext = contextFromRequest(request);

  const decision = await consumeRateLimit({
    kind: 'payment_webhook',
    key: `${provider}:${requestContext.ipAddress ?? 'unknown'}`,
    limit: 600,
    windowSeconds: 60,
  });

  if (!decision.isAllowed) {
    return rateLimitedResponse(decision.retryAfterSeconds, decision.limit, decision.remaining);
  }

  const rawBody = await request.text();

  if (rawBody.length === 0 || rawBody.length > 1_000_000) {
    return errorResponse('The body of the call could not be read.', HTTP_STATUS.unprocessable);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return errorResponse('The body of the call is not valid JSON.', HTTP_STATUS.unprocessable);
  }

  if (!isJsonObject(parsed)) {
    return errorResponse('The body of the call is not an object.', HTTP_STATUS.unprocessable);
  }

  const payload: JsonObject = parsed;
  const payloadHash = sha256Hex(rawBody);
  const supabase = getServiceSupabaseClient();

  // Any live connection for this provider can carry the signing secret, so
  // each one is tried until the signature matches.
  const { data: gatewayData } = await supabase
    .from('payment_gateways')
    .select('id, company_id, webhook_secret_encrypted')
    .eq('provider', provider)
    .eq('is_enabled', true)
    .is('deleted_at', null)
    .not('webhook_secret_encrypted', 'is', null)
    .limit(50);

  const signature = readSignature(request);
  let companyId: string | null = null;
  let isVerified = false;
  let failureReason = 'No connection with a signing secret matched this call.';

  for (const row of asRows(gatewayData)) {
    const envelope = readString(row, 'webhook_secret_encrypted');

    if (!envelope) {
      continue;
    }

    let secret: string | null = null;

    try {
      secret = decryptSecret(envelope);
    } catch (caught) {
      logger.error('A stored webhook secret could not be read', caught, {
        gatewayId: readString(row, 'id'),
      });

      continue;
    }

    const check = verifyWebhookSignature(provider, rawBody, signature, secret);

    if (check.isVerified) {
      isVerified = true;
      companyId = readString(row, 'company_id');
      failureReason = '';
      break;
    }

    failureReason = check.reason ?? failureReason;
  }

  const { data: registered, error: registerError } = await supabase.rpc('register_webhook_event', {
    p_provider: provider,
    p_provider_event_id: readEventId(payload, payloadHash),
    p_event_type: readEventType(payload),
    p_payload: payload,
    p_payload_sha256: payloadHash,
    p_signature_verified: isVerified,
    p_company_id: companyId,
  });

  const event = asRows(registered)[0];

  if (registerError || !event) {
    logger.error('A webhook could not be written down', registerError, { provider });

    return errorResponse(
      'The call could not be stored. Please deliver it again.',
      HTTP_STATUS.serverError,
      'database_failure'
    );
  }

  const eventId = readString(event, 'event_id') ?? '';

  if (event['is_new'] !== true) {
    return jsonResponse({ success: true, data: { status: 'already_received' } });
  }

  if (!isVerified) {
    await supabase.rpc('complete_webhook_event', {
      p_event_id: eventId,
      p_succeeded: false,
      p_error: failureReason,
      p_duration_ms: Date.now() - started,
    });

    return errorResponse('The signature on this call is not valid.', HTTP_STATUS.unauthorised);
  }

  const outcome = interpretWebhookEvent(provider, readEventType(payload), payload);

  try {
    if (outcome.kind === 'settled') {
      const { error } = await supabase.rpc('settle_payment_intent', {
        p_intent_id: outcome.intentId,
        p_provider_reference: outcome.providerReference,
        p_amount: null,
        p_fee: outcome.feeAmount === null ? 0 : Number.parseFloat(outcome.feeAmount),
      });

      if (error) {
        throw error;
      }

      await settleStorefrontOrderForIntent(outcome.intentId);
    }

    if (outcome.kind === 'failed') {
      const { error } = await supabase.rpc('fail_payment_intent', {
        p_intent_id: outcome.intentId,
        p_failure_code: outcome.failureCode,
        p_failure_message: outcome.failureMessage,
      });

      if (error) {
        throw error;
      }
    }
  } catch (caught) {
    logger.error('A webhook could not be acted on', caught, { provider, eventId });

    await supabase.rpc('complete_webhook_event', {
      p_event_id: eventId,
      p_succeeded: false,
      p_error: 'The event could not be applied to the payment it refers to.',
      p_duration_ms: Date.now() - started,
    });

    return errorResponse(
      'The call was stored but could not be applied. It will be retried.',
      HTTP_STATUS.serverError,
      'database_failure'
    );
  }

  await supabase.rpc('complete_webhook_event', {
    p_event_id: eventId,
    p_succeeded: true,
    p_error: null,
    p_duration_ms: Date.now() - started,
  });

  return jsonResponse({ success: true, data: { status: outcome.kind } });
}

// src/lib/payments/webhooks/interpret-event.ts
// Reading a provider webhook as one of the few things the platform cares
// about: a payment finished, a payment failed, or something we can ignore.
//
// Providers disagree about field names, so each one is read here and the rest
// of the application only ever sees the small shape below.

import 'server-only';

import type { GatewayProvider } from '@/types/enums';
import type { JsonObject } from '@/types/json';
import { isJsonObject } from '@/types/json';

export type WebhookOutcome =
  | {
      kind: 'settled';
      intentId: string;
      providerReference: string | null;
      feeAmount: string | null;
    }
  | { kind: 'failed'; intentId: string; failureCode: string | null; failureMessage: string | null }
  | { kind: 'ignored'; reason: string };

/**
 * Reads a nested value out of a webhook payload.
 *
 * @param payload Payload the provider sent.
 * @param path Keys to walk, outermost first.
 * @returns The value found, or null.
 */
function readPath(payload: JsonObject, path: readonly string[]): unknown {
  let current: unknown = payload;

  for (const key of path) {
    if (!isJsonObject(current)) {
      return null;
    }

    current = current[key];
  }

  return current ?? null;
}

/**
 * Reads a string out of a webhook payload.
 *
 * @param payload Payload the provider sent.
 * @param path Keys to walk, outermost first.
 * @returns The text found, or null.
 */
function readText(payload: JsonObject, path: readonly string[]): string | null {
  const value = readPath(payload, path);

  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Reads the payment reference Nium carries in its list of tags.
 *
 * @param payload Payload the provider sent.
 * @returns The reference found, or null.
 */
function readTaggedReference(payload: JsonObject): string | null {
  const tags = payload['tags'];

  if (!Array.isArray(tags)) {
    return null;
  }

  for (const tag of tags) {
    if (!isJsonObject(tag)) {
      continue;
    }

    const key = typeof tag['key'] === 'string' ? tag['key'].toLowerCase() : '';
    const value = tag['value'];

    if (key.includes('reference') && typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return null;
}

/**
 * Works out what one webhook means.
 *
 * @param provider Provider the webhook came from.
 * @param eventType Event name the provider used.
 * @param payload Payload the provider sent.
 * @returns What the platform should do about it.
 */
export function interpretWebhookEvent(
  provider: GatewayProvider,
  eventType: string,
  payload: JsonObject
): WebhookOutcome {
  if (provider === 'stripe') {
    const object = readPath(payload, ['data', 'object']);
    const data = isJsonObject(object) ? object : {};

    const intentId =
      (typeof data['client_reference_id'] === 'string' ? data['client_reference_id'] : null) ??
      readText(data, ['metadata', 'payment_intent_id']);

    if (intentId === null) {
      return { kind: 'ignored', reason: 'The event does not belong to a payment we started.' };
    }

    if (eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded') {
      return {
        kind: 'settled',
        intentId,
        providerReference: typeof data['id'] === 'string' ? data['id'] : null,
        feeAmount: null,
      };
    }

    if (
      eventType === 'payment_intent.payment_failed' ||
      eventType === 'checkout.session.async_payment_failed'
    ) {
      return {
        kind: 'failed',
        intentId,
        failureCode: readText(data, ['last_payment_error', 'code']) ?? 'payment_failed',
        failureMessage:
          readText(data, ['last_payment_error', 'message']) ?? 'The payment did not go through.',
      };
    }

    return { kind: 'ignored', reason: `Stripe event ${eventType} needs no action.` };
  }

  if (provider === 'paypal') {
    const resource = readPath(payload, ['resource']);
    const data = isJsonObject(resource) ? resource : {};
    const intentId =
      (typeof data['custom_id'] === 'string' ? data['custom_id'] : null) ??
      readText(data, ['purchase_units', '0', 'custom_id']);

    if (intentId === null) {
      return { kind: 'ignored', reason: 'The event does not belong to a payment we started.' };
    }

    if (eventType === 'CHECKOUT.ORDER.APPROVED' || eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      return {
        kind: 'settled',
        intentId,
        providerReference: typeof data['id'] === 'string' ? data['id'] : null,
        feeAmount: readText(data, ['seller_receivable_breakdown', 'paypal_fee', 'value']),
      };
    }

    if (eventType === 'PAYMENT.CAPTURE.DENIED') {
      return {
        kind: 'failed',
        intentId,
        failureCode: 'capture_denied',
        failureMessage: 'PayPal declined the payment.',
      };
    }

    return { kind: 'ignored', reason: `PayPal event ${eventType} needs no action.` };
  }

  if (provider === 'adyen') {
    const items = readPath(payload, ['notificationItems']);
    const first = Array.isArray(items) ? items[0] : null;
    const wrapper = isJsonObject(first) ? first['NotificationRequestItem'] : null;
    const item = isJsonObject(wrapper) ? wrapper : payload;

    const intentId = readText(item, ['merchantReference']);

    if (intentId === null) {
      return { kind: 'ignored', reason: 'The event does not belong to a payment we started.' };
    }

    const eventCode = readText(item, ['eventCode']) ?? eventType;
    const successValue = item['success'];
    const wasSuccessful = successValue === true || successValue === 'true';
    const pspReference = readText(item, ['pspReference']);

    if (eventCode === 'AUTHORISATION' || eventCode === 'CAPTURE') {
      if (wasSuccessful) {
        return {
          kind: 'settled',
          intentId,
          providerReference: pspReference,
          feeAmount: null,
        };
      }

      return {
        kind: 'failed',
        intentId,
        failureCode: 'authorisation_refused',
        failureMessage: readText(item, ['reason']) ?? 'Adyen declined the payment.',
      };
    }

    if (eventCode === 'CANCELLATION' || eventCode === 'CAPTURE_FAILED') {
      return {
        kind: 'failed',
        intentId,
        failureCode: eventCode.toLowerCase(),
        failureMessage: readText(item, ['reason']) ?? 'The payment did not go through.',
      };
    }

    return { kind: 'ignored', reason: `Adyen event ${eventCode} needs no action.` };
  }

  if (provider === 'nium') {
    const intentId =
      readText(payload, ['merchantReference']) ??
      readText(payload, ['externalId']) ??
      readTaggedReference(payload);

    if (intentId === null) {
      return { kind: 'ignored', reason: 'The event does not belong to a payment we started.' };
    }

    const template = (readText(payload, ['template']) ?? eventType).toUpperCase();
    const reference = readText(payload, ['systemReferenceNumber']);

    if (template.includes('PAID') || template.includes('COMPLETED')) {
      return {
        kind: 'settled',
        intentId,
        providerReference: reference,
        feeAmount: readText(payload, ['feeAmount']),
      };
    }

    if (template.includes('FAILED') || template.includes('RETURNED')) {
      return {
        kind: 'failed',
        intentId,
        failureCode: template.toLowerCase(),
        failureMessage: readText(payload, ['failureReason']) ?? 'Nium could not settle the money.',
      };
    }

    return { kind: 'ignored', reason: `Nium event ${template} needs no action.` };
  }

  // Everything else, including any gateway added by configuration, is read
  // with the plain field names documented for custom providers.
  const intentId = readText(payload, ['reference']) ?? readText(payload, ['intent_id']);

  if (intentId === null) {
    return { kind: 'ignored', reason: 'The event carries no reference to a payment we started.' };
  }

  const status = (readText(payload, ['status']) ?? '').toLowerCase();

  if (['paid', 'succeeded', 'completed', 'success'].includes(status)) {
    return {
      kind: 'settled',
      intentId,
      providerReference: readText(payload, ['transaction_id']) ?? readText(payload, ['id']),
      feeAmount: readText(payload, ['fee']),
    };
  }

  if (['failed', 'declined', 'cancelled', 'canceled'].includes(status)) {
    return {
      kind: 'failed',
      intentId,
      failureCode: status,
      failureMessage: readText(payload, ['message']) ?? 'The payment did not go through.',
    };
  }

  return { kind: 'ignored', reason: `Status ${status || 'unknown'} needs no action.` };
}

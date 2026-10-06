// src/lib/payments/adapters/stripe.ts
// Stripe, reached over its REST interface so no provider library has to be
// kept in step with the platform.

import 'server-only';

import type {
  CheckoutRequest,
  CheckoutStart,
  ConnectionTestResult,
  GatewayAdapter,
  GatewayContext,
} from '@/lib/payments/adapters/types';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

const BALANCE_ENDPOINT = 'https://api.stripe.com/v1/balance';
const SESSION_ENDPOINT = 'https://api.stripe.com/v1/checkout/sessions';

export const stripeAdapter: GatewayAdapter = {
  key: 'stripe',

  /**
   * Reads the account balance, which proves the key works and nothing else.
   *
   * @param context Credentials of the connection.
   * @returns Whether Stripe accepted the key.
   */
  async testConnection(context: GatewayContext): Promise<ConnectionTestResult> {
    const secretKey = context.credentials['secret_key'];

    if (!secretKey) {
      return { isHealthy: false, message: 'No secret key has been saved yet.' };
    }

    const expectedPrefix = context.mode === 'live' ? 'sk_live' : 'sk_test';

    if (!secretKey.startsWith(expectedPrefix)) {
      return {
        isHealthy: false,
        message: `This key does not look like a ${context.mode} key. A ${context.mode} key starts with ${expectedPrefix}.`,
      };
    }

    try {
      const response = await fetch(BALANCE_ENDPOINT, {
        headers: { authorization: `Bearer ${secretKey}` },
      });

      if (response.ok) {
        return {
          isHealthy: true,
          message: 'Stripe accepted the key and the account is reachable.',
        };
      }

      if (response.status === 401) {
        return {
          isHealthy: false,
          message: 'Stripe rejected the key. Check that it was copied in full.',
        };
      }

      return {
        isHealthy: false,
        message: `Stripe answered with status ${response.status}. Try again in a moment.`,
      };
    } catch (caught) {
      logger.error('Stripe could not be reached', caught, { mode: context.mode });

      return { isHealthy: false, message: 'Stripe could not be reached from this server.' };
    }
  },

  /**
   * Opens a hosted checkout session for one invoice.
   *
   * @param context Credentials of the connection.
   * @param request What is being paid and where the client should return.
   * @returns The address the client is sent to.
   */
  async startCheckout(context: GatewayContext, request: CheckoutRequest): Promise<CheckoutStart> {
    const secretKey = context.credentials['secret_key'];

    if (!secretKey) {
      throw new AppError('unexpected', 'This payment method is not ready yet.');
    }

    const form = new URLSearchParams({
      mode: 'payment',
      success_url: `${request.returnUrl}?status=paid`,
      cancel_url: `${request.returnUrl}?status=cancelled`,
      client_reference_id: request.intentId,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': request.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(request.amountMinor),
      'line_items[0][price_data][product_data][name]': request.description,
      'metadata[payment_intent_id]': request.intentId,
    });

    if (request.payerEmail) {
      form.set('customer_email', request.payerEmail);
    }

    const response = await fetch(SESSION_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secretKey}`,
        'content-type': 'application/x-www-form-urlencoded',
        'idempotency-key': request.intentId,
      },
      body: form.toString(),
    });

    const payload: unknown = await response.json();
    const session = isRecord(payload) ? payload : {};
    const url = typeof session['url'] === 'string' ? session['url'] : null;
    const id = typeof session['id'] === 'string' ? session['id'] : null;

    if (!response.ok || url === null) {
      logger.error('Stripe refused to open a checkout session', null, {
        status: response.status,
        intentId: request.intentId,
      });

      throw new AppError('unexpected', 'This payment could not be started. Please try again.');
    }

    return { checkoutUrl: url, providerReference: id, instructions: null };
  },
};

/**
 * Narrows an unknown payload to an object.
 *
 * @param value Value parsed from a provider reply.
 * @returns True when the value can be read by key.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

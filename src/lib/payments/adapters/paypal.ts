// src/lib/payments/adapters/paypal.ts
// PayPal, reached through its OAuth token endpoint, which is the cheapest
// call that proves a client ID and secret belong together.

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

const LIVE_HOST = 'https://api-m.paypal.com';
const SANDBOX_HOST = 'https://api-m.sandbox.paypal.com';

export const paypalAdapter: GatewayAdapter = {
  key: 'paypal',

  /**
   * Asks PayPal for an access token.
   *
   * @param context Credentials of the connection.
   * @returns Whether PayPal issued a token.
   */
  async testConnection(context: GatewayContext): Promise<ConnectionTestResult> {
    const clientId = context.credentials['client_id'];
    const clientSecret = context.credentials['client_secret'];

    if (!clientId || !clientSecret) {
      return { isHealthy: false, message: 'Both the client ID and the secret are needed.' };
    }

    const host = context.mode === 'live' ? LIVE_HOST : SANDBOX_HOST;
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
      const response = await fetch(`${host}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          authorization: `Basic ${basic}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (response.ok) {
        return { isHealthy: true, message: 'PayPal issued a token, so the credentials are valid.' };
      }

      return {
        isHealthy: false,
        message:
          response.status === 401
            ? 'PayPal rejected these credentials. Check you are using the right environment.'
            : `PayPal answered with status ${response.status}.`,
      };
    } catch (caught) {
      logger.error('PayPal could not be reached', caught, { mode: context.mode });

      return { isHealthy: false, message: 'PayPal could not be reached from this server.' };
    }
  },

  /**
   * Creates an order and returns the address the client approves it at.
   *
   * @param context Credentials of the connection.
   * @param request What is being paid and where the client should return.
   * @returns The address the client is sent to.
   */
  async startCheckout(context: GatewayContext, request: CheckoutRequest): Promise<CheckoutStart> {
    const host = context.mode === 'live' ? LIVE_HOST : SANDBOX_HOST;
    const token = await accessToken(context, host);

    const response = await fetch(`${host}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'paypal-request-id': request.intentId,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            custom_id: request.intentId,
            description: request.description.slice(0, 127),
            amount: { currency_code: request.currency, value: request.amount },
          },
        ],
        application_context: {
          return_url: `${request.returnUrl}?status=paid`,
          cancel_url: `${request.returnUrl}?status=cancelled`,
          user_action: 'PAY_NOW',
        },
      }),
    });

    const payload: unknown = await response.json();
    const order = isRecord(payload) ? payload : {};
    const links = Array.isArray(order['links']) ? order['links'] : [];

    const approval = links
      .filter(isRecord)
      .find((link) => link['rel'] === 'payer-action' || link['rel'] === 'approve');

    const url = approval && typeof approval['href'] === 'string' ? approval['href'] : null;

    if (!response.ok || url === null) {
      logger.error('PayPal refused to create an order', null, {
        status: response.status,
        intentId: request.intentId,
      });

      throw new AppError('unexpected', 'This payment could not be started. Please try again.');
    }

    return {
      checkoutUrl: url,
      providerReference: typeof order['id'] === 'string' ? order['id'] : null,
      instructions: null,
    };
  },
};

/**
 * Asks PayPal for an access token to use on one call.
 *
 * @param context Credentials of the connection.
 * @param host Environment the call is made against.
 * @returns The access token.
 */
async function accessToken(context: GatewayContext, host: string): Promise<string> {
  const clientId = context.credentials['client_id'];
  const clientSecret = context.credentials['client_secret'];

  if (!clientId || !clientSecret) {
    throw new AppError('unexpected', 'This payment method is not ready yet.');
  }

  const response = await fetch(`${host}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const payload: unknown = await response.json();
  const token = isRecord(payload) ? payload['access_token'] : null;

  if (!response.ok || typeof token !== 'string') {
    throw new AppError('unexpected', 'PayPal would not let us start this payment.');
  }

  return token;
}

/**
 * Narrows an unknown payload to an object.
 *
 * @param value Value parsed from a provider reply.
 * @returns True when the value can be read by key.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// src/lib/payments/adapters/adyen.ts
// Adyen, reached over its Checkout interface.
//
// A payment is taken with a pay by link, which is the hosted page Adyen
// offers, so no card data ever touches this server. When the connection
// names a balance account the payment is split at the moment it is taken:
// the platform keeps its commission and the rest lands in the balance that
// belongs to the business.

import 'server-only';

import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type {
  CheckoutRequest,
  CheckoutStart,
  ConnectionTestResult,
  GatewayAdapter,
  GatewayContext,
} from '@/lib/payments/adapters/types';

const TEST_BASE_URL = 'https://checkout-test.adyen.com';
const CHECKOUT_VERSION = 'v71';

/**
 * Works out which Adyen endpoint this connection talks to.
 *
 * Live traffic goes to the prefix Adyen issues with the live credential, and
 * test traffic goes to the shared test host.
 *
 * @param context Credentials and mode of the connection.
 * @returns The base address, without a trailing slash.
 */
function baseUrlFor(context: GatewayContext): string {
  if (context.mode !== 'live') {
    return TEST_BASE_URL;
  }

  const prefix = context.credentials['live_url_prefix']?.trim() ?? '';

  if (prefix.length === 0) {
    throw new AppError(
      'validation_failed',
      'Add the live endpoint prefix from Adyen before taking live payments.'
    );
  }

  return `https://${prefix}-checkout-live.adyenpayments.com/checkout`;
}

/**
 * Turns a percentage of an amount into the smallest currency unit.
 *
 * @param amountMinor Total amount in minor units.
 * @param percentage Share the platform keeps.
 * @returns The commission in minor units, never more than the total.
 */
function commissionMinor(amountMinor: number, percentage: number): number {
  const raw = Math.round((amountMinor * percentage) / 100);

  return Math.min(Math.max(raw, 0), amountMinor);
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

export const adyenAdapter: GatewayAdapter = {
  key: 'adyen',

  /**
   * Asks Adyen which payment methods the merchant account may offer, which
   * proves the key and the account name belong together and moves no money.
   *
   * @param context Credentials of the connection.
   * @returns Whether Adyen accepted the credentials.
   */
  async testConnection(context: GatewayContext): Promise<ConnectionTestResult> {
    const apiKey = context.credentials['api_key'];
    const merchantAccount = context.credentials['merchant_account'];

    if (!apiKey) {
      return { isHealthy: false, message: 'No API key has been saved yet.' };
    }

    if (!merchantAccount) {
      return { isHealthy: false, message: 'Add the merchant account name from Adyen.' };
    }

    let endpoint: string;

    try {
      endpoint = `${baseUrlFor(context)}/${CHECKOUT_VERSION}/paymentMethods`;
    } catch (caught) {
      const message =
        caught instanceof AppError ? caught.message : 'This Adyen connection is not complete yet.';

      return { isHealthy: false, message };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({ merchantAccount }),
      });

      if (response.ok) {
        return {
          isHealthy: true,
          message: 'Adyen accepted the key and the merchant account is reachable.',
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          isHealthy: false,
          message: 'Adyen rejected the key. Check that it was copied in full.',
        };
      }

      if (response.status === 422) {
        return {
          isHealthy: false,
          message: 'Adyen does not recognise that merchant account name.',
        };
      }

      return {
        isHealthy: false,
        message: `Adyen answered with status ${response.status}. Try again in a moment.`,
      };
    } catch (caught) {
      logger.error('Adyen could not be reached', caught, { mode: context.mode });

      return { isHealthy: false, message: 'Adyen could not be reached from this server.' };
    }
  },

  /**
   * Creates a pay by link for one document.
   *
   * @param context Credentials of the connection.
   * @param request What is being paid and where the client should return.
   * @returns The hosted address the client is sent to.
   */
  async startCheckout(context: GatewayContext, request: CheckoutRequest): Promise<CheckoutStart> {
    const apiKey = context.credentials['api_key'];
    const merchantAccount = context.credentials['merchant_account'];

    if (!apiKey || !merchantAccount) {
      throw new AppError('unexpected', 'This payment method is not ready yet.');
    }

    const balanceAccountId = context.credentials['balance_account_id']?.trim() ?? '';
    const feePercentage = Number(context.credentials['platform_fee_percentage'] ?? '0');
    const body: Record<string, unknown> = {
      amount: { currency: request.currency.toUpperCase(), value: request.amountMinor },
      merchantAccount,
      reference: request.intentId,
      description: request.description,
      returnUrl: `${request.returnUrl}?status=paid`,
      metadata: { payment_intent_id: request.intentId },
    };

    if (request.payerEmail) {
      body['shopperEmail'] = request.payerEmail;
    }

    if (balanceAccountId.length > 0) {
      const commission = commissionMinor(
        request.amountMinor,
        Number.isFinite(feePercentage) ? feePercentage : 0
      );

      body['splits'] = [
        {
          amount: { value: request.amountMinor - commission },
          type: 'BalanceAccount',
          account: balanceAccountId,
          reference: request.intentId,
        },
        {
          amount: { value: commission },
          type: 'Commission',
          reference: `${request.intentId}-fee`,
        },
      ];
    }

    const response = await fetch(`${baseUrlFor(context)}/${CHECKOUT_VERSION}/paymentLinks`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        'idempotency-key': request.intentId,
      },
      body: JSON.stringify(body),
    });

    const payload: unknown = await response.json();
    const link = isRecord(payload) ? payload : {};
    const url = typeof link['url'] === 'string' ? link['url'] : null;
    const id = typeof link['id'] === 'string' ? link['id'] : null;

    if (!response.ok || url === null) {
      logger.error('Adyen refused to create a payment link', null, {
        status: response.status,
        intentId: request.intentId,
      });

      throw new AppError('unexpected', 'This payment could not be started. Please try again.');
    }

    return { checkoutUrl: url, providerReference: id, instructions: null };
  },
};

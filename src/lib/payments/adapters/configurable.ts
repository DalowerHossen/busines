// src/lib/payments/adapters/configurable.ts
// The adapter that lets a provider be connected without writing code.
//
// The connection carries its own description: which address to call, which
// method to use, how the credentials are presented and which reply counts as
// healthy. Everything the platform does not have a dedicated adapter for goes
// through here.

import 'server-only';

import { logger } from '@/lib/logger';
import type {
  CheckoutRequest,
  CheckoutStart,
  ConnectionTestResult,
  GatewayAdapter,
  GatewayContext,
} from '@/lib/payments/adapters/types';
import { AppError } from '@/lib/errors';
import type { JsonObject } from '@/types/json';

/**
 * Reads one string out of the adapter configuration.
 *
 * @param config Configuration stored with the connection.
 * @param key Name of the setting.
 * @returns The value, or null when it is absent.
 */
function readSetting(config: JsonObject, key: string): string | null {
  const value = config[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Replaces {{credential}} placeholders with the decrypted values.
 *
 * @param template Text holding placeholders.
 * @param credentials Decrypted credentials of the connection.
 * @returns The text with the values filled in.
 */
function fill(template: string, credentials: Readonly<Record<string, string>>): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, name: string) => {
    return credentials[name] ?? '';
  });
}

export const configurableAdapter: GatewayAdapter = {
  key: 'configurable',

  /**
   * Calls the address the connection describes and reports what came back.
   *
   * @param context Credentials and configuration of the connection.
   * @returns Whether the provider answered as the configuration expects.
   */
  async testConnection(context: GatewayContext): Promise<ConnectionTestResult> {
    const endpoint =
      readSetting(context.adapterConfig, context.mode === 'live' ? 'live_test_url' : 'test_url') ??
      readSetting(context.adapterConfig, 'test_url');

    if (!endpoint) {
      const missing = Object.entries(context.credentials).filter(([, value]) => value.length === 0);

      if (missing.length > 0) {
        return { isHealthy: false, message: 'Some of the credentials are still empty.' };
      }

      return {
        isHealthy: true,
        message:
          'The credentials are stored safely. Add a check address to this connection and we will also call the provider.',
      };
    }

    const method = readSetting(context.adapterConfig, 'test_method') ?? 'GET';
    const authHeader = readSetting(context.adapterConfig, 'auth_header') ?? 'authorization';
    const authTemplate =
      readSetting(context.adapterConfig, 'auth_template') ?? 'Bearer {{api_key}}';
    const body = readSetting(context.adapterConfig, 'test_body');

    try {
      const response = await fetch(fill(endpoint, context.credentials), {
        method,
        headers: {
          [authHeader]: fill(authTemplate, context.credentials),
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? fill(body, context.credentials) : undefined,
      });

      if (response.ok) {
        return { isHealthy: true, message: 'The provider answered successfully.' };
      }

      return {
        isHealthy: false,
        message: `The provider answered with status ${response.status}.`,
      };
    } catch (caught) {
      logger.error('A configured gateway could not be reached', caught, {
        provider: context.provider,
      });

      return { isHealthy: false, message: 'The provider could not be reached from this server.' };
    }
  },

  /**
   * Starts a payment at the address the connection describes.
   *
   * The reply is read with the field names given in the configuration, so a
   * provider nobody has written code for still works.
   *
   * @param context Credentials and configuration of the connection.
   * @param request What is being paid and where the client should return.
   * @returns The address the client is sent to, or instructions instead.
   */
  async startCheckout(context: GatewayContext, request: CheckoutRequest): Promise<CheckoutStart> {
    const endpoint = readSetting(context.adapterConfig, 'checkout_url');

    if (!endpoint) {
      return {
        checkoutUrl: null,
        providerReference: null,
        instructions: `Pay ${request.amount} ${request.currency} the way this supplier agreed with you, quoting ${request.description}.`,
      };
    }

    const authHeader = readSetting(context.adapterConfig, 'auth_header') ?? 'authorization';
    const authTemplate =
      readSetting(context.adapterConfig, 'auth_template') ?? 'Bearer {{api_key}}';
    const bodyTemplate =
      readSetting(context.adapterConfig, 'checkout_body') ??
      '{"amount":"{{amount}}","currency":"{{currency}}","reference":"{{intent_id}}","return_url":"{{return_url}}"}';
    const urlField = readSetting(context.adapterConfig, 'checkout_url_field') ?? 'checkout_url';
    const referenceField =
      readSetting(context.adapterConfig, 'checkout_reference_field') ?? 'reference';

    const values: Record<string, string> = {
      ...context.credentials,
      intent_id: request.intentId,
      amount: request.amount,
      amount_minor: String(request.amountMinor),
      currency: request.currency,
      description: request.description,
      return_url: request.returnUrl,
      payer_email: request.payerEmail ?? '',
    };

    const response = await fetch(fill(endpoint, values), {
      method: readSetting(context.adapterConfig, 'checkout_method') ?? 'POST',
      headers: {
        [authHeader]: fill(authTemplate, values),
        'content-type': 'application/json',
      },
      body: fill(bodyTemplate, values),
    });

    const payload: unknown = await response.json().catch(() => null);
    const reply =
      typeof payload === 'object' && payload !== null && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};

    const url = typeof reply[urlField] === 'string' ? (reply[urlField] as string) : null;

    if (!response.ok || url === null) {
      logger.error('A configured gateway refused to start a payment', null, {
        provider: context.provider,
        status: response.status,
      });

      throw new AppError('unexpected', 'This payment could not be started. Please try again.');
    }

    return {
      checkoutUrl: url,
      providerReference:
        typeof reply[referenceField] === 'string' ? (reply[referenceField] as string) : null,
      instructions: null,
    };
  },
};

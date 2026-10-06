// src/lib/payments/adapters/nium.ts
// Nium, which is a money movement network rather than a card page.
//
// Nium is used in two ways. Money leaves through it, which the payout rail
// handles, and money can arrive into a virtual receiving account held in the
// name of the business. There is no hosted card page, so a payment started
// here answers with the account details the client should transfer to.

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

const DEFAULT_BASE_URL = 'https://gateway.nium.com/api';
const DEFAULT_VIRTUAL_ACCOUNT_PATH =
  '/v1/client/{client_hash_id}/customer/{customer_hash_id}/virtualAccountDetails';

/**
 * Reads a text setting from the adapter configuration.
 *
 * @param context Connection being used.
 * @param key Name of the setting.
 * @param fallback Value used when the setting is absent.
 * @returns The configured text, trimmed.
 */
function configuredText(context: GatewayContext, key: string, fallback: string): string {
  const value = context.adapterConfig[key];

  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

/**
 * Fills the client and customer identifiers into a path template.
 *
 * @param template Path containing the placeholders.
 * @param clientHashId Client identifier issued by Nium.
 * @param customerHashId Customer the wallet belongs to.
 * @returns The path with both identifiers in place.
 */
function fillPath(template: string, clientHashId: string, customerHashId: string): string {
  return template
    .replace('{client_hash_id}', encodeURIComponent(clientHashId))
    .replace('{customer_hash_id}', encodeURIComponent(customerHashId));
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

/**
 * Picks the first readable account description out of a Nium reply, which
 * sends either one object or a list of them depending on the product.
 *
 * @param payload Parsed reply body.
 * @returns The first account object, or null when there is none.
 */
function firstAccount(payload: unknown): Record<string, unknown> | null {
  if (Array.isArray(payload)) {
    const first = payload[0];

    return isRecord(first) ? first : null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  for (const key of ['virtualAccounts', 'accountDetails', 'data', 'content']) {
    const nested = payload[key];

    if (Array.isArray(nested)) {
      const first = nested[0];

      if (isRecord(first)) {
        return first;
      }
    }

    if (isRecord(nested)) {
      return nested;
    }
  }

  return payload;
}

/**
 * Reads the first filled value among several possible field names.
 *
 * @param source Object returned by Nium.
 * @param keys Field names to try, in order of preference.
 * @returns The value found, or null.
 */
function readField(source: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

export const niumAdapter: GatewayAdapter = {
  key: 'nium',

  /**
   * Reads the funding wallet, which proves the key and the identifiers match.
   *
   * @param context Credentials of the connection.
   * @returns Whether Nium accepted the credentials.
   */
  async testConnection(context: GatewayContext): Promise<ConnectionTestResult> {
    const apiKey = context.credentials['api_key'];
    const clientHashId = context.credentials['client_hash_id'];
    const customerHashId = context.credentials['customer_hash_id'];

    if (!apiKey) {
      return { isHealthy: false, message: 'No API key has been saved yet.' };
    }

    if (!clientHashId) {
      return { isHealthy: false, message: 'Add the client identifier Nium issued with the key.' };
    }

    if (!customerHashId) {
      return {
        isHealthy: false,
        message: 'Add the customer identifier so the funding wallet can be read.',
      };
    }

    const baseUrl = configuredText(context, 'base_url', DEFAULT_BASE_URL);
    const endpoint = `${baseUrl}/v1/client/${encodeURIComponent(clientHashId)}/customer/${encodeURIComponent(customerHashId)}/wallet`;

    try {
      const response = await fetch(endpoint, {
        headers: { 'x-api-key': apiKey, accept: 'application/json' },
      });

      if (response.ok) {
        return {
          isHealthy: true,
          message: 'Nium accepted the key and the funding wallet is reachable.',
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          isHealthy: false,
          message: 'Nium rejected the key. Check that it was copied in full.',
        };
      }

      if (response.status === 404) {
        return {
          isHealthy: false,
          message: 'Nium does not recognise that client or customer identifier.',
        };
      }

      return {
        isHealthy: false,
        message: `Nium answered with status ${response.status}. Try again in a moment.`,
      };
    } catch (caught) {
      logger.error('Nium could not be reached', caught, { mode: context.mode });

      return { isHealthy: false, message: 'Nium could not be reached from this server.' };
    }
  },

  /**
   * Fetches the receiving account the client should transfer into.
   *
   * @param context Credentials of the connection.
   * @param request What is being paid.
   * @returns Transfer instructions rather than a hosted page.
   */
  async startCheckout(context: GatewayContext, request: CheckoutRequest): Promise<CheckoutStart> {
    const apiKey = context.credentials['api_key'];
    const clientHashId = context.credentials['client_hash_id'];
    const customerHashId = context.credentials['customer_hash_id'];

    if (!apiKey || !clientHashId || !customerHashId) {
      throw new AppError('unexpected', 'This payment method is not ready yet.');
    }

    const baseUrl = configuredText(context, 'base_url', DEFAULT_BASE_URL);
    const path = fillPath(
      configuredText(context, 'virtual_account_path', DEFAULT_VIRTUAL_ACCOUNT_PATH),
      clientHashId,
      customerHashId
    );

    const response = await fetch(`${baseUrl}${path}`, {
      headers: { 'x-api-key': apiKey, accept: 'application/json' },
    });

    if (!response.ok) {
      logger.error('Nium refused to describe the receiving account', null, {
        status: response.status,
        intentId: request.intentId,
      });

      throw new AppError('unexpected', 'This payment could not be started. Please try again.');
    }

    const payload: unknown = await response.json();
    const account = firstAccount(payload);

    if (account === null) {
      throw new AppError('unexpected', 'This payment could not be started. Please try again.');
    }

    const accountNumber = readField(account, [
      'accountNumber',
      'virtualAccountNumber',
      'uniquePayerId',
      'iban',
    ]);
    const bankName = readField(account, ['bankName', 'beneficiaryBankName']);
    const holder = readField(account, ['accountName', 'beneficiaryName', 'accountHolderName']);
    const routing = readField(account, ['routingCodeValue', 'bankCode', 'swiftCode', 'bic']);
    const reference = readField(account, ['uniquePaymentId', 'paymentId']) ?? request.intentId;

    if (accountNumber === null) {
      throw new AppError('unexpected', 'This payment could not be started. Please try again.');
    }

    const lines = [
      `Transfer ${request.currency.toUpperCase()} ${request.amount} to the account below.`,
      holder === null ? null : `Account name: ${holder}`,
      `Account number: ${accountNumber}`,
      bankName === null ? null : `Bank: ${bankName}`,
      routing === null ? null : `Bank code: ${routing}`,
      `Payment reference: ${reference}`,
      'The invoice is marked as paid as soon as the transfer arrives.',
    ].filter((line): line is string => line !== null);

    return {
      checkoutUrl: null,
      providerReference: reference,
      instructions: lines.join('\n'),
    };
  },
};

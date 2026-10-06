// src/lib/payouts/rails/nium.ts
// Sending money out through Nium.
//
// Nium holds a funded wallet for the platform and reaches bank accounts and
// mobile wallets in most countries from it. A payout is a remittance out of
// that wallet, either to a beneficiary Nium already holds or to account
// details sent with the instruction.

import 'server-only';

import { logger } from '@/lib/logger';
import type {
  PayoutDispatch,
  PayoutInstruction,
  PayoutRailAdapter,
  PayoutRailContext,
} from '@/lib/payouts/rails/types';

const DEFAULT_BASE_URL = 'https://gateway.nium.com/api';

/**
 * Reads a text setting saved beside the connection.
 *
 * @param context Connection being used.
 * @param key Name of the setting.
 * @returns The value, or null when it was never saved.
 */
function setting(context: PayoutRailContext, key: string): string | null {
  const value = context.settings[key];

  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
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
 * Collects the three identifiers every Nium call needs.
 *
 * @param context Connection being used.
 * @returns The identifiers, or null when one of them is missing.
 */
function identifiers(context: PayoutRailContext): {
  apiKey: string;
  clientHashId: string;
  customerHashId: string;
  walletHashId: string;
  baseUrl: string;
} | null {
  const apiKey = context.credentials['api_key'];
  const clientHashId = context.credentials['client_hash_id'];
  const customerHashId =
    setting(context, 'customer_hash_id') ?? context.credentials['customer_hash_id'];
  const walletHashId = setting(context, 'wallet_hash_id') ?? context.credentials['wallet_hash_id'];

  if (!apiKey || !clientHashId || !customerHashId || !walletHashId) {
    return null;
  }

  return {
    apiKey,
    clientHashId,
    customerHashId,
    walletHashId,
    baseUrl: setting(context, 'base_url') ?? DEFAULT_BASE_URL,
  };
}

export const niumPayoutRail: PayoutRailAdapter = {
  key: 'nium',

  /**
   * Reads the funding wallet, which proves the money has somewhere to leave
   * from before any payout is approved.
   *
   * @param context Credentials and configuration of the connection.
   * @returns Whether Nium accepted the credentials.
   */
  async verify(context: PayoutRailContext): Promise<PayoutDispatch> {
    const parts = identifiers(context);

    if (parts === null) {
      return {
        isAccepted: false,
        providerReference: null,
        providerStatus: null,
        message: 'Add the Nium key, client, customer and funding wallet first.',
      };
    }

    const endpoint = `${parts.baseUrl}/v1/client/${encodeURIComponent(parts.clientHashId)}/customer/${encodeURIComponent(parts.customerHashId)}/wallet`;

    try {
      const response = await fetch(endpoint, {
        headers: { 'x-api-key': parts.apiKey, accept: 'application/json' },
      });

      if (response.ok) {
        return {
          isAccepted: true,
          providerReference: parts.walletHashId,
          providerStatus: 'reachable',
          message: 'Nium accepted the key and the funding wallet is reachable.',
        };
      }

      return {
        isAccepted: false,
        providerReference: null,
        providerStatus: String(response.status),
        message: `Nium answered with status ${response.status} when reading the wallet.`,
      };
    } catch (caught) {
      logger.error('Nium could not be reached', caught, { mode: context.mode });

      return {
        isAccepted: false,
        providerReference: null,
        providerStatus: null,
        message: 'Nium could not be reached from this server.',
      };
    }
  },

  /**
   * Sends one remittance out of the funding wallet.
   *
   * @param context Credentials and configuration of the connection.
   * @param instruction Who is paid, how much, and where.
   * @returns What Nium said about the transfer.
   */
  async send(context: PayoutRailContext, instruction: PayoutInstruction): Promise<PayoutDispatch> {
    const parts = identifiers(context);

    if (parts === null) {
      return {
        isAccepted: false,
        providerReference: null,
        providerStatus: null,
        message: 'This Nium connection is not ready to send money yet.',
      };
    }

    const beneficiary =
      instruction.beneficiaryReference === null
        ? {
            name: instruction.beneficiaryName,
            accountType: 'Corporate',
            countryCode: instruction.countryCode.toUpperCase(),
            destinationCountry: instruction.countryCode.toUpperCase(),
            destinationCurrency: instruction.destinationCurrency.toUpperCase(),
            payoutMethod: 'LOCAL',
            accountNumber: instruction.accountNumber ?? '',
            routingCodeType1: 'SWIFT',
            routingCodeValue1: instruction.routingCode ?? '',
          }
        : { id: instruction.beneficiaryReference };

    const body = {
      beneficiary,
      payout: {
        source_amount: instruction.amount,
        source_currency: instruction.currency.toUpperCase(),
        destination_currency: instruction.destinationCurrency.toUpperCase(),
      },
      purposeCode: setting(context, 'purpose_code') ?? 'IR001',
      sourceOfFunds: setting(context, 'source_of_funds') ?? 'Business Revenue',
      customerComments: instruction.narrative.slice(0, 120),
      externalId: instruction.payoutId,
    };

    const endpoint = `${parts.baseUrl}/v2/client/${encodeURIComponent(parts.clientHashId)}/customer/${encodeURIComponent(parts.customerHashId)}/wallet/${encodeURIComponent(parts.walletHashId)}/remittance`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': parts.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
          'x-request-id': instruction.payoutId,
        },
        body: JSON.stringify(body),
      });

      const payload: unknown = await response.json();
      const result = isRecord(payload) ? payload : {};
      const reference =
        typeof result['systemReferenceNumber'] === 'string'
          ? result['systemReferenceNumber']
          : typeof result['transactionId'] === 'string'
            ? result['transactionId']
            : null;
      const status = typeof result['status'] === 'string' ? result['status'] : null;

      if (!response.ok) {
        const detail =
          typeof result['message'] === 'string'
            ? result['message']
            : `Nium answered with status ${response.status}.`;

        logger.error('Nium refused a remittance', null, {
          status: response.status,
          payoutId: instruction.payoutId,
        });

        return {
          isAccepted: false,
          providerReference: reference,
          providerStatus: status,
          message: detail,
        };
      }

      return {
        isAccepted: true,
        providerReference: reference,
        providerStatus: status,
        message: 'Nium accepted the transfer.',
      };
    } catch (caught) {
      logger.error('Nium could not be reached for a remittance', caught, {
        payoutId: instruction.payoutId,
      });

      return {
        isAccepted: false,
        providerReference: null,
        providerStatus: null,
        message: 'Nium could not be reached from this server.',
      };
    }
  },
};

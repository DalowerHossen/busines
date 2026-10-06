// src/lib/payouts/rails/adyen.ts
// Paying a business out of its Adyen balance account.
//
// Money taken through Adyen lands in a balance account that belongs to the
// business. A payout is a transfer out of that balance to the bank account
// the business registered, which is the transfers part of the balance
// platform rather than the checkout interface.

import 'server-only';

import { logger } from '@/lib/logger';
import type {
  PayoutDispatch,
  PayoutInstruction,
  PayoutRailAdapter,
  PayoutRailContext,
} from '@/lib/payouts/rails/types';

const TEST_BASE_URL = 'https://balanceplatform-api-test.adyen.com';
const LIVE_BASE_URL = 'https://balanceplatform-api-live.adyen.com';
const TRANSFERS_PATH = '/btl/v4/transfers';
const CONFIGURATION_PATH = '/bcl/v2/balanceAccounts';

/**
 * Chooses the balance platform host for the mode in use.
 *
 * @param context Connection being used.
 * @returns The base address, without a trailing slash.
 */
function baseUrlFor(context: PayoutRailContext): string {
  return context.mode === 'live' ? LIVE_BASE_URL : TEST_BASE_URL;
}

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

export const adyenPayoutRail: PayoutRailAdapter = {
  key: 'adyen',

  /**
   * Reads the balance account, which proves the key reaches it.
   *
   * @param context Credentials and configuration of the connection.
   * @returns Whether Adyen accepted the credentials.
   */
  async verify(context: PayoutRailContext): Promise<PayoutDispatch> {
    const apiKey = context.credentials['api_key'];
    const balanceAccountId = setting(context, 'balance_account_id');

    if (!apiKey) {
      return {
        isAccepted: false,
        providerReference: null,
        providerStatus: null,
        message: 'No API key has been saved for Adyen yet.',
      };
    }

    if (balanceAccountId === null) {
      return {
        isAccepted: false,
        providerReference: null,
        providerStatus: null,
        message: 'Connect the balance account this business is paid into.',
      };
    }

    try {
      const response = await fetch(
        `${baseUrlFor(context)}${CONFIGURATION_PATH}/${encodeURIComponent(balanceAccountId)}`,
        { headers: { 'x-api-key': apiKey, accept: 'application/json' } }
      );

      if (response.ok) {
        return {
          isAccepted: true,
          providerReference: balanceAccountId,
          providerStatus: 'reachable',
          message: 'Adyen accepted the key and the balance account is reachable.',
        };
      }

      return {
        isAccepted: false,
        providerReference: null,
        providerStatus: String(response.status),
        message: `Adyen answered with status ${response.status} when reading the balance account.`,
      };
    } catch (caught) {
      logger.error('Adyen balance platform could not be reached', caught, {
        mode: context.mode,
      });

      return {
        isAccepted: false,
        providerReference: null,
        providerStatus: null,
        message: 'Adyen could not be reached from this server.',
      };
    }
  },

  /**
   * Moves money out of the balance account to the registered bank account.
   *
   * @param context Credentials and configuration of the connection.
   * @param instruction Who is paid, how much, and where.
   * @returns What Adyen said about the transfer.
   */
  async send(context: PayoutRailContext, instruction: PayoutInstruction): Promise<PayoutDispatch> {
    const apiKey = context.credentials['api_key'];
    const balanceAccountId = setting(context, 'balance_account_id');

    if (!apiKey || balanceAccountId === null) {
      return {
        isAccepted: false,
        providerReference: null,
        providerStatus: null,
        message: 'This Adyen connection is not ready to send money yet.',
      };
    }

    const counterparty =
      instruction.beneficiaryReference === null
        ? {
            bankAccount: {
              accountHolder: { fullName: instruction.beneficiaryName },
              accountIdentification: {
                type: 'iban',
                iban: instruction.accountNumber ?? '',
              },
            },
          }
        : { transferInstrumentId: instruction.beneficiaryReference };

    const body = {
      amount: { currency: instruction.currency.toUpperCase(), value: instruction.amountMinor },
      balanceAccountId,
      category: 'bank',
      counterparty,
      priority: 'regular',
      referenceForBeneficiary: instruction.narrative.slice(0, 80),
      reference: instruction.payoutId,
      description: instruction.narrative.slice(0, 140),
    };

    try {
      const response = await fetch(`${baseUrlFor(context)}${TRANSFERS_PATH}`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
          'idempotency-key': instruction.payoutId,
        },
        body: JSON.stringify(body),
      });

      const payload: unknown = await response.json();
      const transfer = isRecord(payload) ? payload : {};
      const id = typeof transfer['id'] === 'string' ? transfer['id'] : null;
      const status = typeof transfer['status'] === 'string' ? transfer['status'] : null;

      if (!response.ok) {
        const detail =
          typeof transfer['detail'] === 'string'
            ? transfer['detail']
            : `Adyen answered with status ${response.status}.`;

        logger.error('Adyen refused a transfer', null, {
          status: response.status,
          payoutId: instruction.payoutId,
        });

        return {
          isAccepted: false,
          providerReference: id,
          providerStatus: status,
          message: detail,
        };
      }

      return {
        isAccepted: true,
        providerReference: id,
        providerStatus: status,
        message: 'Adyen accepted the transfer.',
      };
    } catch (caught) {
      logger.error('Adyen could not be reached for a transfer', caught, {
        payoutId: instruction.payoutId,
      });

      return {
        isAccepted: false,
        providerReference: null,
        providerStatus: null,
        message: 'Adyen could not be reached from this server.',
      };
    }
  },
};

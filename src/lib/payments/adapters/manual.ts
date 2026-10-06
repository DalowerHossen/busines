// src/lib/payments/adapters/manual.ts
// Being paid outside the platform. There is nothing to call, so the check
// confirms that the business has said how it wants to be paid.

import 'server-only';

import type {
  CheckoutRequest,
  CheckoutStart,
  ConnectionTestResult,
  GatewayAdapter,
  GatewayContext,
} from '@/lib/payments/adapters/types';

export const manualAdapter: GatewayAdapter = {
  key: 'manual',

  /**
   * Confirms that manual payment is ready to be offered.
   *
   * @param _context Unused, because nothing is called.
   * @returns Always healthy, with an explanation.
   */
  async testConnection(_context: GatewayContext): Promise<ConnectionTestResult> {
    return Promise.resolve({
      isHealthy: true,
      message:
        'Nothing to connect. Your clients see the bank details from your business profile and you record the payment when it arrives.',
    });
  },

  /**
   * There is nowhere to send the client, so they are told what to do instead.
   *
   * @param _context Unused, because nothing is called.
   * @param request What is being paid.
   * @returns Instructions rather than an address.
   */
  async startCheckout(_context: GatewayContext, request: CheckoutRequest): Promise<CheckoutStart> {
    return Promise.resolve({
      checkoutUrl: null,
      providerReference: null,
      instructions: `Transfer ${request.amount} ${request.currency} using the bank details on this page and quote ${request.description}. The payment is marked as received once it arrives.`,
    });
  },
};

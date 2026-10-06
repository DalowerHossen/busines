// src/lib/payouts/rails/registry.ts
// Choosing the network a payout travels over.

import 'server-only';

import { adyenPayoutRail } from '@/lib/payouts/rails/adyen';
import { niumPayoutRail } from '@/lib/payouts/rails/nium';
import type { PayoutRailAdapter } from '@/lib/payouts/rails/types';
import type { PayoutMethod } from '@/types/enums';

const RAILS: Readonly<Record<'adyen' | 'nium', PayoutRailAdapter>> = {
  adyen: adyenPayoutRail,
  nium: niumPayoutRail,
};

/**
 * Returns the adapter for one rail.
 *
 * @param rail Rail the money travels over.
 * @returns The adapter that speaks to it.
 */
export function payoutRailFor(rail: 'adyen' | 'nium'): PayoutRailAdapter {
  return RAILS[rail];
}

/**
 * Works out which rail a chosen payout method travels over.
 *
 * @param method Method saved on the payout destination.
 * @returns The rail, or null when the money is sent by hand.
 */
export function railForPayoutMethod(method: PayoutMethod): 'adyen' | 'nium' | null {
  if (method === 'adyen_transfer') {
    return 'adyen';
  }

  if (method === 'nium_transfer') {
    return 'nium';
  }

  return null;
}

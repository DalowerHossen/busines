// src/lib/payments/adapters/registry.ts
// Choosing the adapter for a provider. Anything without a dedicated adapter
// is handled by the configurable one, which is what makes a brand new
// provider a matter of configuration rather than a release.

import 'server-only';

import { adyenAdapter } from '@/lib/payments/adapters/adyen';
import { configurableAdapter } from '@/lib/payments/adapters/configurable';
import { manualAdapter } from '@/lib/payments/adapters/manual';
import { niumAdapter } from '@/lib/payments/adapters/nium';
import { paypalAdapter } from '@/lib/payments/adapters/paypal';
import { stripeAdapter } from '@/lib/payments/adapters/stripe';
import type { GatewayAdapter } from '@/lib/payments/adapters/types';
import type { GatewayProvider } from '@/types/enums';

const DEDICATED: Partial<Record<GatewayProvider, GatewayAdapter>> = {
  stripe: stripeAdapter,
  paypal: paypalAdapter,
  adyen: adyenAdapter,
  nium: niumAdapter,
  manual: manualAdapter,
};

/**
 * Returns the adapter that speaks to one provider.
 *
 * @param provider Provider being used.
 * @returns The adapter for that provider.
 */
export function adapterFor(provider: GatewayProvider): GatewayAdapter {
  return DEDICATED[provider] ?? configurableAdapter;
}

// src/config/gateways.ts
// Central payment gateway registry. `internalName` is for admin-panel and
// log use only. `publicLabel` is the ONLY string allowed to reach public,
// client-facing UI copy: per docs/planning/ARCHITECTURE-DECISIONS.md
// section 4, no page a client or the public ever sees may print a specific
// provider or country brand name. The concrete adapters live in
// src/lib/payments/; this file only describes each gateway's capabilities so
// the rest of the application can branch on capability, not on identity.
import type { GatewayId } from '@/types/payment';

/**
 * Static capability and display metadata for one payment gateway adapter.
 */
export interface GatewayDefinition {
  readonly id: GatewayId;
  /** Admin-panel and internal log display name only - never shown to clients. */
  readonly internalName: string;
  /** Generic, brand-free label safe to render in any client-facing UI. */
  readonly publicLabel: string;
  readonly supportsCardPayments: boolean;
  readonly supportsRecurringBilling: boolean;
  readonly supportsPayouts: boolean;
  readonly supportsDirectEcommerceCheckout: boolean;
  readonly requiresKycForMor: boolean;
  readonly isCrossBorderPayoutRail: boolean;
}

/**
 * Every gateway adapter the platform ships out of the box, plus the two
 * configurable local payment rails and the generic custom-gateway slot a
 * super_admin can configure without a code change.
 */
export const GATEWAY_REGISTRY: readonly GatewayDefinition[] = [
  {
    id: 'stripe',
    internalName: 'Stripe',
    publicLabel: 'Card payment',
    supportsCardPayments: true,
    supportsRecurringBilling: true,
    supportsPayouts: true,
    supportsDirectEcommerceCheckout: true,
    requiresKycForMor: true,
    isCrossBorderPayoutRail: false,
  },
  {
    id: 'paypal',
    internalName: 'PayPal',
    publicLabel: 'Online wallet payment',
    supportsCardPayments: true,
    supportsRecurringBilling: true,
    supportsPayouts: true,
    supportsDirectEcommerceCheckout: true,
    requiresKycForMor: true,
    isCrossBorderPayoutRail: false,
  },
  {
    id: 'paddle',
    internalName: 'Paddle',
    publicLabel: 'Card payment',
    supportsCardPayments: true,
    supportsRecurringBilling: true,
    supportsPayouts: true,
    supportsDirectEcommerceCheckout: false,
    requiresKycForMor: true,
    isCrossBorderPayoutRail: false,
  },
  {
    id: 'nmi',
    internalName: 'NMI',
    publicLabel: 'Card payment',
    supportsCardPayments: true,
    supportsRecurringBilling: true,
    supportsPayouts: false,
    supportsDirectEcommerceCheckout: true,
    requiresKycForMor: true,
    isCrossBorderPayoutRail: false,
  },
  {
    id: 'two_checkout',
    internalName: '2Checkout (Verifone)',
    publicLabel: 'Card payment',
    supportsCardPayments: true,
    supportsRecurringBilling: true,
    supportsPayouts: false,
    supportsDirectEcommerceCheckout: true,
    requiresKycForMor: true,
    isCrossBorderPayoutRail: false,
  },
  {
    id: 'adyen_for_platforms',
    internalName: 'Adyen for Platforms',
    publicLabel: 'Global payout partner',
    supportsCardPayments: true,
    supportsRecurringBilling: true,
    supportsPayouts: true,
    supportsDirectEcommerceCheckout: true,
    requiresKycForMor: true,
    isCrossBorderPayoutRail: true,
  },
  {
    id: 'nium',
    internalName: 'Nium',
    publicLabel: 'Global payout partner',
    supportsCardPayments: false,
    supportsRecurringBilling: false,
    supportsPayouts: true,
    supportsDirectEcommerceCheckout: false,
    requiresKycForMor: true,
    isCrossBorderPayoutRail: true,
  },
  {
    id: 'local_rail_1',
    internalName: 'Local Payment Rail 1',
    publicLabel: 'Local payment method',
    supportsCardPayments: false,
    supportsRecurringBilling: false,
    supportsPayouts: true,
    supportsDirectEcommerceCheckout: false,
    requiresKycForMor: true,
    isCrossBorderPayoutRail: false,
  },
  {
    id: 'local_rail_2',
    internalName: 'Local Payment Rail 2',
    publicLabel: 'Local payment method',
    supportsCardPayments: false,
    supportsRecurringBilling: false,
    supportsPayouts: true,
    supportsDirectEcommerceCheckout: false,
    requiresKycForMor: true,
    isCrossBorderPayoutRail: false,
  },
  {
    id: 'manual_bank_transfer',
    internalName: 'Manual Bank Transfer',
    publicLabel: 'Bank transfer',
    supportsCardPayments: false,
    supportsRecurringBilling: false,
    supportsPayouts: true,
    supportsDirectEcommerceCheckout: false,
    requiresKycForMor: false,
    isCrossBorderPayoutRail: false,
  },
  {
    id: 'custom',
    internalName: 'Custom Gateway',
    publicLabel: 'Alternative payment method',
    supportsCardPayments: false,
    supportsRecurringBilling: false,
    supportsPayouts: false,
    supportsDirectEcommerceCheckout: false,
    requiresKycForMor: true,
    isCrossBorderPayoutRail: false,
  },
];

const GATEWAY_BY_ID = new Map<GatewayId, GatewayDefinition>(
  GATEWAY_REGISTRY.map((definition) => [definition.id, definition])
);

/**
 * Looks up a gateway's capability metadata by its id.
 *
 * @param id The gateway identifier to look up.
 * @returns The matching definition, or `undefined` if unknown.
 */
export function getGatewayDefinition(id: GatewayId): GatewayDefinition | undefined {
  return GATEWAY_BY_ID.get(id);
}

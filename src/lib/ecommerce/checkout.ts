import 'server-only';

import {
  authenticateDirectCheckoutPublishableKey,
  bindDirectCheckoutSession,
  validateDirectCheckoutRequest,
} from './direct-checkout';
import { invalidRequest } from './errors';
import type { ShopifyStorefrontClient } from './shopify-storefront';
import type {
  DirectCheckoutKeyRecord,
  DirectCheckoutRequest,
  DirectCheckoutSessionContract,
  HostedCheckoutSession,
} from './types';
import type { WooCommerceClient } from './woocommerce';

export interface DirectCheckoutSessionRecord {
  readonly sessionId: string;
  readonly checkout: HostedCheckoutSession | null;
}

export interface DirectCheckoutSessionStore {
  findByIdempotency(input: {
    readonly companyId: string;
    readonly idempotencyKey: string;
  }): Promise<DirectCheckoutSessionRecord | null>;
  createSession(input: DirectCheckoutSessionContract): Promise<{ readonly sessionId: string }>;
  attachProviderCheckout(input: {
    readonly sessionId: string;
    readonly checkout: HostedCheckoutSession;
  }): Promise<void>;
  markProviderFailure(input: { readonly sessionId: string }): Promise<void>;
}

export interface DirectCheckoutProvider {
  readonly platform: 'shopify' | 'woocommerce';
  createHostedCheckout(input: DirectCheckoutSessionContract): Promise<HostedCheckoutSession>;
}

export async function createHostedCheckoutSession(input: {
  readonly request: DirectCheckoutRequest;
  readonly requestOrigin: string;
  readonly key: DirectCheckoutKeyRecord;
  readonly store: DirectCheckoutSessionStore;
  readonly provider: DirectCheckoutProvider;
}): Promise<DirectCheckoutSessionRecord> {
  if (input.provider.platform !== 'shopify' && input.provider.platform !== 'woocommerce') {
    throw invalidRequest('direct-checkout');
  }
  authenticateDirectCheckoutPublishableKey(
    input.request.publishableKey,
    input.key,
    input.requestOrigin
  );
  const contract = bindDirectCheckoutSession(
    validateDirectCheckoutRequest(input.request, input.key.allowedOrigins),
    input.key
  );
  const existing = await input.store.findByIdempotency({
    companyId: contract.companyId,
    idempotencyKey: contract.idempotencyKey,
  });
  if (existing) return existing;

  const session = await input.store.createSession(contract);
  try {
    const checkout = await input.provider.createHostedCheckout(contract);
    await input.store.attachProviderCheckout({ sessionId: session.sessionId, checkout });
    return { sessionId: session.sessionId, checkout };
  } catch (error) {
    await input.store.markProviderFailure({ sessionId: session.sessionId });
    throw error;
  }
}

export function createShopifyDirectCheckoutProvider(
  client: ShopifyStorefrontClient
): DirectCheckoutProvider {
  return {
    platform: 'shopify',
    async createHostedCheckout(contract): Promise<HostedCheckoutSession> {
      return client.createHostedCheckout({
        merchandiseIds: contract.lineItems.map((lineItem) => {
          if (!lineItem.externalVariantId) throw invalidRequest('direct-checkout');
          return {
            merchandiseId: lineItem.externalVariantId,
            quantity: parseQuantity(lineItem.quantity),
          };
        }),
        customerEmail: contract.customerEmail ?? undefined,
      });
    },
  };
}

export function createWooCommerceDirectCheckoutProvider(
  client: WooCommerceClient
): DirectCheckoutProvider {
  return {
    platform: 'woocommerce',
    async createHostedCheckout(contract): Promise<HostedCheckoutSession> {
      const checkout = await client.createHostedCheckout({
        currencyCode: contract.currencyCode,
        lineItems: contract.lineItems.map((lineItem) => ({
          productId: lineItem.externalProductId,
          variationId: lineItem.externalVariantId,
          quantity: parseQuantity(lineItem.quantity),
        })),
        customerEmail: contract.customerEmail ?? undefined,
      });
      return {
        provider: 'woocommerce',
        providerSessionId: checkout.providerSessionId,
        checkoutUrl: checkout.checkoutUrl,
      };
    },
  };
}

function parseQuantity(value: string): number {
  const quantity = Number(value);
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw invalidRequest('direct-checkout');
  return quantity;
}

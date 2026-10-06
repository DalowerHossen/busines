import 'server-only';

import { EcommerceProviderError, invalidConfiguration, invalidResponse } from './errors';
import { requestJson, requireHttpsUrl } from './http';
import type { EcommerceFetch, HostedCheckoutSession, ProviderHttpResponse } from './types';

const DEFAULT_SHOPIFY_STOREFRONT_API_VERSION = '2026-10';

const SHOPIFY_CART_CREATE_MUTATION = `
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart { id checkoutUrl }
      userErrors { field message }
    }
  }
`;

export interface ShopifyStorefrontConfig {
  readonly storeDomain: string;
  readonly storefrontAccessToken: string;
  readonly apiVersion?: string;
  readonly fetchImpl?: EcommerceFetch;
  readonly timeoutMs?: number;
}

export interface ShopifyCartCheckoutInput {
  readonly merchandiseIds: readonly { readonly merchandiseId: string; readonly quantity: number }[];
  readonly customerEmail?: string;
}

interface ShopifyCartCreateData {
  readonly cartCreate: {
    readonly cart: { readonly id: string; readonly checkoutUrl: string } | null;
    readonly userErrors: readonly {
      readonly field: readonly string[] | null;
      readonly message: string;
    }[];
  };
}

interface ShopifyGraphqlResponse<T> {
  readonly data?: T;
  readonly errors?: readonly { readonly message: string }[];
}

export class ShopifyStorefrontClient {
  private readonly config: {
    readonly origin: string;
    readonly storefrontAccessToken: string;
    readonly apiVersion: string;
    readonly fetchImpl?: EcommerceFetch;
    readonly timeoutMs: number;
  };

  constructor(config: ShopifyStorefrontConfig) {
    const storeDomain = config.storeDomain.includes('://')
      ? config.storeDomain
      : `https://${config.storeDomain}`;
    const origin = requireHttpsUrl(storeDomain, 'shopify').origin;
    if (!config.storefrontAccessToken) throw invalidConfiguration('shopify');
    this.config = {
      origin,
      storefrontAccessToken: config.storefrontAccessToken,
      apiVersion: config.apiVersion ?? DEFAULT_SHOPIFY_STOREFRONT_API_VERSION,
      fetchImpl: config.fetchImpl,
      timeoutMs: config.timeoutMs ?? 15_000,
    };
  }

  async createHostedCheckout(input: ShopifyCartCheckoutInput): Promise<HostedCheckoutSession> {
    if (input.merchandiseIds.length === 0) throw invalidConfiguration('shopify');
    const lines = input.merchandiseIds.map((line) => {
      if (!line.merchandiseId || !Number.isSafeInteger(line.quantity) || line.quantity < 1) {
        throw invalidConfiguration('shopify');
      }
      return { merchandiseId: line.merchandiseId, quantity: line.quantity };
    });
    const cartInput = {
      lines,
      ...(input.customerEmail ? { buyerIdentity: { email: input.customerEmail } } : {}),
    };
    const response: ProviderHttpResponse<ShopifyGraphqlResponse<ShopifyCartCreateData>> =
      await requestJson({
        provider: 'shopify',
        url: `${this.config.origin}/api/${this.config.apiVersion}/graphql.json`,
        method: 'POST',
        headers: { 'X-Shopify-Storefront-Access-Token': this.config.storefrontAccessToken },
        body: { query: SHOPIFY_CART_CREATE_MUTATION, variables: { input: cartInput } },
        fetchImpl: this.config.fetchImpl,
        timeoutMs: this.config.timeoutMs,
      });
    if (response.data.errors && response.data.errors.length > 0) {
      throw new EcommerceProviderError('shopify', 'provider_rejected', response.status, false);
    }
    const result = response.data.data?.cartCreate;
    if (
      !result ||
      !Array.isArray(result.userErrors) ||
      result.userErrors.length > 0 ||
      !result.cart ||
      !result.cart.id ||
      !isHttpsUrl(result.cart.checkoutUrl)
    ) {
      throw invalidResponse('shopify', response.status);
    }
    return {
      provider: 'shopify',
      providerSessionId: result.cart.id,
      checkoutUrl: result.cart.checkoutUrl,
    };
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

import 'server-only';

import { EcommerceProviderError, invalidConfiguration, invalidResponse } from './errors';
import { requestJson, requireHttpsUrl } from './http';
import { normalizeShopifyOrder } from './normalize';
import type {
  EcommerceFetch,
  EcommercePage,
  NormalizedEcommerceOrder,
  OrderSyncOptions,
  ProviderHttpResponse,
} from './types';

const DEFAULT_SHOPIFY_API_VERSION = '2026-10';

export const SHOPIFY_ORDERS_QUERY = `
  query Orders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: false) {
      edges {
        cursor
        node {
          id
          name
          email
          phone
          createdAt
          updatedAt
          currencyCode
          displayFinancialStatus
          displayFulfillmentStatus
          currentSubtotalPriceSet { shopMoney { amount currencyCode } }
          currentTotalDiscountsSet { shopMoney { amount currencyCode } }
          currentShippingPriceSet { shopMoney { amount currencyCode } }
          currentTotalTaxSet { shopMoney { amount currencyCode } }
          currentTotalPriceSet { shopMoney { amount currencyCode } }
          customer { displayName email phone }
          billingAddress {
            firstName lastName company address1 address2 city province zip countryCode phone
          }
          shippingAddress {
            firstName lastName company address1 address2 city province zip countryCode phone
          }
          lineItems(first: 250) {
            nodes {
              id
              name
              quantity
              sku
              product { id }
              variant { id }
              originalUnitPriceSet { shopMoney { amount currencyCode } }
              discountedTotalSet { shopMoney { amount currencyCode } }
              totalDiscountSet { shopMoney { amount currencyCode } }
              taxLines { priceSet { shopMoney { amount currencyCode } } }
            }
            pageInfo { hasNextPage }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const SHOPIFY_WEBHOOK_SUBSCRIPTION_MUTATION = `
  mutation WebhookSubscriptionCreate(
    $topic: WebhookSubscriptionTopic!
    $webhookSubscription: WebhookSubscriptionInput!
  ) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription { id topic uri }
      userErrors { field message }
    }
  }
`;

export type ShopifyOrderWebhookTopic =
  | 'ORDERS_CANCELLED'
  | 'ORDERS_CREATE'
  | 'ORDERS_FULFILLED'
  | 'ORDERS_PAID'
  | 'ORDERS_UPDATED'
  | 'ORDER_EDITED';

export interface ShopifyAdminConfig {
  readonly storeDomain: string;
  readonly accessToken: string;
  readonly apiVersion?: string;
  readonly fetchImpl?: EcommerceFetch;
  readonly timeoutMs?: number;
}

export interface ShopifyMoneySet {
  readonly shopMoney: {
    readonly amount: string;
    readonly currencyCode: string;
  };
}

export interface ShopifyAdminLineItem {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly sku: string | null;
  readonly product: { readonly id: string } | null;
  readonly variant: { readonly id: string } | null;
  readonly originalUnitPriceSet: ShopifyMoneySet;
  readonly discountedTotalSet: ShopifyMoneySet;
  readonly totalDiscountSet: ShopifyMoneySet;
  readonly taxLines: readonly { readonly priceSet: ShopifyMoneySet }[];
}

export interface ShopifyAdminAddress {
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly company: string | null;
  readonly address1: string | null;
  readonly address2: string | null;
  readonly city: string | null;
  readonly province: string | null;
  readonly zip: string | null;
  readonly countryCode: string | null;
  readonly phone: string | null;
}

export interface ShopifyAdminOrder {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly currencyCode: string;
  readonly displayFinancialStatus: string | null;
  readonly displayFulfillmentStatus: string | null;
  readonly currentSubtotalPriceSet: ShopifyMoneySet;
  readonly currentTotalDiscountsSet: ShopifyMoneySet;
  readonly currentShippingPriceSet: ShopifyMoneySet;
  readonly currentTotalTaxSet: ShopifyMoneySet;
  readonly currentTotalPriceSet: ShopifyMoneySet;
  readonly customer: {
    readonly displayName: string | null;
    readonly email: string | null;
    readonly phone: string | null;
  } | null;
  readonly billingAddress: ShopifyAdminAddress | null;
  readonly shippingAddress: ShopifyAdminAddress | null;
  readonly lineItems: {
    readonly nodes: readonly ShopifyAdminLineItem[];
    readonly pageInfo?: { readonly hasNextPage: boolean };
  };
}

interface ShopifyOrdersData {
  readonly orders: {
    readonly edges: readonly { readonly cursor: string; readonly node: ShopifyAdminOrder }[];
    readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
  };
}

interface ShopifyGraphqlError {
  readonly message: string;
}

interface ShopifyGraphqlResponse<T> {
  readonly data?: T;
  readonly errors?: readonly ShopifyGraphqlError[];
}

interface WebhookSubscriptionData {
  readonly webhookSubscriptionCreate: {
    readonly webhookSubscription: {
      readonly id: string;
      readonly topic: ShopifyOrderWebhookTopic;
      readonly uri: string;
    } | null;
    readonly userErrors: readonly {
      readonly field: readonly string[] | null;
      readonly message: string;
    }[];
  };
}

export interface ShopifyWebhookSubscription {
  readonly id: string;
  readonly topic: ShopifyOrderWebhookTopic;
  readonly uri: string;
}

export class ShopifyAdminClient {
  private readonly config: Required<
    Pick<ShopifyAdminConfig, 'accessToken' | 'apiVersion' | 'timeoutMs'>
  > & {
    readonly origin: string;
    readonly fetchImpl?: EcommerceFetch;
  };

  constructor(config: ShopifyAdminConfig) {
    const storeDomain = config.storeDomain.includes('://')
      ? config.storeDomain
      : `https://${config.storeDomain}`;
    const origin = requireHttpsUrl(storeDomain, 'shopify').origin;
    if (!config.accessToken) throw invalidConfiguration('shopify');
    this.config = {
      accessToken: config.accessToken,
      apiVersion: config.apiVersion ?? DEFAULT_SHOPIFY_API_VERSION,
      timeoutMs: config.timeoutMs ?? 15_000,
      origin,
      fetchImpl: config.fetchImpl,
    };
  }

  async query<T>(query: string, variables: Readonly<Record<string, unknown>>): Promise<T> {
    const response: ProviderHttpResponse<ShopifyGraphqlResponse<T>> = await requestJson({
      provider: 'shopify',
      url: `${this.config.origin}/admin/api/${this.config.apiVersion}/graphql.json`,
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': this.config.accessToken },
      body: { query, variables },
      fetchImpl: this.config.fetchImpl,
      timeoutMs: this.config.timeoutMs,
    });
    if (response.data.errors && response.data.errors.length > 0) {
      throw new EcommerceProviderError('shopify', 'provider_rejected', response.status, false);
    }
    if (!response.data.data) throw invalidResponse('shopify', response.status);
    return response.data.data;
  }

  async fetchOrders(
    options: OrderSyncOptions = {}
  ): Promise<EcommercePage<NormalizedEcommerceOrder>> {
    const first = options.pageSize ?? 100;
    if (!Number.isInteger(first) || first < 1 || first > 250) throw invalidConfiguration('shopify');
    const query = options.updatedAfter
      ? `updated_at:>=${validateDate(options.updatedAfter)}`
      : null;
    const data = await this.query<ShopifyOrdersData>(SHOPIFY_ORDERS_QUERY, {
      first,
      after: options.cursor ?? null,
      query,
    });
    if (
      !data ||
      !data.orders ||
      !Array.isArray(data.orders.edges) ||
      !data.orders.pageInfo ||
      typeof data.orders.pageInfo.hasNextPage !== 'boolean'
    ) {
      throw invalidResponse('shopify');
    }
    try {
      if (data.orders.edges.some((edge) => edge.node.lineItems.pageInfo?.hasNextPage === true)) {
        throw invalidResponse('shopify');
      }
      return {
        items: data.orders.edges.map((edge) => normalizeShopifyOrder(edge.node)),
        nextCursor: data.orders.pageInfo.endCursor,
        hasNextPage: data.orders.pageInfo.hasNextPage,
        totalItems: null,
        totalPages: null,
      };
    } catch (error) {
      if (error instanceof EcommerceProviderError) throw error;
      throw invalidResponse('shopify');
    }
  }

  async createOrderWebhookSubscription(
    topic: ShopifyOrderWebhookTopic,
    uri: string
  ): Promise<ShopifyWebhookSubscription> {
    const webhookUri = requireHttpsUrl(uri, 'shopify').toString();
    const data = await this.query<WebhookSubscriptionData>(SHOPIFY_WEBHOOK_SUBSCRIPTION_MUTATION, {
      topic,
      webhookSubscription: { uri: webhookUri },
    });
    const result = data.webhookSubscriptionCreate;
    if (
      !result ||
      !Array.isArray(result.userErrors) ||
      result.userErrors.length > 0 ||
      !result.webhookSubscription
    ) {
      throw new EcommerceProviderError('shopify', 'provider_rejected', null, false);
    }
    return result.webhookSubscription;
  }
}

function validateDate(value: string): string {
  if (!Number.isFinite(Date.parse(value))) throw invalidConfiguration('shopify');
  return value;
}

export { normalizeShopifyOrder } from './normalize';

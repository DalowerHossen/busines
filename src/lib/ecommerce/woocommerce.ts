import 'server-only';

import { EcommerceProviderError, invalidConfiguration, invalidResponse } from './errors';
import { basicAuthHeader, requestJson, requireHttpsUrl } from './http';
import { normalizeWooCommerceOrder } from './normalize';
import type {
  EcommerceFetch,
  EcommercePage,
  NormalizedEcommerceOrder,
  OrderSyncOptions,
  ProviderHttpResponse,
} from './types';

const DEFAULT_WOOCOMMERCE_API_VERSION = 'v3';

export interface WooCommerceConfig {
  readonly storeUrl: string;
  readonly consumerKey: string;
  readonly consumerSecret: string;
  readonly apiVersion?: string;
  readonly fetchImpl?: EcommerceFetch;
  readonly timeoutMs?: number;
}

export interface WooCommerceAddress {
  readonly first_name: string;
  readonly last_name: string;
  readonly company: string;
  readonly address_1: string;
  readonly address_2: string;
  readonly city: string;
  readonly state: string;
  readonly postcode: string;
  readonly country: string;
  readonly email: string;
  readonly phone: string;
}

export interface WooCommerceLineItem {
  readonly id: number;
  readonly name: string;
  readonly product_id: number;
  readonly variation_id: number;
  readonly quantity: number;
  readonly tax_class: string;
  readonly subtotal: string;
  readonly subtotal_tax: string;
  readonly total: string;
  readonly total_tax: string;
  readonly sku: string | null;
  readonly price: string;
}

export interface WooCommerceOrder {
  readonly id: number;
  readonly number: string;
  readonly status: string;
  readonly currency: string;
  readonly date_created: string;
  readonly date_modified: string;
  readonly total: string;
  readonly subtotal: string;
  readonly total_tax: string;
  readonly total_shipping: string;
  readonly total_discount: string;
  readonly billing: WooCommerceAddress;
  readonly shipping: WooCommerceAddress;
  readonly line_items: readonly WooCommerceLineItem[];
  readonly payment_url?: string;
}

export interface WooCommerceHostedOrderInput {
  readonly currencyCode: string;
  readonly lineItems: readonly {
    readonly productId: string;
    readonly variationId?: string;
    readonly quantity: number;
  }[];
  readonly customerEmail?: string;
}

export interface WooCommerceHostedCheckout {
  readonly providerSessionId: string;
  readonly checkoutUrl: string;
}

export class WooCommerceClient {
  private readonly config: {
    readonly origin: string;
    readonly consumerKey: string;
    readonly consumerSecret: string;
    readonly apiVersion: string;
    readonly fetchImpl?: EcommerceFetch;
    readonly timeoutMs: number;
  };

  constructor(config: WooCommerceConfig) {
    const origin = requireHttpsUrl(config.storeUrl, 'woocommerce').origin;
    if (!config.consumerKey || !config.consumerSecret) throw invalidConfiguration('woocommerce');
    this.config = {
      origin,
      consumerKey: config.consumerKey,
      consumerSecret: config.consumerSecret,
      apiVersion: normalizeApiVersion(config.apiVersion ?? DEFAULT_WOOCOMMERCE_API_VERSION),
      fetchImpl: config.fetchImpl,
      timeoutMs: config.timeoutMs ?? 15_000,
    };
  }

  async fetchOrders(
    options: OrderSyncOptions = {}
  ): Promise<EcommercePage<NormalizedEcommerceOrder>> {
    const page = parsePage(options.cursor);
    const perPage = options.pageSize ?? 100;
    if (!Number.isInteger(perPage) || perPage < 1 || perPage > 100) {
      throw invalidConfiguration('woocommerce');
    }
    const response = await this.request<WooCommerceOrder[]>('GET', 'orders', {
      page,
      per_page: perPage,
      orderby: 'modified',
      order: 'asc',
      modified_after: options.updatedAfter,
    });
    if (!Array.isArray(response.data)) throw invalidResponse('woocommerce', response.status);
    const totalItems = parseHeaderInteger(response.headers['x-wp-total']);
    const totalPages = parseHeaderInteger(response.headers['x-wp-totalpages']);
    const hasNextPage = totalPages !== null ? page < totalPages : response.data.length === perPage;
    try {
      return {
        items: response.data.map((order) => normalizeWooCommerceOrder(order)),
        nextCursor: hasNextPage ? String(page + 1) : null,
        hasNextPage,
        totalItems,
        totalPages,
      };
    } catch (error) {
      if (error instanceof EcommerceProviderError) throw error;
      throw invalidResponse('woocommerce', response.status);
    }
  }

  async createHostedCheckout(
    input: WooCommerceHostedOrderInput
  ): Promise<WooCommerceHostedCheckout> {
    validateHostedOrderInput(input);
    const lineItems = input.lineItems.map((lineItem) => ({
      product_id: parseProviderInteger(lineItem.productId),
      ...(lineItem.variationId === undefined
        ? {}
        : { variation_id: parseProviderInteger(lineItem.variationId) }),
      quantity: lineItem.quantity,
    }));
    const response = await this.request<WooCommerceOrder>('POST', 'orders', {
      status: 'pending',
      currency: input.currencyCode,
      set_paid: false,
      ...(input.customerEmail ? { billing: { email: input.customerEmail } } : {}),
      line_items: lineItems,
    });
    if (!response.data || !Number.isSafeInteger(response.data.id) || response.data.id < 1) {
      throw invalidResponse('woocommerce', response.status);
    }
    const paymentUrl = response.data.payment_url;
    if (!paymentUrl || !isHttpsUrl(paymentUrl))
      throw invalidResponse('woocommerce', response.status);
    return {
      providerSessionId: String(response.data.id),
      checkoutUrl: paymentUrl,
    };
  }

  private async request<T>(
    method: 'GET' | 'POST',
    resource: 'orders',
    options: Readonly<Record<string, unknown>>
  ): Promise<ProviderHttpResponse<T>> {
    const body: Record<string, unknown> = {};
    const query: Record<string, string | number | boolean | undefined> = {};
    for (const [key, value] of Object.entries(options)) {
      if (value === undefined) continue;
      if (method === 'GET') {
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
          throw invalidConfiguration('woocommerce');
        }
        query[key] = value;
      } else body[key] = value;
    }
    return requestJson<T>({
      provider: 'woocommerce',
      url: `${this.config.origin}/wp-json/wc/${this.config.apiVersion}/${resource}`,
      method,
      headers: {
        Authorization: basicAuthHeader(
          this.config.consumerKey,
          this.config.consumerSecret,
          'woocommerce'
        ),
      },
      query,
      body: method === 'POST' ? body : undefined,
      fetchImpl: this.config.fetchImpl,
      timeoutMs: this.config.timeoutMs,
    });
  }
}

function normalizeApiVersion(value: string): string {
  const normalized = value.replace(/^wc\//, '').trim();
  if (!/^v[0-9]+$/.test(normalized)) throw invalidConfiguration('woocommerce');
  return normalized;
}

function parsePage(cursor: string | null | undefined): number {
  if (cursor === null || cursor === undefined) return 1;
  const page = Number(cursor);
  if (!Number.isInteger(page) || page < 1) throw invalidConfiguration('woocommerce');
  return page;
}

function parseHeaderInteger(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseProviderInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw invalidConfiguration('woocommerce');
  return parsed;
}

function validateHostedOrderInput(input: WooCommerceHostedOrderInput): void {
  if (!/^[A-Z]{3}$/.test(input.currencyCode) || input.lineItems.length === 0) {
    throw invalidConfiguration('woocommerce');
  }
  for (const lineItem of input.lineItems) {
    if (!Number.isSafeInteger(lineItem.quantity) || lineItem.quantity < 1) {
      throw invalidConfiguration('woocommerce');
    }
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export { normalizeWooCommerceOrder } from './normalize';

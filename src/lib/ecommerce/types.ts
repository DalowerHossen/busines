export type EcommercePlatform = 'shopify' | 'woocommerce';

export type EcommerceFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface EcommerceAddress {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly company?: string;
  readonly address1?: string;
  readonly address2?: string;
  readonly city?: string;
  readonly state?: string;
  readonly postalCode?: string;
  readonly countryCode?: string;
  readonly email?: string;
  readonly phone?: string;
}

export interface EcommerceMoney {
  readonly amount: string;
  readonly currencyCode: string;
}

export interface EcommerceOrderLineItem {
  readonly externalLineId: string;
  readonly externalProductId: string | null;
  readonly externalVariantId: string | null;
  readonly sku: string | null;
  readonly description: string;
  readonly quantity: string;
  readonly unitPriceAmount: string;
  readonly discountAmount: string;
  readonly taxAmount: string;
  readonly lineTotalAmount: string;
}

export interface NormalizedEcommerceOrder {
  readonly platform: EcommercePlatform;
  readonly externalOrderId: string;
  readonly externalOrderNumber: string | null;
  readonly status: 'pending' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded' | 'failed';
  readonly externalFinancialStatus: string | null;
  readonly externalFulfillmentStatus: string | null;
  readonly customerName: string | null;
  readonly customerEmail: string | null;
  readonly customerPhone: string | null;
  readonly billingAddress: EcommerceAddress | null;
  readonly shippingAddress: EcommerceAddress | null;
  readonly currencyCode: string;
  readonly subtotalAmount: string;
  readonly discountAmount: string;
  readonly shippingAmount: string;
  readonly taxAmount: string;
  readonly totalAmount: string;
  readonly externalCreatedAt: string | null;
  readonly externalUpdatedAt: string | null;
  readonly lineItems: readonly EcommerceOrderLineItem[];
  readonly rawPayload: Readonly<Record<string, unknown>>;
}

export interface EcommercePage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasNextPage: boolean;
  readonly totalItems: number | null;
  readonly totalPages: number | null;
}

export interface OrderSyncOptions {
  readonly pageSize?: number;
  readonly cursor?: string | null;
  readonly updatedAfter?: string;
}

export interface ProviderHttpResponse<T> {
  readonly data: T;
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
}

export interface EcommerceWebhookRequest {
  readonly rawBody: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
}

export interface EcommerceWebhookEvent {
  readonly platform: EcommercePlatform;
  readonly connectionId: string;
  readonly providerEventId: string;
  readonly topic: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export type CheckoutLineItem =
  | {
      readonly providerProductId: string;
      readonly providerVariantId?: string;
      readonly quantity: number;
    }
  | {
      readonly merchandiseId: string;
      readonly quantity: number;
    };

export interface CheckoutCustomer {
  readonly email?: string;
}

export interface HostedCheckoutSession {
  readonly provider: EcommercePlatform;
  readonly providerSessionId: string;
  readonly checkoutUrl: string;
}

export interface CheckoutSessionInput {
  readonly idempotencyKey: string;
  readonly currencyCode: string;
  readonly lineItems: readonly CheckoutLineItem[];
  readonly customer?: CheckoutCustomer;
}

export interface DirectCheckoutRequest {
  readonly publishableKey: string;
  readonly idempotencyKey: string;
  readonly currencyCode: string;
  readonly amount: string;
  readonly lineItems: readonly {
    readonly externalProductId: string;
    readonly externalVariantId?: string;
    readonly name: string;
    readonly quantity: string;
    readonly unitAmount: string;
  }[];
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly customerEmail?: string;
}

export interface DirectCheckoutKeyRecord {
  readonly companyId: string;
  readonly apiKeyPairId: string;
  readonly publishableKeyHash: string;
  readonly secretKeyHash: string;
  readonly allowedOrigins: readonly string[];
  readonly expiresAt: string | null;
  readonly status: 'active' | 'revoked' | 'expired';
}

export interface DirectCheckoutSessionContract {
  readonly companyId: string;
  readonly apiKeyPairId: string;
  readonly idempotencyKey: string;
  readonly currencyCode: string;
  readonly amount: string;
  readonly lineItems: DirectCheckoutRequest['lineItems'];
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly customerEmail: string | null;
}

export interface SignedCheckoutCallback {
  readonly eventId: string;
  readonly eventType: 'checkout.completed' | 'checkout.failed' | 'checkout.expired';
  readonly sessionId: string;
  readonly status: 'paid' | 'failed' | 'expired';
  readonly occurredAt: string;
}

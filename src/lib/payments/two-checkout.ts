// src/lib/payments/two-checkout.ts
// Verifone 2Checkout REST API v6: digest-authenticated orders, REST order
// refunds, and IPN/INS HMAC verification. 2Checkout's REST API has no
// generic idempotency header; the supplied idempotency key is persisted as
// ExternalReference and callers must enforce a unique local request record
// before retrying an order.
import 'server-only';
import { createHmac } from 'node:crypto';
import {
  PaymentProviderError,
  jsonHeaders,
  requestJson,
  requireSecret,
  requiredString,
  stringValue,
} from './http';
import { constantTimeEqual } from './crypto';
import { mapPaymentStatus, mapRefundStatus } from './status';
import type {
  CapturePaymentRequest,
  CreatePaymentRequest,
  GatewayAdapterOptions,
  PaymentGatewayAdapter,
  ProviderPaymentReference,
  ProviderRefundReference,
  RefundPaymentRequest,
  VerifiedWebhookEvent,
  WebhookVerificationRequest,
} from './types';

const PROVIDER = 'two_checkout';
const DEFAULT_BASE_URL = 'https://api.2checkout.com/rest/6.0';
type TwoCheckoutResponse = Record<string, unknown>;

export class TwoCheckoutAdapter implements PaymentGatewayAdapter {
  readonly gateway = 'two_checkout' as const;
  private readonly baseUrl: string;
  private readonly merchantCode: string;
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor(
    merchantCode: string | undefined,
    secretKey: string | undefined,
    webhookSecret: string | undefined,
    options: GatewayAdapterOptions = {}
  ) {
    this.merchantCode = requireSecret(merchantCode, PROVIDER);
    this.secretKey = requireSecret(secretKey, PROVIDER);
    this.webhookSecret = requireSecret(webhookSecret, PROVIDER);
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  }

  async createPayment(request: CreatePaymentRequest): Promise<ProviderPaymentReference> {
    const items = (request.lineItems ?? []).map((item) => {
      if (!item.providerProductCode) throw new PaymentProviderError(PROVIDER, null, false);
      return { Code: item.providerProductCode, Quantity: String(item.quantity) };
    });
    if (items.length === 0 || !request.paymentMethodToken)
      throw new PaymentProviderError(PROVIDER, null, false);

    const body: Record<string, unknown> = {
      Currency: request.currency.toUpperCase(),
      ExternalReference: request.idempotencyKey,
      Items: items,
      PaymentDetails: {
        Currency: request.currency.toUpperCase(),
        Type: 'EES_TOKEN_PAYMENT',
        PaymentMethod: { EesToken: request.paymentMethodToken },
      },
    };
    if (request.customerEmail) {
      body.BillingDetails = { Email: request.customerEmail };
    }
    const response = await this.request<TwoCheckoutResponse>('/orders/', 'POST', body);
    const id = requiredString(
      response.RefNo ?? response.OrderReference ?? response.Refno,
      PROVIDER
    );
    const providerStatus = stringValue(response.Status ?? response.OrderStatus) ?? 'PENDING';
    return {
      providerTransactionId: id,
      providerStatus,
      status: mapPaymentStatus(providerStatus),
      checkoutUrl: null,
      requiresCustomerAction: false,
      raw: response,
    };
  }

  async capturePayment(request: CapturePaymentRequest): Promise<ProviderPaymentReference> {
    const response = await this.request<TwoCheckoutResponse>(
      `/orders/${encodeURIComponent(request.providerTransactionId)}/`,
      'GET'
    );
    const id = requiredString(
      response.RefNo ?? response.OrderReference ?? request.providerTransactionId,
      PROVIDER
    );
    const providerStatus = stringValue(response.Status ?? response.OrderStatus) ?? 'PENDING';
    return {
      providerTransactionId: id,
      providerStatus,
      status: mapPaymentStatus(providerStatus),
      checkoutUrl: null,
      requiresCustomerAction: false,
      raw: response,
    };
  }

  async getSubscription(subscriptionReference: string): Promise<TwoCheckoutResponse> {
    return this.request<TwoCheckoutResponse>(
      `/subscriptions/${encodeURIComponent(subscriptionReference)}/`,
      'GET'
    );
  }

  async disableSubscription(subscriptionReference: string): Promise<TwoCheckoutResponse> {
    return this.request<TwoCheckoutResponse>(
      `/subscriptions/${encodeURIComponent(subscriptionReference)}/`,
      'DELETE'
    );
  }

  async refundPayment(request: RefundPaymentRequest): Promise<ProviderRefundReference> {
    if (request.amountMinor === undefined) throw new PaymentProviderError(PROVIDER, null, false);
    const body = {
      Amount: request.amountMinor / 100,
      Comment: request.reason ?? 'Customer requested refund',
      Reason: request.reason ?? 'Customer requested refund',
      Items: [],
    };
    const response = await this.request<TwoCheckoutResponse>(
      `/orders/${encodeURIComponent(request.providerTransactionId)}/refund/`,
      'POST',
      body
    );
    const id =
      stringValue(response.RefNo ?? response.RefundReference ?? response.OrderReference) ??
      request.providerTransactionId;
    const providerStatus = stringValue(response.Status ?? response.OrderStatus) ?? 'COMPLETE';
    return {
      providerRefundId: id,
      providerStatus,
      status: mapRefundStatus(providerStatus),
      raw: response,
    };
  }

  async verifyWebhook(request: WebhookVerificationRequest): Promise<VerifiedWebhookEvent> {
    const fields = new URLSearchParams(request.rawBody);
    const receivedHash = fields.get('HASH');
    const serialised = Array.from(fields.entries())
      .filter(([key]) => key !== 'HASH')
      .map(([, value]) => `${Buffer.byteLength(value, 'utf8')}${value}`)
      .join('');
    const sha256 = createHmac('sha256', this.webhookSecret)
      .update(serialised, 'utf8')
      .digest('hex');
    const sha3 = createHmac('sha3-256', this.webhookSecret)
      .update(serialised, 'utf8')
      .digest('hex');
    if (
      !receivedHash ||
      (!constantTimeEqual(receivedHash, sha256) && !constantTimeEqual(receivedHash, sha3))
    ) {
      throw new PaymentProviderError(PROVIDER, 400, false);
    }

    const payload: Record<string, unknown> = Object.fromEntries(fields.entries());
    const eventType = `notification.${fields.get('IPN_TYPE') ?? fields.get('MESSAGE_TYPE') ?? 'order'}`;
    const providerStatus = fields.get('ORDERSTATUS') ?? fields.get('STATUS') ?? eventType;
    return {
      providerEventId:
        fields.get('REFNO') ?? fields.get('ORDERREF') ?? fields.get('ORDERNO') ?? 'unknown',
      eventType,
      providerStatus,
      status: mapPaymentStatus(providerStatus),
      occurredAt: fields.get('DATE') ?? fields.get('ORDERDATE'),
      payload,
    };
  }

  private async request<T extends TwoCheckoutResponse>(
    path: string,
    method: 'GET' | 'POST' | 'DELETE',
    body?: Readonly<Record<string, unknown>>
  ): Promise<T> {
    const date = toTwoCheckoutDate(new Date());
    const digest = `${Buffer.byteLength(this.merchantCode, 'utf8')}${this.merchantCode}${Buffer.byteLength(date, 'utf8')}${date}`;
    const hash = createHmac('sha256', this.secretKey).update(digest, 'utf8').digest('hex');
    return requestJson<T>({
      provider: PROVIDER,
      url: `${this.baseUrl}${path}`,
      method,
      headers: jsonHeaders({
        'X-Avangate-Authentication': `code="${this.merchantCode}" date="${date}" hash="${hash}" algo="sha256"`,
      }),
      body,
    });
  }
}

function toTwoCheckoutDate(date: Date): string {
  const iso = date.toISOString();
  return iso.slice(0, 10) + ' ' + iso.slice(11, 19);
}

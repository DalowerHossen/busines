// src/lib/payments/paypal.ts
// PayPal OAuth 2.0, Orders v2 create/capture, capture refunds, request
// idempotency, and PayPal's signed webhook verification endpoint.
import 'server-only';
import {
  PaymentProviderError,
  asRecord,
  jsonHeaders,
  requestForm,
  requestJson,
  requireSecret,
  requiredString,
  stringValue,
} from './http';
import { headerValue, parseJsonBody } from './crypto';
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

const PROVIDER = 'paypal';
const DEFAULT_BASE_URL = 'https://api-m.sandbox.paypal.com';
type PayPalResponse = Record<string, unknown>;

export class PayPalAdapter implements PaymentGatewayAdapter {
  readonly gateway = 'paypal' as const;
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webhookId: string;

  constructor(
    clientId: string | undefined,
    clientSecret: string | undefined,
    webhookId: string | undefined,
    options: GatewayAdapterOptions = {}
  ) {
    this.clientId = requireSecret(clientId, PROVIDER);
    this.clientSecret = requireSecret(clientSecret, PROVIDER);
    this.webhookId = requireSecret(webhookId, PROVIDER);
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  }

  async createPayment(request: CreatePaymentRequest): Promise<ProviderPaymentReference> {
    const purchaseUnit: Record<string, unknown> = {
      reference_id: request.reference ?? request.idempotencyKey,
      amount: {
        currency_code: request.currency.toUpperCase(),
        value: minorToDecimal(request.amountMinor, request.currency),
      },
    };
    const body: Record<string, unknown> = {
      intent: 'CAPTURE',
      purchase_units: [purchaseUnit],
    };
    if (request.returnUrl || request.cancelUrl) {
      body.application_context = {
        return_url: request.returnUrl,
        cancel_url: request.cancelUrl,
      };
    }

    const response = await this.request<PayPalResponse>(
      '/v2/checkout/orders',
      'POST',
      body,
      request.idempotencyKey
    );
    const id = requiredString(response.id, PROVIDER);
    const providerStatus = stringValue(response.status) ?? 'CREATED';
    const links = Array.isArray(response.links) ? response.links : [];
    const approveLink = links.map((link) => asRecord(link)).find((link) => link.rel === 'approve');
    return {
      providerTransactionId: id,
      providerStatus,
      status: mapPaymentStatus(providerStatus),
      checkoutUrl: stringValue(approveLink?.href),
      requiresCustomerAction: providerStatus === 'CREATED',
      raw: response,
    };
  }

  async capturePayment(request: CapturePaymentRequest): Promise<ProviderPaymentReference> {
    const response = await this.request<PayPalResponse>(
      `/v2/checkout/orders/${encodeURIComponent(request.providerTransactionId)}/capture`,
      'POST',
      {},
      request.idempotencyKey
    );
    const id = requiredString(response.id, PROVIDER);
    const providerStatus = stringValue(response.status) ?? 'COMPLETED';
    return {
      providerTransactionId: id,
      providerStatus,
      status: mapPaymentStatus(providerStatus),
      checkoutUrl: null,
      requiresCustomerAction: false,
      raw: response,
    };
  }

  async refundPayment(request: RefundPaymentRequest): Promise<ProviderRefundReference> {
    const body: Record<string, unknown> = {};
    if (request.amountMinor !== undefined) {
      body.amount = {
        currency_code: request.currency.toUpperCase(),
        value: minorToDecimal(request.amountMinor, request.currency),
      };
    }
    if (request.reason) body.note_to_payer = request.reason;
    const response = await this.request<PayPalResponse>(
      `/v2/payments/captures/${encodeURIComponent(request.providerTransactionId)}/refund`,
      'POST',
      body,
      request.idempotencyKey
    );
    const id = requiredString(response.id, PROVIDER);
    const providerStatus = stringValue(response.status) ?? 'COMPLETED';
    return {
      providerRefundId: id,
      providerStatus,
      status: mapRefundStatus(providerStatus),
      raw: response,
    };
  }

  async verifyWebhook(request: WebhookVerificationRequest): Promise<VerifiedWebhookEvent> {
    const accessToken = await this.accessToken();
    const payload = parseJsonBody(request.rawBody, PROVIDER);
    const verificationBody = {
      auth_algo: requiredHeader(request, 'paypal-auth-algo'),
      cert_url: requiredHeader(request, 'paypal-cert-url'),
      transmission_id: requiredHeader(request, 'paypal-transmission-id'),
      transmission_sig: requiredHeader(request, 'paypal-transmission-sig'),
      transmission_time: requiredHeader(request, 'paypal-transmission-time'),
      webhook_id: this.webhookId,
      webhook_event: payload,
    };
    const response = await requestJson<PayPalResponse>({
      provider: PROVIDER,
      url: `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
      method: 'POST',
      headers: jsonHeaders({ Authorization: `Bearer ${accessToken}` }),
      body: verificationBody,
    });
    if (response.verification_status !== 'SUCCESS') {
      throw new PaymentProviderError(PROVIDER, 400, false);
    }

    const eventType = requiredString(payload.event_type, PROVIDER);
    const resource = asRecord(payload.resource);
    const providerStatus = stringValue(resource.status) ?? eventType;
    return {
      providerEventId: requiredString(payload.id, PROVIDER),
      eventType,
      providerStatus,
      status: mapPaymentStatus(providerStatus),
      occurredAt: stringValue(payload.create_time),
      payload,
    };
  }

  private async accessToken(): Promise<string> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await requestForm<PayPalResponse>({
      provider: PROVIDER,
      url: `${this.baseUrl}/v1/oauth2/token`,
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });
    return requiredString(response.access_token, PROVIDER);
  }

  private async request<T extends PayPalResponse>(
    path: string,
    method: 'POST',
    body: Readonly<Record<string, unknown>>,
    requestId: string
  ): Promise<T> {
    const token = await this.accessToken();
    return requestJson<T>({
      provider: PROVIDER,
      url: `${this.baseUrl}${path}`,
      method,
      headers: jsonHeaders({
        Authorization: `Bearer ${token}`,
        'PayPal-Request-Id': requestId,
        Prefer: 'return=representation',
      }),
      body,
    });
  }
}

function requiredHeader(request: WebhookVerificationRequest, name: string): string {
  const value = headerValue(request.headers, name);
  if (!value) throw new PaymentProviderError(PROVIDER, 400, false);
  return value;
}

function minorToDecimal(amountMinor: number, currency: string): string {
  const zeroDecimalCurrencies = new Set([
    'BIF',
    'CLP',
    'DJF',
    'GNF',
    'JPY',
    'KMF',
    'KRW',
    'MGA',
    'PYG',
    'RWF',
    'UGX',
    'VND',
    'VUV',
    'XAF',
    'XOF',
    'XPF',
  ]);
  if (zeroDecimalCurrencies.has(currency.toUpperCase())) return String(amountMinor);
  return (amountMinor / 100).toFixed(2);
}

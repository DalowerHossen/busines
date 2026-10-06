// src/lib/payments/paddle.ts
// Paddle Billing transactions, cancellation, adjustments, and raw-body
// webhook verification. Paddle delivers webhooks at least once, so callers
// must persist providerEventId (event_id) before applying a state change and
// compare occurredAt before accepting an older event.
import 'server-only';
import {
  PaymentProviderError,
  asRecord,
  jsonHeaders,
  requestJson,
  requireSecret,
  requiredString,
  stringValue,
} from './http';
import { constantTimeEqual, hmacHex, headerValue, parseJsonBody } from './crypto';
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

const PROVIDER = 'paddle';
const DEFAULT_BASE_URL = 'https://api.paddle.com';
const WEBHOOK_TOLERANCE_SECONDS = 300;
type PaddleResponse = Record<string, unknown>;

export interface PaddleSubscriptionCancellationRequest {
  readonly subscriptionId: string;
  readonly effectiveFrom?: 'next_billing_period' | 'immediately';
  readonly idempotencyKey: string;
}

export class PaddleAdapter implements PaymentGatewayAdapter {
  readonly gateway = 'paddle' as const;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly webhookSecret: string;

  constructor(
    apiKey: string | undefined,
    webhookSecret: string | undefined,
    options: GatewayAdapterOptions = {}
  ) {
    this.apiKey = requireSecret(apiKey, PROVIDER);
    this.webhookSecret = requireSecret(webhookSecret, PROVIDER);
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  }

  async createPayment(request: CreatePaymentRequest): Promise<ProviderPaymentReference> {
    const items = (request.lineItems ?? []).map((item) => {
      if (!item.providerPriceId) throw new PaymentProviderError(PROVIDER, null, false);
      return { price_id: item.providerPriceId, quantity: item.quantity };
    });
    if (items.length === 0) throw new PaymentProviderError(PROVIDER, null, false);

    const body: Record<string, unknown> = {
      items,
      collection_mode: 'automatic',
      currency_code: request.currency.toUpperCase(),
      custom_data: {
        ...request.metadata,
        platform_reference: request.reference ?? request.idempotencyKey,
      },
    };
    if (request.returnUrl) body.checkout = { url: request.returnUrl };
    const response = await this.request<PaddleResponse>(
      '/transactions',
      'POST',
      body,
      request.idempotencyKey
    );
    return this.transactionReference(response);
  }

  async capturePayment(request: CapturePaymentRequest): Promise<ProviderPaymentReference> {
    const response = await this.request<PaddleResponse>(
      `/transactions/${encodeURIComponent(request.providerTransactionId)}`,
      'GET'
    );
    return this.transactionReference(response);
  }

  async refundPayment(request: RefundPaymentRequest): Promise<ProviderRefundReference> {
    const body: Record<string, unknown> = {
      transaction_id: request.providerTransactionId,
      reason: request.reason ?? 'Customer requested refund',
      type: request.amountMinor === undefined ? 'full' : 'partial',
    };
    if (request.amountMinor !== undefined) {
      if (!request.providerLineItemId) throw new PaymentProviderError(PROVIDER, null, false);
      body.items = [
        {
          item_id: request.providerLineItemId,
          type: 'partial',
          amount: String(request.amountMinor),
        },
      ];
    }
    const response = await this.request<PaddleResponse>(
      '/adjustments',
      'POST',
      body,
      request.idempotencyKey
    );
    const id = requiredString(response.id, PROVIDER);
    const providerStatus = stringValue(response.status) ?? 'pending_approval';
    return {
      providerRefundId: id,
      providerStatus,
      status: mapRefundStatus(providerStatus),
      raw: response,
    };
  }

  async cancelSubscription(
    request: PaddleSubscriptionCancellationRequest
  ): Promise<PaddleResponse> {
    return this.request<PaddleResponse>(
      `/subscriptions/${encodeURIComponent(request.subscriptionId)}/cancel`,
      'POST',
      request.effectiveFrom ? { effective_from: request.effectiveFrom } : {},
      request.idempotencyKey
    );
  }

  async verifyWebhook(request: WebhookVerificationRequest): Promise<VerifiedWebhookEvent> {
    const signatureHeader = headerValue(request.headers, 'paddle-signature') ?? '';
    const parts = new Map(
      signatureHeader
        .split(';')
        .map((part) => part.split('='))
        .filter(([key, value]) => Boolean(key && value)) as Array<[string, string]>
    );
    const timestamp = Number(parts.get('ts'));
    const provided = parts.get('h1');
    const expected = hmacHex(
      'sha256',
      this.webhookSecret,
      `${parts.get('ts') ?? ''}:${request.rawBody}`
    );
    if (
      !provided ||
      !Number.isFinite(timestamp) ||
      Math.abs(Date.now() / 1000 - timestamp) > WEBHOOK_TOLERANCE_SECONDS ||
      !constantTimeEqual(provided, expected)
    ) {
      throw new PaymentProviderError(PROVIDER, 400, false);
    }

    const payload = parseJsonBody(request.rawBody, PROVIDER);
    const data = asRecord(payload.data);
    const eventType = requiredString(payload.event_type, PROVIDER);
    const providerStatus = stringValue(data.status) ?? eventType;
    return {
      providerEventId: requiredString(payload.event_id, PROVIDER),
      eventType,
      providerStatus,
      status: mapPaymentStatus(providerStatus),
      occurredAt: stringValue(payload.occurred_at),
      payload,
    };
  }

  private async request<T extends PaddleResponse>(
    path: string,
    method: 'GET' | 'POST',
    body?: Readonly<Record<string, unknown>>,
    idempotencyKey?: string
  ): Promise<T> {
    return requestJson<T>({
      provider: PROVIDER,
      url: `${this.baseUrl}${path}`,
      method,
      headers: jsonHeaders({
        Authorization: `Bearer ${this.apiKey}`,
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      }),
      body,
    });
  }

  private transactionReference(response: PaddleResponse): ProviderPaymentReference {
    const data = asRecord(response.data);
    const id = requiredString(data.id ?? response.id, PROVIDER);
    const providerStatus = stringValue(data.status ?? response.status) ?? 'draft';
    const checkout = asRecord(data.checkout);
    return {
      providerTransactionId: id,
      providerStatus,
      status: mapPaymentStatus(providerStatus),
      checkoutUrl: stringValue(checkout.url),
      requiresCustomerAction: providerStatus === 'ready' || providerStatus === 'draft',
      raw: response,
    };
  }
}

export function shouldApplyPaddleEvent(
  existingOccurredAt: string | null,
  incoming: VerifiedWebhookEvent
): boolean {
  if (!existingOccurredAt || !incoming.occurredAt) return true;
  return Date.parse(incoming.occurredAt) >= Date.parse(existingOccurredAt);
}

// src/lib/payments/stripe.ts
// Stripe PaymentIntents, refunds, idempotency, and signed webhooks. The
// caller supplies a Stripe PaymentMethod id produced by Stripe.js; no card
// fields are accepted by this adapter.
import 'server-only';
import {
  PaymentProviderError,
  asRecord,
  jsonHeaders,
  requestForm,
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

const PROVIDER = 'stripe';
const DEFAULT_BASE_URL = 'https://api.stripe.com/v1';
const WEBHOOK_TOLERANCE_SECONDS = 300;

type StripeResponse = Record<string, unknown>;

export class StripeAdapter implements PaymentGatewayAdapter {
  readonly gateway = 'stripe' as const;
  private readonly baseUrl: string;
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor(
    secretKey: string | undefined,
    webhookSecret: string | undefined,
    options: GatewayAdapterOptions = {}
  ) {
    this.secretKey = requireSecret(secretKey, PROVIDER);
    this.webhookSecret = requireSecret(webhookSecret, PROVIDER);
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  }

  async createPayment(request: CreatePaymentRequest): Promise<ProviderPaymentReference> {
    if (!request.paymentMethodToken) throw new PaymentProviderError(PROVIDER, null, false);
    const body = new URLSearchParams({
      amount: String(request.amountMinor),
      currency: request.currency.toLowerCase(),
      confirm: 'true',
      description: request.description ?? request.reference ?? 'Payment',
    });
    if (request.paymentMethodToken) body.set('payment_method', request.paymentMethodToken);
    if (request.customerEmail) body.set('receipt_email', request.customerEmail);
    for (const [key, value] of Object.entries(request.metadata ?? {})) {
      body.set(`metadata[${key}]`, value);
    }

    const response = await requestForm<StripeResponse>({
      provider: PROVIDER,
      url: `${this.baseUrl}/payment_intents`,
      method: 'POST',
      headers: {
        ...jsonHeaders({ Authorization: `Bearer ${this.secretKey}` }),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': request.idempotencyKey,
      },
      body,
    });
    return this.paymentReference(response);
  }

  async capturePayment(request: CapturePaymentRequest): Promise<ProviderPaymentReference> {
    const body = new URLSearchParams();
    if (request.amountMinor !== undefined)
      body.set('amount_to_capture', String(request.amountMinor));
    const response = await requestForm<StripeResponse>({
      provider: PROVIDER,
      url: `${this.baseUrl}/payment_intents/${encodeURIComponent(request.providerTransactionId)}/capture`,
      method: 'POST',
      headers: {
        ...jsonHeaders({ Authorization: `Bearer ${this.secretKey}` }),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': request.idempotencyKey,
      },
      body,
    });
    return this.paymentReference(response);
  }

  async refundPayment(request: RefundPaymentRequest): Promise<ProviderRefundReference> {
    const body = new URLSearchParams({ payment_intent: request.providerTransactionId });
    if (request.amountMinor !== undefined) body.set('amount', String(request.amountMinor));
    if (request.reason) body.set('reason', request.reason);
    const response = await requestForm<StripeResponse>({
      provider: PROVIDER,
      url: `${this.baseUrl}/refunds`,
      method: 'POST',
      headers: {
        ...jsonHeaders({ Authorization: `Bearer ${this.secretKey}` }),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': request.idempotencyKey,
      },
      body,
    });
    const id = requiredString(response.id, PROVIDER);
    const providerStatus = stringValue(response.status) ?? 'pending';
    return {
      providerRefundId: id,
      providerStatus,
      status: mapRefundStatus(providerStatus),
      raw: response,
    };
  }

  async verifyWebhook(request: WebhookVerificationRequest): Promise<VerifiedWebhookEvent> {
    const signature = headerValue(request.headers, 'stripe-signature');
    const parts = new Map(
      (signature ?? '')
        .split(',')
        .map((part) => part.split('='))
        .filter(([key, value]) => Boolean(key && value)) as Array<[string, string]>
    );
    const timestamp = Number(parts.get('t'));
    const signatures = (signature ?? '')
      .split(',')
      .filter((part) => part.startsWith('v1='))
      .map((part) => part.slice(3));
    const expected = hmacHex('sha256', this.webhookSecret, `${timestamp}.${request.rawBody}`);
    const timestampIsFresh =
      Number.isFinite(timestamp) &&
      Math.abs(Date.now() / 1000 - timestamp) <= WEBHOOK_TOLERANCE_SECONDS;
    if (!timestampIsFresh || !signatures.some((value) => constantTimeEqual(value, expected))) {
      throw new PaymentProviderError(PROVIDER, 400, false);
    }

    const payload = parseJsonBody(request.rawBody, PROVIDER);
    const data = asRecord(payload.data);
    const object = asRecord(data.object);
    const eventType = requiredString(payload.type, PROVIDER);
    const providerStatus = stringValue(object.status) ?? eventType;
    return {
      providerEventId: requiredString(payload.id, PROVIDER),
      eventType,
      providerStatus,
      status: mapPaymentStatus(providerStatus),
      occurredAt:
        typeof payload.created === 'number' ? new Date(payload.created * 1000).toISOString() : null,
      payload,
    };
  }

  private paymentReference(response: StripeResponse): ProviderPaymentReference {
    const id = requiredString(response.id, PROVIDER);
    const providerStatus = stringValue(response.status) ?? 'processing';
    const nextAction = asRecord(response.next_action);
    const redirect = asRecord(nextAction.redirect_to_url);
    return {
      providerTransactionId: id,
      providerStatus,
      status: mapPaymentStatus(providerStatus),
      checkoutUrl: stringValue(redirect.url),
      requiresCustomerAction:
        providerStatus === 'requires_action' || providerStatus === 'requires_source_action',
      raw: response,
    };
  }
}

// src/lib/payments/adyen.ts
// Adyen Checkout payments, capture/refund operations, API-key auth,
// Idempotency-Key headers, and standard webhook HMAC verification.
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
import { constantTimeEqual, hmacBase64, parseJsonBody } from './crypto';
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

const PROVIDER = 'adyen_for_platforms';
const DEFAULT_BASE_URL = 'https://checkout-test.adyen.com/v71';
type AdyenResponse = Record<string, unknown>;

export class AdyenAdapter implements PaymentGatewayAdapter {
  readonly gateway = 'adyen_for_platforms' as const;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly merchantAccount: string;
  private readonly hmacKey: Buffer;

  constructor(
    apiKey: string | undefined,
    merchantAccount: string | undefined,
    hmacKey: string | undefined,
    options: GatewayAdapterOptions = {}
  ) {
    this.apiKey = requireSecret(apiKey, PROVIDER);
    this.merchantAccount = requireSecret(merchantAccount, PROVIDER);
    const encodedHmacKey = requireSecret(hmacKey, PROVIDER);
    this.hmacKey = Buffer.from(encodedHmacKey, 'hex');
    if (this.hmacKey.length === 0) throw new PaymentProviderError(PROVIDER, null, false);
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  }

  async createPayment(request: CreatePaymentRequest): Promise<ProviderPaymentReference> {
    if (!request.paymentMethodToken) throw new PaymentProviderError(PROVIDER, null, false);
    const body: Record<string, unknown> = {
      amount: { currency: request.currency.toUpperCase(), value: request.amountMinor },
      merchantAccount: this.merchantAccount,
      reference: request.reference ?? request.idempotencyKey,
      paymentMethod: { type: 'scheme', storedPaymentMethodId: request.paymentMethodToken },
    };
    if (request.returnUrl) body.returnUrl = request.returnUrl;
    if (request.customerEmail) body.shopperEmail = request.customerEmail;
    if (request.shopperReference) {
      body.shopperReference = request.shopperReference;
      body.recurringProcessingModel = 'CardOnFile';
    }
    if (request.metadata) body.metadata = request.metadata;
    const response = await this.request<AdyenResponse>(
      '/payments',
      'POST',
      body,
      request.idempotencyKey
    );
    return this.paymentReference(response);
  }

  async capturePayment(request: CapturePaymentRequest): Promise<ProviderPaymentReference> {
    const body: Record<string, unknown> = { reference: request.providerTransactionId };
    if (request.amountMinor !== undefined) {
      if (!request.currency) throw new PaymentProviderError(PROVIDER, null, false);
      body.amount = { value: request.amountMinor, currency: request.currency.toUpperCase() };
    }
    const response = await this.request<AdyenResponse>(
      `/payments/${encodeURIComponent(request.providerTransactionId)}/captures`,
      'POST',
      body,
      request.idempotencyKey
    );
    return this.paymentReference(response);
  }

  async refundPayment(request: RefundPaymentRequest): Promise<ProviderRefundReference> {
    if (request.amountMinor === undefined) throw new PaymentProviderError(PROVIDER, null, false);
    const body: Record<string, unknown> = {
      reference: request.providerTransactionId,
      amount: {
        currency: request.currency.toUpperCase(),
        value: request.amountMinor,
      },
    };
    const response = await this.request<AdyenResponse>(
      `/payments/${encodeURIComponent(request.providerTransactionId)}/refunds`,
      'POST',
      body,
      request.idempotencyKey
    );
    const id = requiredString(response.pspReference ?? response.id, PROVIDER);
    const providerStatus = stringValue(response.status) ?? 'received';
    return {
      providerRefundId: id,
      providerStatus,
      status: mapRefundStatus(providerStatus),
      raw: response,
    };
  }

  async verifyWebhook(request: WebhookVerificationRequest): Promise<VerifiedWebhookEvent> {
    const payload = parseJsonBody(request.rawBody, PROVIDER);
    const notificationItems = Array.isArray(payload.notificationItems)
      ? payload.notificationItems
      : [];
    const firstItem = asRecord(notificationItems[0]);
    const item = asRecord(firstItem.NotificationRequestItem);
    const additionalData = asRecord(item.additionalData);
    const provided = stringValue(additionalData.hmacSignature);
    const signed = [
      item.pspReference,
      item.originalReference,
      item.merchantAccountCode,
      item.merchantReference,
      asRecord(item.amount).value,
      item.eventCode,
      item.success,
    ]
      .map((value) => String(value ?? ''))
      .join(':');
    const expected = hmacBase64('sha256', this.hmacKey, signed);
    if (!provided || !constantTimeEqual(provided, expected))
      throw new PaymentProviderError(PROVIDER, 400, false);

    const eventType = requiredString(item.eventCode, PROVIDER);
    const success = item.success === 'true' || item.success === true;
    const providerStatus = success ? eventType : `${eventType}.failed`;
    return {
      providerEventId:
        stringValue(item.eventId) ??
        `${requiredString(item.pspReference, PROVIDER)}:${eventType}:${success}`,
      eventType,
      providerStatus,
      status: adyenEventStatus(eventType, success),
      occurredAt: stringValue(payload.createdAt),
      payload,
    };
  }

  private async request<T extends AdyenResponse>(
    path: string,
    method: 'POST',
    body: Readonly<Record<string, unknown>>,
    idempotencyKey: string
  ): Promise<T> {
    return requestJson<T>({
      provider: PROVIDER,
      url: `${this.baseUrl}${path}`,
      method,
      headers: jsonHeaders({ 'X-API-Key': this.apiKey, 'Idempotency-Key': idempotencyKey }),
      body,
    });
  }

  private paymentReference(response: AdyenResponse): ProviderPaymentReference {
    const id = requiredString(response.pspReference ?? response.id, PROVIDER);
    const providerStatus = stringValue(response.resultCode ?? response.status) ?? 'received';
    const action = asRecord(response.action);
    return {
      providerTransactionId: id,
      providerStatus,
      status: mapPaymentStatus(providerStatus),
      checkoutUrl: stringValue(action.url),
      requiresCustomerAction:
        providerStatus === 'RedirectShopper' || providerStatus === 'ChallengeShopper',
      raw: response,
    };
  }
}

function adyenEventStatus(eventType: string, success: boolean): ProviderPaymentReference['status'] {
  if (!success) return 'failed';
  switch (eventType) {
    case 'AUTHORISATION':
      return 'authorized';
    case 'CAPTURE':
      return 'captured';
    case 'REFUND':
      return 'refunded';
    case 'CANCELLATION':
    case 'CANCEL_OR_REFUND':
      return 'cancelled';
    case 'CHARGEBACK':
      return 'disputed';
    default:
      return mapPaymentStatus(eventType);
  }
}

// src/lib/payments/nmi.ts
// NMI's secure flow is Collect.js or the Payment Component in the browser ->
// one-time payment_token -> server-side Payment API. This adapter rejects a
// request without that token and never accepts raw card or ACH fields.
import 'server-only';
import {
  PaymentProviderError,
  asRecord,
  jsonHeaders,
  requestFormValues,
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

const PROVIDER = 'nmi';
const DEFAULT_REST_BASE_URL = 'https://sandbox.nmi.com';
type NmiResponse = Record<string, unknown>;

export class NmiAdapter implements PaymentGatewayAdapter {
  readonly gateway = 'nmi' as const;
  private readonly securityKey: string;
  private readonly webhookSecret: string;
  private readonly restBaseUrl: string;
  private readonly classicBaseUrl: string;

  constructor(
    securityKey: string | undefined,
    webhookSecret: string | undefined,
    options: GatewayAdapterOptions = {}
  ) {
    this.securityKey = requireSecret(securityKey, PROVIDER);
    this.webhookSecret = requireSecret(webhookSecret, PROVIDER);
    this.restBaseUrl = options.baseUrl ?? DEFAULT_REST_BASE_URL;
    this.classicBaseUrl = options.baseUrl ?? DEFAULT_REST_BASE_URL;
  }

  async createPayment(request: CreatePaymentRequest): Promise<ProviderPaymentReference> {
    if (!request.paymentMethodToken) throw new PaymentProviderError(PROVIDER, null, false);
    const body: Record<string, unknown> = {
      amount: (request.amountMinor / 100).toFixed(2),
      currency: request.currency.toUpperCase(),
      payment_details: { payment_token: request.paymentMethodToken },
      order_details: {
        order_id: request.reference ?? request.idempotencyKey,
        description: request.description ?? 'Payment',
      },
    };
    const response = await requestJson<NmiResponse>({
      provider: PROVIDER,
      url: `${this.restBaseUrl}/api/v5/payments/sale`,
      method: 'POST',
      headers: jsonHeaders({
        Authorization: this.securityKey,
        'Idempotency-Key': request.idempotencyKey,
      }),
      body,
    });
    return this.paymentReference(response);
  }

  async capturePayment(request: CapturePaymentRequest): Promise<ProviderPaymentReference> {
    // NMI's documented `sale` operation authorizes and captures in one
    // request. The legacy transaction endpoint is used only for an existing
    // authorized transaction's capture operation, with duplicate checking.
    const body = new URLSearchParams({
      security_key: this.securityKey,
      type: 'capture',
      transactionid: request.providerTransactionId,
      dup_seconds: '86400',
    });
    if (request.amountMinor !== undefined)
      body.set('amount', (request.amountMinor / 100).toFixed(2));
    const response = await requestFormValues<NmiResponse>({
      provider: PROVIDER,
      url: `${this.classicBaseUrl}/api/transact.php`,
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    return this.paymentReference(response);
  }

  async refundPayment(request: RefundPaymentRequest): Promise<ProviderRefundReference> {
    if (request.amountMinor === undefined) throw new PaymentProviderError(PROVIDER, null, false);
    const body = new URLSearchParams({
      security_key: this.securityKey,
      type: 'refund',
      transactionid: request.providerTransactionId,
      amount: (request.amountMinor / 100).toFixed(2),
      dup_seconds: '86400',
    });
    const response = await requestFormValues<NmiResponse>({
      provider: PROVIDER,
      url: `${this.classicBaseUrl}/api/transact.php`,
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const id =
      stringValue(response.transactionid ?? response.transaction_id ?? response.id) ??
      request.providerTransactionId;
    const providerStatus = stringValue(response.response_text ?? response.status) ?? 'pending';
    return {
      providerRefundId: id,
      providerStatus,
      status: mapRefundStatus(providerStatus),
      raw: response,
    };
  }

  async verifyWebhook(request: WebhookVerificationRequest): Promise<VerifiedWebhookEvent> {
    const signatureHeader = headerValue(request.headers, 'webhook-signature') ?? '';
    const match = /^t=(.*),s=(.*)$/.exec(signatureHeader);
    const nonce = match?.[1];
    const signature = match?.[2];
    const expected = nonce
      ? hmacHex('sha256', this.webhookSecret, `${nonce}.${request.rawBody}`)
      : '';
    if (!signature || !constantTimeEqual(signature, expected))
      throw new PaymentProviderError(PROVIDER, 400, false);

    const payload = parseJsonBody(request.rawBody, PROVIDER);
    const eventBody = asRecord(payload.event_body);
    const eventType = requiredString(payload.event_type, PROVIDER);
    const providerStatus = stringValue(eventBody.condition) ?? eventType;
    return {
      providerEventId: requiredString(payload.event_id, PROVIDER),
      eventType,
      providerStatus,
      status: mapPaymentStatus(providerStatus),
      occurredAt: stringValue(payload.created_at),
      payload,
    };
  }

  private paymentReference(response: NmiResponse): ProviderPaymentReference {
    const id = requiredString(
      response.id ?? response.transactionid ?? response.transaction_id,
      PROVIDER
    );
    const providerStatus =
      stringValue(response.status ?? response.condition ?? response.response_text) ?? 'pending';
    const responseCode = stringValue(response.response ?? response.response_code);
    const succeeded =
      responseCode === '1' || responseCode === '100' || providerStatus === 'SUCCESS';
    return {
      providerTransactionId: id,
      providerStatus,
      status: succeeded ? 'captured' : mapPaymentStatus(providerStatus),
      checkoutUrl: null,
      requiresCustomerAction: false,
      raw: response,
    };
  }
}

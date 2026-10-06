// src/lib/payments/custom.ts
// A deliberately explicit JSON-configured adapter for providers that do not
// have a first-party implementation in this repository. The config supplies
// the provider's documented endpoint paths, request field names, response
// paths, authentication header, idempotency header, and webhook signature.
// No endpoint or request shape is guessed by this adapter.
import 'server-only';
import {
  PaymentProviderError,
  asRecord,
  jsonHeaders,
  requestJson,
  requiredString,
  stringValue,
} from './http';
import { constantTimeEqual, hmacHex, headerValue, parseJsonBody } from './crypto';
import { mapPaymentStatus, mapRefundStatus } from './status';
import type {
  CapturePaymentRequest,
  CreatePayoutRequest,
  CreatePaymentRequest,
  PaymentGatewayAdapter,
  ProviderPaymentReference,
  ProviderRefundReference,
  RefundPaymentRequest,
  VerifiedWebhookEvent,
  WebhookVerificationRequest,
} from './types';

const PROVIDER = 'custom';

export type CustomGatewayId = 'custom' | 'local_rail_1' | 'local_rail_2';
export type CustomHttpMethod = 'POST' | 'PATCH' | 'DELETE';
export type SignatureAlgorithm = 'sha256' | 'sha512';
export type SignatureEncoding = 'hex' | 'base64';

type JsonTemplate =
  | string
  | number
  | boolean
  | null
  | readonly JsonTemplate[]
  | { readonly [key: string]: JsonTemplate };

export interface CustomAuthConfig {
  readonly type: 'bearer' | 'api_key' | 'basic';
  readonly headerName?: string;
  readonly username?: string;
  readonly secret: string;
}

export interface CustomOperationConfig {
  readonly path: string;
  readonly method: CustomHttpMethod;
  readonly idempotencyHeader: string;
  readonly body: Readonly<Record<string, JsonTemplate>>;
}

export interface CustomWebhookConfig {
  readonly signatureHeader: string;
  readonly secret: string;
  readonly algorithm: SignatureAlgorithm;
  readonly encoding: SignatureEncoding;
  readonly prefix?: string;
  readonly eventIdPath: string;
  readonly eventTypePath: string;
  readonly statusPath: string;
  readonly occurredAtPath?: string;
}

export interface CustomResponseMapping {
  readonly transactionIdPath: string;
  readonly statusPath: string;
  readonly checkoutUrlPath?: string;
  readonly refundIdPath?: string;
}

export interface CustomGatewayConfig {
  readonly gateway: CustomGatewayId;
  readonly baseUrl: string;
  readonly auth: CustomAuthConfig;
  readonly createPayment: CustomOperationConfig;
  readonly capturePayment: CustomOperationConfig;
  readonly refundPayment: CustomOperationConfig;
  readonly response: CustomResponseMapping;
  readonly webhook: CustomWebhookConfig;
}

interface TemplateContext {
  readonly amountMinor: number;
  readonly currency: string;
  readonly paymentMethodToken: string | undefined;
  readonly idempotencyKey: string;
  readonly reference: string | undefined;
  readonly description: string | undefined;
  readonly customerEmail: string | undefined;
  readonly returnUrl: string | undefined;
  readonly cancelUrl: string | undefined;
  readonly metadata: Readonly<Record<string, string>> | undefined;
  readonly lineItems: readonly JsonTemplate[] | undefined;
  readonly providerTransactionId: string | undefined;
  readonly reason: string | undefined;
  readonly providerLineItemId: string | undefined;
  readonly destinationToken: string | undefined;
}

export class CustomGatewayAdapter implements PaymentGatewayAdapter {
  readonly gateway: CustomGatewayId;
  private readonly config: CustomGatewayConfig;
  private readonly baseUrl: URL;

  constructor(config: CustomGatewayConfig) {
    validateConfig(config);
    this.config = config;
    this.gateway = config.gateway;
    this.baseUrl = new URL(config.baseUrl);
  }

  async createPayment(request: CreatePaymentRequest): Promise<ProviderPaymentReference> {
    const context: TemplateContext = {
      amountMinor: request.amountMinor,
      currency: request.currency,
      paymentMethodToken: request.paymentMethodToken,
      idempotencyKey: request.idempotencyKey,
      reference: request.reference,
      description: request.description,
      customerEmail: request.customerEmail,
      returnUrl: request.returnUrl,
      cancelUrl: request.cancelUrl,
      metadata: request.metadata,
      lineItems: normalizeLineItems(request),
      providerTransactionId: undefined,
      reason: undefined,
      providerLineItemId: undefined,
      destinationToken: undefined,
    };
    const response = await this.execute(this.config.createPayment, context, request.idempotencyKey);
    return this.mapPayment(response);
  }

  async capturePayment(request: CapturePaymentRequest): Promise<ProviderPaymentReference> {
    const context = this.contextForTransaction(
      request.providerTransactionId,
      request.amountMinor,
      undefined,
      request.idempotencyKey,
      request.currency
    );
    const response = await this.execute(
      this.config.capturePayment,
      context,
      request.idempotencyKey
    );
    return this.mapPayment(response);
  }

  async refundPayment(request: RefundPaymentRequest): Promise<ProviderRefundReference> {
    const context = this.contextForTransaction(
      request.providerTransactionId,
      request.amountMinor,
      request
    );
    const response = await this.execute(this.config.refundPayment, context, request.idempotencyKey);
    const id = readConfiguredPath(
      response,
      this.config.response.refundIdPath ?? this.config.response.transactionIdPath
    );
    const providerRefundId = requiredString(id, this.gateway);
    const providerStatus =
      stringValue(readConfiguredPath(response, this.config.response.statusPath)) ?? 'pending';
    return {
      providerRefundId,
      providerStatus,
      status: mapRefundStatus(providerStatus),
      raw: response,
    };
  }

  async verifyWebhook(request: WebhookVerificationRequest): Promise<VerifiedWebhookEvent> {
    const provided = headerValue(request.headers, this.config.webhook.signatureHeader);
    const expected = this.webhookSignature(request.rawBody);
    const normalizedProvided =
      this.config.webhook.prefix && provided?.startsWith(this.config.webhook.prefix)
        ? provided.slice(this.config.webhook.prefix.length)
        : provided;
    if (!normalizedProvided || !constantTimeEqual(normalizedProvided, expected)) {
      throw new PaymentProviderError(this.gateway, 400, false);
    }

    const payload = parseJsonBody(request.rawBody, this.gateway);
    const eventType = requiredString(
      readConfiguredPath(payload, this.config.webhook.eventTypePath),
      this.gateway
    );
    const providerStatus =
      stringValue(readConfiguredPath(payload, this.config.webhook.statusPath)) ?? eventType;
    return {
      providerEventId: requiredString(
        readConfiguredPath(payload, this.config.webhook.eventIdPath),
        this.gateway
      ),
      eventType,
      providerStatus,
      status: mapPaymentStatus(providerStatus),
      occurredAt: this.config.webhook.occurredAtPath
        ? stringValue(readConfiguredPath(payload, this.config.webhook.occurredAtPath))
        : null,
      payload,
    };
  }

  protected contextForTransaction(
    providerTransactionId: string,
    amountMinor: number | undefined,
    refund: RefundPaymentRequest | undefined,
    idempotencyKey = '',
    currency = ''
  ): TemplateContext {
    return {
      amountMinor: amountMinor ?? 0,
      currency: refund?.currency ?? currency,
      paymentMethodToken: undefined,
      idempotencyKey: refund?.idempotencyKey ?? idempotencyKey,
      reference: undefined,
      description: undefined,
      customerEmail: undefined,
      returnUrl: undefined,
      cancelUrl: undefined,
      metadata: undefined,
      lineItems: undefined,
      providerTransactionId,
      reason: refund?.reason,
      providerLineItemId: refund?.providerLineItemId,
      destinationToken: undefined,
    };
  }

  protected contextForPayout(request: CreatePayoutRequest): TemplateContext {
    return {
      amountMinor: request.amountMinor,
      currency: request.currency,
      paymentMethodToken: undefined,
      idempotencyKey: request.idempotencyKey,
      reference: request.reference,
      description: undefined,
      customerEmail: undefined,
      returnUrl: undefined,
      cancelUrl: undefined,
      metadata: request.metadata,
      lineItems: undefined,
      providerTransactionId: undefined,
      reason: undefined,
      providerLineItemId: undefined,
      destinationToken: request.destinationToken,
    };
  }

  protected async execute(
    operation: CustomOperationConfig,
    context: TemplateContext,
    idempotencyKey: string
  ): Promise<Record<string, unknown>> {
    const body = asRecord(resolveTemplate(operation.body, context));
    const response = await requestJson<Record<string, unknown>>({
      provider: this.gateway,
      url: resolveUrl(this.baseUrl, operation.path),
      method: operation.method,
      headers: {
        ...jsonHeaders(authHeaders(this.config.auth)),
        [operation.idempotencyHeader]: idempotencyKey,
      },
      body,
    });
    return response;
  }

  private mapPayment(response: Record<string, unknown>): ProviderPaymentReference {
    const providerTransactionId = requiredString(
      readConfiguredPath(response, this.config.response.transactionIdPath),
      this.gateway
    );
    const providerStatus =
      stringValue(readConfiguredPath(response, this.config.response.statusPath)) ?? 'pending';
    return {
      providerTransactionId,
      providerStatus,
      status: mapPaymentStatus(providerStatus),
      checkoutUrl: this.config.response.checkoutUrlPath
        ? stringValue(readConfiguredPath(response, this.config.response.checkoutUrlPath))
        : null,
      requiresCustomerAction: providerStatus.toLowerCase() === 'requires_action',
      raw: response,
    };
  }

  private webhookSignature(rawBody: string): string {
    const digest = hmacHex(this.config.webhook.algorithm, this.config.webhook.secret, rawBody);
    if (this.config.webhook.encoding === 'hex') return digest;
    return Buffer.from(digest, 'hex').toString('base64');
  }
}

function validateConfig(config: CustomGatewayConfig): void {
  let baseUrl: URL;
  try {
    baseUrl = new URL(config.baseUrl);
  } catch {
    throw new PaymentProviderError(PROVIDER, null, false);
  }
  if (baseUrl.protocol !== 'https:') throw new PaymentProviderError(PROVIDER, null, false);
  if (!config.auth.secret || !config.webhook.secret)
    throw new PaymentProviderError(PROVIDER, null, false);
  for (const operation of [config.createPayment, config.capturePayment, config.refundPayment]) {
    if (!operation.path || !operation.idempotencyHeader || !isRelativePath(operation.path)) {
      throw new PaymentProviderError(PROVIDER, null, false);
    }
  }
  if (
    !config.webhook.signatureHeader ||
    !config.webhook.eventIdPath ||
    !config.webhook.eventTypePath ||
    !config.webhook.statusPath
  ) {
    throw new PaymentProviderError(PROVIDER, null, false);
  }
}

function isRelativePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//');
}

function resolveUrl(baseUrl: URL, path: string): string {
  const url = new URL(path, baseUrl);
  if (url.origin !== baseUrl.origin) throw new PaymentProviderError(PROVIDER, null, false);
  return url.toString();
}

function authHeaders(config: CustomAuthConfig): Record<string, string> {
  switch (config.type) {
    case 'bearer':
      return { Authorization: `Bearer ${config.secret}` };
    case 'api_key':
      if (!config.headerName) throw new PaymentProviderError(PROVIDER, null, false);
      return { [config.headerName]: config.secret };
    case 'basic':
      if (!config.username) throw new PaymentProviderError(PROVIDER, null, false);
      return {
        Authorization: `Basic ${Buffer.from(`${config.username}:${config.secret}`).toString('base64')}`,
      };
  }
}

function normalizeLineItems(request: CreatePaymentRequest): readonly JsonTemplate[] | undefined {
  return request.lineItems?.map((item) => {
    const normalized: Record<string, JsonTemplate> = {
      name: item.name,
      quantity: item.quantity,
      amountMinor: item.amountMinor,
    };
    if (item.providerPriceId) normalized.providerPriceId = item.providerPriceId;
    if (item.providerProductCode) normalized.providerProductCode = item.providerProductCode;
    return normalized;
  });
}

function resolveTemplate(value: JsonTemplate, context: TemplateContext): JsonTemplate {
  if (typeof value === 'string' && value.startsWith('$')) return templateValue(value, context);
  if (Array.isArray(value)) return value.map((item) => resolveTemplate(item, context));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveTemplate(item, context)])
    );
  }
  return value;
}

function templateValue(name: string, context: TemplateContext): JsonTemplate {
  const values: Record<string, JsonTemplate | undefined> = {
    $amountMinor: context.amountMinor,
    $currency: context.currency,
    $paymentMethodToken: context.paymentMethodToken,
    $idempotencyKey: context.idempotencyKey,
    $reference: context.reference,
    $description: context.description,
    $customerEmail: context.customerEmail,
    $returnUrl: context.returnUrl,
    $cancelUrl: context.cancelUrl,
    $metadata: context.metadata,
    $lineItems: context.lineItems,
    $providerTransactionId: context.providerTransactionId,
    $reason: context.reason,
    $providerLineItemId: context.providerLineItemId,
    $destinationToken: context.destinationToken,
  };
  if (!(name in values) || values[name] === undefined)
    throw new PaymentProviderError(PROVIDER, null, false);
  return values[name] as JsonTemplate;
}

export function readConfiguredPath(
  value: Readonly<Record<string, unknown>>,
  path: string
): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (typeof current !== 'object' || current === null || !(segment in current)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

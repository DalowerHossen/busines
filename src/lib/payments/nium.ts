// src/lib/payments/nium.ts
// Nium is a payout, payin, wallet, and FX rail, not a card checkout
// provider. It deliberately does not implement PaymentGatewayAdapter.
// Payouts and conversions are asynchronous; the caller must persist the
// request id and apply later webhook status updates idempotently.
import 'server-only';
import {
  PaymentProviderError,
  jsonHeaders,
  requestJson,
  requireSecret,
  requiredString,
  stringValue,
} from './http';
import { constantTimeEqual, hmacHex, headerValue, parseJsonBody } from './crypto';
import type { VerifiedWebhookEvent, WebhookVerificationRequest } from './types';

const PROVIDER = 'nium';
const DEFAULT_BASE_URL = 'https://gateway.nium.com';
type NiumResponse = Record<string, unknown>;

export interface NiumPayoutInstruction {
  readonly externalId: string;
  readonly customerHashId: string;
  readonly walletHashId: string;
  readonly beneficiary: Readonly<Record<string, unknown>>;
  readonly paymentAccount: Readonly<Record<string, unknown>>;
  readonly payout: Readonly<Record<string, unknown>>;
}

export interface NiumPayoutRequest {
  readonly requestId: string;
  readonly batchExternalId: string;
  readonly executeAt?: string;
  readonly payouts: readonly NiumPayoutInstruction[];
}

export interface NiumPayinRequest {
  readonly requestId: string;
  readonly clientHashId: string;
  readonly customerHashId: string;
  readonly walletHashId: string;
  readonly amount: number;
  readonly fundingChannel: string;
  readonly sourceCurrencyCode: string;
  readonly destinationCurrencyCode: string;
  readonly fundingInstrumentId: string;
  readonly statementNarrative?: string;
}

export interface NiumQuoteRequest {
  readonly requestId: string;
  readonly clientHashId: string;
  readonly customerHashId?: string;
  readonly sourceCurrencyCode: string;
  readonly destinationCurrencyCode: string;
  readonly quoteType: 'balance_transfer' | 'payout';
  readonly conversionSchedule?:
    | 'immediate'
    | 'end_of_day'
    | 'next_day'
    | '2_days'
    | '3_days'
    | '7_days';
  readonly executionType?: 'at_conversion_time' | 'manual';
  readonly lockPeriod?: '5_mins' | '15_mins' | '1_hour' | '4_hours' | '8_hours' | '24_hours';
  readonly quoteIntent?: 'EXECUTABLE' | 'INDICATIVE';
}

export interface NiumConversionRequest {
  readonly requestId: string;
  readonly clientHashId: string;
  readonly customerHashId: string;
  readonly walletHashId: string;
  readonly quoteId?: string;
  readonly sourceAmount?: number;
  readonly destinationAmount?: number;
  readonly sourceCurrencyCode: string;
  readonly destinationCurrencyCode: string;
  readonly conversionSchedule?:
    | 'immediate'
    | 'end_of_day'
    | 'next_day'
    | '2_days'
    | '3_days'
    | '7_days';
  readonly executionType?: 'at_conversion_time' | 'manual';
}

export class NiumAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly webhookSecret: string;

  constructor(
    apiKey: string | undefined,
    webhookSecret: string | undefined,
    baseUrl = DEFAULT_BASE_URL
  ) {
    this.apiKey = requireSecret(apiKey, PROVIDER);
    this.webhookSecret = requireSecret(webhookSecret, PROVIDER);
    this.baseUrl = baseUrl;
  }

  async createPayout(request: NiumPayoutRequest): Promise<NiumResponse> {
    return this.request(
      '/api/payout/bulk',
      'POST',
      {
        fundingSource: { fundingChannel: 'PREFUND' },
        batchExternalId: request.batchExternalId,
        ...(request.executeAt ? { executeAt: request.executeAt } : {}),
        payouts: request.payouts,
      },
      request.requestId
    );
  }

  async getPayoutStatus(batchId: string, requestId: string): Promise<NiumResponse> {
    return this.request(
      `/api/payout/bulk/${encodeURIComponent(batchId)}/status`,
      'GET',
      undefined,
      requestId
    );
  }

  async createPayin(request: NiumPayinRequest): Promise<NiumResponse> {
    return this.request(
      `/api/v1/client/${encodeURIComponent(request.clientHashId)}/customer/${encodeURIComponent(request.customerHashId)}/wallet/${encodeURIComponent(request.walletHashId)}/fund`,
      'POST',
      {
        amount: request.amount,
        fundingChannel: request.fundingChannel,
        sourceCurrencyCode: request.sourceCurrencyCode,
        destinationCurrencyCode: request.destinationCurrencyCode,
        fundingInstrumentId: request.fundingInstrumentId,
        ...(request.statementNarrative ? { statementNarrative: request.statementNarrative } : {}),
      },
      request.requestId
    );
  }

  async createQuote(request: NiumQuoteRequest): Promise<NiumResponse> {
    return this.request(
      `/api/v1/client/${encodeURIComponent(request.clientHashId)}/quotes`,
      'POST',
      {
        destinationCurrencyCode: request.destinationCurrencyCode,
        quoteType: request.quoteType,
        sourceCurrencyCode: request.sourceCurrencyCode,
        ...(request.customerHashId ? { customerHashId: request.customerHashId } : {}),
        ...(request.conversionSchedule ? { conversionSchedule: request.conversionSchedule } : {}),
        ...(request.executionType ? { executionType: request.executionType } : {}),
        ...(request.lockPeriod ? { lockPeriod: request.lockPeriod } : {}),
        ...(request.quoteIntent ? { quoteIntent: request.quoteIntent } : {}),
      },
      request.requestId
    );
  }

  async getQuote(clientHashId: string, quoteId: string, requestId: string): Promise<NiumResponse> {
    return this.request(
      `/api/v1/client/${encodeURIComponent(clientHashId)}/quotes/${encodeURIComponent(quoteId)}`,
      'GET',
      undefined,
      requestId
    );
  }

  async createConversion(request: NiumConversionRequest): Promise<NiumResponse> {
    if (request.sourceAmount === undefined && request.destinationAmount === undefined) {
      throw new PaymentProviderError(PROVIDER, null, false);
    }
    return this.request(
      `/api/v1/client/${encodeURIComponent(request.clientHashId)}/customer/${encodeURIComponent(request.customerHashId)}/wallet/${encodeURIComponent(request.walletHashId)}/conversions`,
      'POST',
      {
        ...(request.quoteId ? { quoteId: request.quoteId } : {}),
        ...(request.sourceAmount !== undefined ? { sourceAmount: request.sourceAmount } : {}),
        ...(request.destinationAmount !== undefined
          ? { destinationAmount: request.destinationAmount }
          : {}),
        sourceCurrencyCode: request.sourceCurrencyCode,
        destinationCurrencyCode: request.destinationCurrencyCode,
        ...(request.conversionSchedule ? { conversionSchedule: request.conversionSchedule } : {}),
        ...(request.executionType ? { executionType: request.executionType } : {}),
      },
      request.requestId
    );
  }

  async executeConversion(
    clientHashId: string,
    customerHashId: string,
    walletHashId: string,
    conversionId: string,
    requestId: string
  ): Promise<NiumResponse> {
    return this.request(
      `/api/v1/client/${encodeURIComponent(clientHashId)}/customer/${encodeURIComponent(customerHashId)}/wallet/${encodeURIComponent(walletHashId)}/conversions/${encodeURIComponent(conversionId)}/execute`,
      'POST',
      {},
      requestId
    );
  }

  async cancelConversion(
    clientHashId: string,
    customerHashId: string,
    walletHashId: string,
    conversionId: string,
    requestId: string
  ): Promise<NiumResponse> {
    return this.request(
      `/api/v1/client/${encodeURIComponent(clientHashId)}/customer/${encodeURIComponent(customerHashId)}/wallet/${encodeURIComponent(walletHashId)}/conversions/${encodeURIComponent(conversionId)}/cancel`,
      'POST',
      {},
      requestId
    );
  }

  async verifyWebhook(request: WebhookVerificationRequest): Promise<VerifiedWebhookEvent> {
    const signature = headerValue(request.headers, 'x-nium-signature');
    const requestId = headerValue(request.headers, 'x-request-id');
    const expected = hmacHex('sha256', this.webhookSecret, request.rawBody);
    if (!signature || !requestId || !constantTimeEqual(signature, expected)) {
      throw new PaymentProviderError(PROVIDER, 400, false);
    }
    const payload = parseJsonBody(request.rawBody, PROVIDER);
    const eventType = requiredString(payload.template, PROVIDER);
    const providerStatus =
      stringValue(payload.status) ?? stringValue(payload.remittanceStatus) ?? eventType;
    return {
      providerEventId: requestId,
      eventType,
      providerStatus,
      status: null,
      occurredAt: stringValue(payload.updatedAt) ?? stringValue(payload.createdAt),
      payload,
    };
  }

  private async request(
    path: string,
    method: 'GET' | 'POST',
    body: Readonly<Record<string, unknown>> | undefined,
    requestId: string
  ): Promise<NiumResponse> {
    return requestJson<NiumResponse>({
      provider: PROVIDER,
      url: `${this.baseUrl}${path}`,
      method,
      headers: jsonHeaders({ 'x-api-key': this.apiKey, 'x-request-id': requestId }),
      body,
    });
  }
}

// src/lib/payments/types.ts
// Provider-neutral contracts for server-side payment adapters. These types
// intentionally accept provider-issued tokens and identifiers only; raw card,
// CVV, bank-account, and ACH data do not exist in this module.
import type { GatewayId, PaymentStatus, RefundStatus } from '@/types/payment';

export interface PaymentLineItem {
  readonly providerPriceId?: string;
  readonly providerProductCode?: string;
  readonly name: string;
  readonly quantity: number;
  readonly amountMinor: number;
}

export interface CreatePaymentRequest {
  readonly amountMinor: number;
  readonly currency: string;
  readonly idempotencyKey: string;
  readonly paymentMethodToken?: string;
  readonly customerEmail?: string;
  readonly shopperReference?: string;
  readonly description?: string;
  readonly reference?: string;
  readonly returnUrl?: string;
  readonly cancelUrl?: string;
  readonly lineItems?: readonly PaymentLineItem[];
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface ProviderPaymentReference {
  readonly providerTransactionId: string;
  readonly providerStatus: string;
  readonly status: PaymentStatus;
  readonly checkoutUrl: string | null;
  readonly requiresCustomerAction: boolean;
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface CapturePaymentRequest {
  readonly providerTransactionId: string;
  readonly idempotencyKey: string;
  readonly amountMinor?: number;
  readonly currency?: string;
}

export interface RefundPaymentRequest {
  readonly providerTransactionId: string;
  readonly amountMinor?: number;
  readonly currency: string;
  readonly idempotencyKey: string;
  readonly reason?: string;
  readonly providerLineItemId?: string;
}

export type PayoutStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

export interface CreatePayoutRequest {
  readonly amountMinor: number;
  readonly currency: string;
  readonly idempotencyKey: string;
  readonly destinationToken: string;
  readonly reference?: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface ProviderPayoutReference {
  readonly providerPayoutId: string;
  readonly providerStatus: string;
  readonly status: PayoutStatus;
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface ProviderRefundReference {
  readonly providerRefundId: string;
  readonly providerStatus: string;
  readonly status: RefundStatus;
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface VerifiedWebhookEvent {
  readonly providerEventId: string;
  readonly eventType: string;
  readonly providerStatus: string;
  readonly status: PaymentStatus | RefundStatus | null;
  readonly occurredAt: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface WebhookVerificationRequest {
  readonly rawBody: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
}

export interface PaymentGatewayAdapter {
  readonly gateway: Exclude<GatewayId, 'nium'>;
  createPayment(request: CreatePaymentRequest): Promise<ProviderPaymentReference>;
  capturePayment(request: CapturePaymentRequest): Promise<ProviderPaymentReference>;
  refundPayment(request: RefundPaymentRequest): Promise<ProviderRefundReference>;
  verifyWebhook(request: WebhookVerificationRequest): Promise<VerifiedWebhookEvent>;
}

export interface GatewayAdapterOptions {
  readonly baseUrl?: string;
}

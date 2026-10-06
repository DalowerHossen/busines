// src/lib/payments/manual-bank.ts
// Manual bank transfer is an offline reconciliation rail. It never calls a
// payment provider, never stores bank credentials, and never represents a
// transfer as captured until a trusted reconciliation workflow calls capture.
import 'server-only';
import { PaymentProviderError } from './http';
import type {
  CapturePaymentRequest,
  CreatePaymentRequest,
  PaymentGatewayAdapter,
  ProviderPaymentReference,
  ProviderRefundReference,
  RefundPaymentRequest,
  VerifiedWebhookEvent,
  WebhookVerificationRequest,
} from './types';

export class ManualBankTransferAdapter implements PaymentGatewayAdapter {
  readonly gateway = 'manual_bank_transfer' as const;

  async createPayment(request: CreatePaymentRequest): Promise<ProviderPaymentReference> {
    const providerTransactionId = `bank_transfer:${request.idempotencyKey}`;
    return {
      providerTransactionId,
      providerStatus: 'awaiting_bank_transfer',
      status: 'pending',
      checkoutUrl: null,
      requiresCustomerAction: true,
      raw: {
        reference: request.reference ?? request.idempotencyKey,
        amountMinor: request.amountMinor,
        currency: request.currency,
      },
    };
  }

  async capturePayment(request: CapturePaymentRequest): Promise<ProviderPaymentReference> {
    return {
      providerTransactionId: request.providerTransactionId,
      providerStatus: 'reconciled',
      status: 'captured',
      checkoutUrl: null,
      requiresCustomerAction: false,
      raw: { reconciliationReference: request.idempotencyKey },
    };
  }

  async refundPayment(_request: RefundPaymentRequest): Promise<ProviderRefundReference> {
    throw new PaymentProviderError(this.gateway, null, false);
  }

  async verifyWebhook(_request: WebhookVerificationRequest): Promise<VerifiedWebhookEvent> {
    throw new PaymentProviderError(this.gateway, 400, false);
  }
}

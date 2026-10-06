// src/lib/payments/index.ts
// Central adapter construction. Credentials are injected by trusted server
// code (database secret resolution or server environment fallback); this
// module never contains credentials or reads browser input.
import 'server-only';
import type { GatewayId } from '@/types/payment';
import { AdyenAdapter } from './adyen';
import { CustomGatewayAdapter } from './custom';
import { LocalRailAdapter } from './local';
import { ManualBankTransferAdapter } from './manual-bank';
import { NmiAdapter } from './nmi';
import { PaddleAdapter } from './paddle';
import { PayPalAdapter } from './paypal';
import { PaymentProviderError } from './http';
import { StripeAdapter } from './stripe';
import { TwoCheckoutAdapter } from './two-checkout';
import type { CustomGatewayConfig } from './custom';
import type { LocalRailConfig } from './local';
import type { GatewayAdapterOptions, PaymentGatewayAdapter } from './types';

export interface PaymentAdapterCredentials {
  readonly secretKey?: string;
  readonly webhookSecret?: string;
  readonly clientId?: string;
  readonly merchantAccount?: string;
  readonly apiKey?: string;
  readonly merchantCode?: string;
  readonly hmacKey?: string;
}

export function createPaymentAdapter(
  gateway: Exclude<GatewayId, 'nium'>,
  credentials: PaymentAdapterCredentials,
  options: GatewayAdapterOptions = {},
  configuredGateway?: CustomGatewayConfig | LocalRailConfig
): PaymentGatewayAdapter {
  switch (gateway) {
    case 'stripe':
      return new StripeAdapter(credentials.secretKey, credentials.webhookSecret, options);
    case 'paypal':
      return new PayPalAdapter(
        credentials.clientId,
        credentials.secretKey,
        credentials.webhookSecret,
        options
      );
    case 'paddle':
      return new PaddleAdapter(credentials.apiKey, credentials.webhookSecret, options);
    case 'nmi':
      return new NmiAdapter(credentials.secretKey, credentials.webhookSecret, options);
    case 'two_checkout':
      return new TwoCheckoutAdapter(
        credentials.merchantCode,
        credentials.secretKey,
        credentials.webhookSecret,
        options
      );
    case 'adyen_for_platforms':
      return new AdyenAdapter(
        credentials.apiKey,
        credentials.merchantAccount,
        credentials.hmacKey,
        options
      );
    case 'local_rail_1':
    case 'local_rail_2':
      if (
        !configuredGateway ||
        configuredGateway.gateway !== gateway ||
        !('createPayout' in configuredGateway)
      ) {
        throw new PaymentProviderError(gateway, null, false);
      }
      return new LocalRailAdapter(configuredGateway as LocalRailConfig);
    case 'custom':
      if (!configuredGateway || configuredGateway.gateway !== 'custom') {
        throw new PaymentProviderError(gateway, null, false);
      }
      return new CustomGatewayAdapter(configuredGateway);
    case 'manual_bank_transfer':
      return new ManualBankTransferAdapter();
  }
}

export { AdyenAdapter } from './adyen';
export { CustomGatewayAdapter } from './custom';
export { LocalRailAdapter } from './local';
export { ManualBankTransferAdapter } from './manual-bank';
export { NiumAdapter } from './nium';
export { NmiAdapter } from './nmi';
export { PaddleAdapter, shouldApplyPaddleEvent } from './paddle';
export { PayPalAdapter } from './paypal';
export { StripeAdapter } from './stripe';
export { TwoCheckoutAdapter } from './two-checkout';
export { PaymentProviderError } from './http';
export { claimWebhookEvent, webhookDedupeKey } from './webhooks';
export type { WebhookApplicationDecision, WebhookEventClaimStore } from './webhooks';
export type {
  CustomAuthConfig,
  CustomGatewayConfig,
  CustomGatewayId,
  CustomHttpMethod,
  CustomOperationConfig,
  CustomResponseMapping,
  CustomWebhookConfig,
} from './custom';
export type { LocalRailConfig } from './local';
export type * from './types';

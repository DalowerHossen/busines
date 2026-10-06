// src/lib/payments/adapters/types.ts
// What every payment provider has to be able to do. A provider the platform
// does not know about is reached through the configurable adapter, so the
// rest of the application never learns a provider name.

import 'server-only';

import type { GatewayMode, GatewayProvider } from '@/types/enums';
import type { JsonObject } from '@/types/json';

export interface GatewayContext {
  provider: GatewayProvider;
  mode: GatewayMode;
  /** Credentials in clear text, decrypted for this call only. */
  credentials: Readonly<Record<string, string>>;
  /** Endpoints and field mapping, for providers reached by configuration. */
  adapterConfig: JsonObject;
}

export interface ConnectionTestResult {
  /** True when the provider answered as expected. */
  isHealthy: boolean;
  /** A sentence a business owner can act on. */
  message: string;
}

export interface CheckoutRequest {
  /** Identifier of the attempt, passed back by the provider. */
  intentId: string;
  /** Amount owed, as a decimal string. */
  amount: string;
  /** Smallest unit of the currency, which is what most providers want. */
  amountMinor: number;
  /** Three letter currency code. */
  currency: string;
  /** What the client sees the payment is for. */
  description: string;
  /** Where the provider should send the client when they are finished. */
  returnUrl: string;
  /** Email of the person paying, when the document carries one. */
  payerEmail: string | null;
}

export interface CheckoutStart {
  /** Where to send the client, or null when nothing is hosted elsewhere. */
  checkoutUrl: string | null;
  /** Reference the provider gave the attempt, kept for reconciliation. */
  providerReference: string | null;
  /** Shown to the client when there is no page to send them to. */
  instructions: string | null;
}

export interface GatewayAdapter {
  /** Name used in logs and in the connection list. */
  readonly key: string;
  /**
   * Checks the credentials against the provider without taking any money.
   *
   * @param context Credentials and configuration of the connection.
   * @returns Whether the provider accepted the credentials.
   */
  testConnection(context: GatewayContext): Promise<ConnectionTestResult>;

  /**
   * Starts a payment with the provider.
   *
   * @param context Credentials and configuration of the connection.
   * @param request What is being paid and where the client should return.
   * @returns Where to send the client, or what to tell them instead.
   */
  startCheckout(context: GatewayContext, request: CheckoutRequest): Promise<CheckoutStart>;
}

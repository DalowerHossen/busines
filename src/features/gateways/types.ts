// src/features/gateways/types.ts
// The shapes the payment settings page works with.

import type { GatewayMode, GatewayProvider } from '@/types/enums';

export interface GatewayConnection {
  id: string;
  provider: GatewayProvider;
  displayName: string;
  mode: GatewayMode;
  isEnabled: boolean;
  isDefault: boolean;
  /** Short hint of the stored secret, so a person can recognise it. */
  credentialHint: string | null;
  publishableKey: string | null;
  instructions: string | null;
  supportsPayouts: boolean;
  supportsRefunds: boolean;
  lastTestedAt: string | null;
  lastTestSucceeded: boolean | null;
  lastTestMessage: string | null;
  lastUsedAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  feePercentage: string;
  feeFixedAmount: string;
  feeCurrency: string;
}

export interface GatewayOverview {
  connections: readonly GatewayConnection[];
  /** True when the connections could not be read. */
  isDegraded: boolean;
}

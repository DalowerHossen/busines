// src/lib/payments/local.ts
// Local payment rails use the same explicit, provider-documented JSON
// contract as the custom adapter, but expose payouts as a separate operation.
// Rail-specific endpoints and field mappings must be configured by a trusted
// administrator; no local banking protocol is guessed here.
import 'server-only';
import { PaymentProviderError, requiredString, stringValue } from './http';
import { CustomGatewayAdapter, readConfiguredPath } from './custom';
import { mapPayoutStatus } from './status';
import type { CreatePayoutRequest, ProviderPayoutReference } from './types';
import type { CustomGatewayConfig, CustomOperationConfig } from './custom';

export interface LocalRailConfig extends CustomGatewayConfig {
  readonly gateway: 'local_rail_1' | 'local_rail_2';
  readonly createPayout: CustomOperationConfig;
  readonly payoutResponse: {
    readonly payoutIdPath: string;
    readonly statusPath: string;
  };
}

export class LocalRailAdapter extends CustomGatewayAdapter {
  override readonly gateway: 'local_rail_1' | 'local_rail_2';
  private readonly localConfig: LocalRailConfig;

  constructor(config: LocalRailConfig) {
    super(config);
    this.gateway = config.gateway;
    this.localConfig = config;
  }

  async createPayout(request: CreatePayoutRequest): Promise<ProviderPayoutReference> {
    const response = await this.execute(
      this.localConfig.createPayout,
      this.contextForPayout(request),
      request.idempotencyKey
    );
    const providerPayoutId = requiredString(
      readConfiguredPath(response, this.localConfig.payoutResponse.payoutIdPath),
      this.gateway
    );
    const providerStatus =
      stringValue(readConfiguredPath(response, this.localConfig.payoutResponse.statusPath)) ??
      'pending';
    return {
      providerPayoutId,
      providerStatus,
      status: mapPayoutStatus(providerStatus),
      raw: response,
    };
  }
}

export function assertLocalRailConfig(config: LocalRailConfig): void {
  if (!config.createPayout.idempotencyHeader || !config.payoutResponse.payoutIdPath) {
    throw new PaymentProviderError(config.gateway, null, false);
  }
}

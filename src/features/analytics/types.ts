// src/features/analytics/types.ts
// The shapes the measurement screens work with. A server token never
// appears in any of them.

export interface MeasurementDestination {
  destinationId: string;
  providerKey: string;
  label: string;
  publicIdentifier: string;
  consentCategory: string;
  isEnabled: boolean;
  loadsOnMarketingPages: boolean;
  loadsOnApplicationPages: boolean;
  hasAccessToken: boolean;
  tokenHint: string | null;
  notes: string | null;
  updatedAt: string;
}

export interface ActiveDestination {
  providerKey: string;
  publicIdentifier: string;
  consentCategory: string;
}

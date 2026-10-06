// src/features/integrations/types.ts
// The shapes the connection screens work with. No secret ever appears in
// any of them: a stored key is represented only by the hint the person who
// typed it would recognise.

export interface IntegrationField {
  key: string;
  label: string;
  type: string;
  isRequired: boolean;
  isSecret: boolean;
  envVar: string | null;
}

export interface IntegrationSummary {
  providerKey: string;
  name: string;
  category: string;
  summary: string;
  configurableBy: string;
  documentationUrl: string | null;
  logoSlug: string | null;
  credentialId: string | null;
  scope: string | null;
  environment: string;
  isEnabled: boolean;
  status: string;
  maskedHints: Readonly<Record<string, string>>;
  lastTestedAt: string | null;
  lastTestSucceeded: boolean | null;
  lastUsedAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  fields: readonly IntegrationField[];
}

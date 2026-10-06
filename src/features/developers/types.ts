// src/features/developers/types.ts
// The shapes the developer portal works with.

export type DeveloperAppStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'retired';

export type DeveloperAppType = 'oauth' | 'api_key' | 'extension' | 'webhook_consumer';

export type DeveloperAppDistribution = 'private' | 'unlisted' | 'public';

export interface DeveloperAppSummary {
  appId: string;
  appSlug: string;
  appName: string;
  tagline: string | null;
  appType: DeveloperAppType;
  distribution: DeveloperAppDistribution;
  status: DeveloperAppStatus;
  clientId: string;
  clientSecretHint: string | null;
  requestedScopes: readonly string[];
  allowedScopes: readonly string[];
  installCount: number;
  activeInstalls: number;
  rejectionReason: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface DeveloperRedirectUri {
  redirectUri: string;
  environment: string;
  isActive: boolean;
}

export interface DeveloperAppInstallUsage {
  installId: string;
  status: string;
  installedAt: string;
  lastUsedAt: string | null;
  requestCount: number;
  errorCount: number;
}

export interface DeveloperAppDetail {
  appId: string;
  appSlug: string;
  appName: string;
  tagline: string | null;
  description: string | null;
  homepageUrl: string | null;
  privacyPolicyUrl: string | null;
  supportEmail: string | null;
  appType: DeveloperAppType;
  distribution: DeveloperAppDistribution;
  status: DeveloperAppStatus;
  clientId: string;
  clientSecretHint: string | null;
  secretRotatedAt: string | null;
  requestedScopes: readonly string[];
  allowedScopes: readonly string[];
  webhookUrl: string | null;
  rateLimitPerMinute: number;
  rejectionReason: string | null;
  installCount: number;
  redirectUris: readonly DeveloperRedirectUri[];
  installs: readonly DeveloperAppInstallUsage[];
}

export interface DirectoryApp {
  appSlug: string;
  appName: string;
  tagline: string | null;
  description: string | null;
  appType: DeveloperAppType;
  homepageUrl: string | null;
  supportEmail: string | null;
  allowedScopes: readonly string[];
  installCount: number;
}

export interface ConnectedApp {
  installId: string;
  appName: string;
  appSlug: string;
  grantedScopes: readonly string[];
  installedAt: string;
  lastUsedAt: string | null;
  requestCount: number;
  status: string;
}

export interface DeveloperAppQueueEntry {
  appId: string;
  appSlug: string;
  appName: string;
  tagline: string | null;
  appType: DeveloperAppType;
  distribution: DeveloperAppDistribution;
  status: DeveloperAppStatus;
  requestedScopes: readonly string[];
  ownerCompanyId: string | null;
  ownerName: string;
  supportEmail: string | null;
  homepageUrl: string | null;
  submittedAt: string | null;
  installCount: number;
}

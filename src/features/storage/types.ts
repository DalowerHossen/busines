// src/features/storage/types.ts
// The shapes the platform storage screen works with.

export interface StorageTargetSummary {
  targetId: string;
  companyId: string | null;
  name: string;
  provider: string;
  isDefault: boolean;
  isActive: boolean;
  bucketName: string;
  region: string | null;
  endpointUrl: string | null;
  pathPrefix: string | null;
  publicBaseUrl: string | null;
  forcePathStyle: boolean;
  signedUrlTtlSeconds: number;
  maxUploadBytes: number;
  hasCredentials: boolean;
  credentialsFingerprint: string | null;
  lastUsedAt: string | null;
  lastVerifiedAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  fileCount: number;
  storedBytes: number;
}

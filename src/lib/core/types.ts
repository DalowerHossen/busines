import type { AccountRole } from '@/types/auth';

export type SearchEntityType =
  | 'client'
  | 'company'
  | 'invoice'
  | 'estimate'
  | 'payment'
  | 'expense'
  | 'project'
  | 'support_ticket';

export interface SearchDocument {
  readonly id: string;
  readonly companyId: string | null;
  readonly entityType: SearchEntityType;
  readonly title: string;
  readonly subtitle: string | null;
  readonly searchText: string;
  readonly href: string;
  readonly updatedAt: string;
}

export interface SearchActor {
  readonly userId: string;
  readonly role: AccountRole;
  readonly companyIds: readonly string[];
}

export interface SearchResult extends SearchDocument {
  readonly score: number;
  readonly matchedFields: readonly ('title' | 'subtitle' | 'search_text')[];
}

export interface BackupEntityCollection {
  readonly entityType: string;
  readonly rows: readonly Readonly<Record<string, unknown>>[];
}

export interface JsonBackupPayload {
  readonly artifactType: 'tenant-json-backup' | 'platform-json-backup';
  readonly schemaVersion: string;
  readonly companyId: string | null;
  readonly generatedAt: string;
  readonly collections: readonly BackupEntityCollection[];
  readonly redactedFieldNames: readonly string[];
}

export interface BackupArtifact {
  readonly companyId: string | null;
  readonly schemaVersion: string;
  readonly generatedAt: string;
  readonly keyVersion: string;
  readonly contentSha256: string;
  readonly encryptedContent: Uint8Array;
  readonly sizeBytes: number;
}

export interface BackupCipher {
  encrypt(input: {
    readonly plaintext: Uint8Array;
    readonly keyVersion: string;
  }): Promise<Uint8Array>;
  decrypt(input: {
    readonly ciphertext: Uint8Array;
    readonly keyVersion: string;
  }): Promise<Uint8Array>;
}

export interface BackupArtifactStore {
  save(input: BackupArtifact): Promise<BackupArtifact>;
  load(input: {
    readonly companyId: string | null;
    readonly contentSha256: string;
  }): Promise<BackupArtifact>;
}

export interface ExchangeRateSnapshot {
  readonly baseCurrencyCode: string;
  readonly quoteCurrencyCode: string;
  readonly rate: string;
  readonly source: string;
  readonly effectiveAt: string;
  readonly fetchedAt: string;
}

export interface ExchangeRateProvider {
  readonly providerId: string;
  fetchRate(input: {
    readonly baseCurrencyCode: string;
    readonly quoteCurrencyCode: string;
    readonly asOf: string;
  }): Promise<ExchangeRateSnapshot>;
}

export interface ExchangeRateStore {
  findLatest(input: {
    readonly baseCurrencyCode: string;
    readonly quoteCurrencyCode: string;
    readonly asOf: string;
    readonly source?: string;
  }): Promise<ExchangeRateSnapshot | null>;
  append(input: ExchangeRateSnapshot): Promise<ExchangeRateSnapshot>;
}

export interface ImpersonationSession {
  readonly sessionId: string;
  readonly actorUserId: string;
  readonly targetUserId: string;
  readonly companyId: string;
  readonly reason: string;
  readonly readOnly: true;
  readonly consentAcceptedAt: string;
  readonly startedAt: string;
  readonly expiresAt: string;
  readonly endedAt: string | null;
}

export interface ImpersonationAuditEvent {
  readonly sessionId: string;
  readonly actorUserId: string;
  readonly targetUserId: string;
  readonly companyId: string;
  readonly action: 'started' | 'stopped' | 'expired' | 'blocked_mutation';
  readonly occurredAt: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface ImpersonationAuditStore {
  append(input: ImpersonationAuditEvent): Promise<void>;
}

export interface FeatureFlagDefinition {
  readonly key: string;
  readonly enabled: boolean;
  readonly rolloutPercentage: number;
  readonly allowedCompanyIds: readonly string[];
  readonly effectiveFrom?: string;
  readonly effectiveUntil?: string;
}

export interface PlanEntitlement {
  readonly featureKey: string;
  readonly enabled: boolean;
  readonly limit: number | null;
}

export interface EntitlementContext {
  readonly companyId: string;
  readonly role: AccountRole;
  readonly subscriptionStatus:
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'cancelled'
    | 'downgraded_to_free';
  readonly featureFlags: readonly FeatureFlagDefinition[];
  readonly planEntitlements: readonly PlanEntitlement[];
  readonly bypassFeatureFlag: boolean;
}

export type EntitlementDenialReason =
  | 'feature_flag_disabled'
  | 'plan_not_entitled'
  | 'subscription_inactive'
  | 'usage_limit_exceeded';

export interface EntitlementDecision {
  readonly featureKey: string;
  readonly allowed: boolean;
  readonly reason: EntitlementDenialReason | null;
  readonly limit: number | null;
  readonly remaining: number | null;
}

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'retrying' | 'failed' | 'cancelled';

export interface JobRecord {
  readonly id: string;
  readonly companyId: string | null;
  readonly jobType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly idempotencyKey: string;
  readonly status: JobStatus;
  readonly runAt: string;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly lastErrorCode: string | null;
}

export interface JobQueueStore {
  claimNext(input: {
    readonly now: string;
    readonly leaseSeconds: number;
  }): Promise<JobClaim | null>;
  findByIdempotency(input: {
    readonly companyId: string | null;
    readonly idempotencyKey: string;
  }): Promise<JobRecord | null>;
  enqueue(input: JobRecord): Promise<JobRecord>;
  markSucceeded(input: { readonly jobId: string }): Promise<void>;
  markRetrying(input: {
    readonly jobId: string;
    readonly runAt: string;
    readonly errorCode: string;
  }): Promise<void>;
  markFailed(input: { readonly jobId: string; readonly errorCode: string }): Promise<void>;
}

export interface JobClaim {
  readonly job: JobRecord;
  readonly leaseToken: string;
}

export interface JobHandler {
  run(input: { readonly job: JobRecord; readonly leaseToken: string }): Promise<void>;
}

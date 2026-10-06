import assert from 'node:assert/strict';
import {
  CoreDomainError,
  JobExecutionError,
  assertEntitled,
  buildJsonBackupPayload,
  calculateRetryAt,
  claimAndRunNextJob,
  convertAmount,
  createEncryptedBackup,
  enqueueJob,
  evaluateEntitlement,
  fetchAndStoreExchangeRate,
  rejectImpersonatedMutation,
  resolveExchangeRate,
  restoreEncryptedBackup,
  runClaimedJob,
  searchGlobalDocuments,
  startImpersonation,
  stopImpersonation,
} from '@/lib/core';
import type {
  BackupArtifact,
  ExchangeRateSnapshot,
  ImpersonationSession,
  JobClaim,
  JobRecord,
} from '@/lib/core';

const companyId = 'company-1';

async function main(): Promise<void> {
  const documents = [
    {
      id: 'invoice-1',
      companyId,
      entityType: 'invoice' as const,
      title: 'Invoice INV-100',
      subtitle: 'Acme client',
      searchText: 'unpaid invoice',
      href: '/invoices/invoice-1',
      updatedAt: '2026-10-06T00:00:00Z',
    },
    {
      id: 'invoice-2',
      companyId: 'company-2',
      entityType: 'invoice' as const,
      title: 'Invoice INV-200',
      subtitle: 'Other tenant',
      searchText: 'unpaid invoice',
      href: '/invoices/invoice-2',
      updatedAt: '2026-10-06T00:00:00Z',
    },
  ];
  assert.equal(
    searchGlobalDocuments({
      actor: { userId: 'owner-1', role: 'owner', companyIds: [companyId] },
      query: 'INV-100',
      documents,
      scope: { type: 'tenant', companyId },
    })[0]?.id,
    'invoice-1'
  );
  assert.throws(() =>
    searchGlobalDocuments({
      actor: { userId: 'owner-1', role: 'owner', companyIds: [companyId] },
      query: 'invoice',
      documents,
      scope: { type: 'platform' },
    })
  );
  assert.equal(
    searchGlobalDocuments({
      actor: { userId: 'admin-1', role: 'super_admin', companyIds: [] },
      query: 'invoice',
      documents,
      scope: { type: 'platform' },
    }).length,
    2
  );

  const payload = buildJsonBackupPayload({
    companyId,
    schemaVersion: '2026-10-06.1',
    generatedAt: '2026-10-06T00:00:00Z',
    collections: [
      {
        entityType: 'users',
        rows: [
          {
            id: 'user-1',
            name: 'Owner',
            api_key: 'must-not-export',
            profile: { card_number: '4111111111111111' },
          },
        ],
      },
    ],
  });
  assert.equal(payload.collections[0]?.rows[0]?.api_key, undefined);
  assert.equal(payload.redactedFieldNames.includes('api_key'), true);
  let savedArtifact: BackupArtifact | null = null;
  const cipher = {
    async encrypt(input: { plaintext: Uint8Array }) {
      return Uint8Array.from(input.plaintext, (byte) => byte ^ 0xaa);
    },
    async decrypt(input: { ciphertext: Uint8Array }) {
      return Uint8Array.from(input.ciphertext, (byte) => byte ^ 0xaa);
    },
  };
  const backup = await createEncryptedBackup({
    payload,
    keyVersion: 'backup-key-1',
    cipher,
    store: {
      async save(input) {
        savedArtifact = input;
        return input;
      },
      async load() {
        if (!savedArtifact) throw new Error('Backup artifact was not saved.');
        return savedArtifact;
      },
    },
  });
  assert.equal(backup.sizeBytes > 0, true);
  const restored = await restoreEncryptedBackup({
    artifact: backup,
    expectedCompanyId: companyId,
    cipher,
  });
  assert.deepEqual(restored, payload);

  const rateSnapshot: ExchangeRateSnapshot = {
    baseCurrencyCode: 'USD',
    quoteCurrencyCode: 'BDT',
    rate: '110.250000000000',
    source: 'official-rate-provider',
    effectiveAt: '2026-10-06T00:00:00Z',
    fetchedAt: '2026-10-06T00:01:00Z',
  };
  const rates: ExchangeRateSnapshot[] = [];
  const rateStore = {
    async append(input: ExchangeRateSnapshot) {
      rates.push(input);
      return input;
    },
    async findLatest() {
      return rates[0] ?? null;
    },
  };
  await fetchAndStoreExchangeRate({
    provider: {
      providerId: 'official-rate-provider',
      async fetchRate() {
        return rateSnapshot;
      },
    },
    store: rateStore,
    baseCurrencyCode: 'USD',
    quoteCurrencyCode: 'BDT',
    asOf: '2026-10-06T00:02:00Z',
  });
  assert.equal(convertAmount({ amount: '2.00', rate: rateSnapshot.rate }), '220.5000');
  assert.equal(
    (
      await resolveExchangeRate({
        store: rateStore,
        baseCurrencyCode: 'USD',
        quoteCurrencyCode: 'BDT',
        asOf: '2026-10-06T00:02:00Z',
      })
    ).rate,
    '110.250000000000'
  );
  assert.equal(
    (
      await resolveExchangeRate({
        store: rateStore,
        baseCurrencyCode: 'USD',
        quoteCurrencyCode: 'USD',
        asOf: '2026-10-06T00:02:00Z',
      })
    ).rate,
    '1.000000000000'
  );

  const auditActions: string[] = [];
  const impersonationStore = {
    async create(input: { session: ImpersonationSession; audit: { action: string } }) {
      auditActions.push(input.audit.action);
      return input.session;
    },
    async end(input: { session: ImpersonationSession; audit: { action: string } }) {
      auditActions.push(input.audit.action);
      return input.session;
    },
  };
  const session = await startImpersonation({
    sessionId: 'impersonation-1',
    actorUserId: 'admin-1',
    actorRole: 'super_admin',
    targetUserId: 'owner-1',
    companyId,
    reason: 'Support investigation',
    consentAcceptedAt: '2026-10-06T00:00:00Z',
    startedAt: '2026-10-06T00:00:00Z',
    maxDurationSeconds: 600,
    store: impersonationStore,
  });
  assert.equal(session.readOnly, true);
  await assert.rejects(
    () =>
      rejectImpersonatedMutation({
        session,
        now: '2026-10-06T00:01:00Z',
        store: {
          async append(input) {
            auditActions.push(input.action);
          },
        },
      }),
    (error: unknown) => error instanceof CoreDomainError
  );
  const endedSession = await stopImpersonation({
    session,
    now: '2026-10-06T00:02:00Z',
    store: impersonationStore,
  });
  assert.deepEqual(auditActions, ['started', 'blocked_mutation', 'stopped']);
  assert.equal(endedSession.endedAt, '2026-10-06T00:02:00.000Z');

  const entitlementContext = {
    companyId,
    role: 'owner' as const,
    subscriptionStatus: 'active' as const,
    featureFlags: [
      { key: 'advanced_reports', enabled: true, rolloutPercentage: 100, allowedCompanyIds: [] },
    ],
    planEntitlements: [{ featureKey: 'advanced_reports', enabled: true, limit: 3 }],
    bypassFeatureFlag: false,
  };
  assert.equal(
    assertEntitled({
      featureKey: 'advanced_reports',
      context: entitlementContext,
      currentUsage: 1,
      requestedUnits: 1,
      now: '2026-10-06T00:00:00Z',
    }).remaining,
    1
  );
  assert.equal(
    evaluateEntitlement({
      featureKey: 'advanced_reports',
      context: entitlementContext,
      currentUsage: 3,
      now: '2026-10-06T00:00:00Z',
    }).reason,
    'usage_limit_exceeded'
  );

  const jobs: JobRecord[] = [];
  const retryUpdates: string[] = [];
  const queueStore = {
    async claimNext() {
      const job = jobs.find(
        (candidate) => candidate.status === 'queued' || candidate.status === 'retrying'
      );
      if (!job) return null;
      const claim: JobClaim = {
        job: { ...job, status: 'running', attemptCount: job.attemptCount + 1 },
        leaseToken: 'lease-1',
      };
      return claim;
    },
    async findByIdempotency(input: { companyId: string | null; idempotencyKey: string }) {
      return (
        jobs.find(
          (job) => job.companyId === input.companyId && job.idempotencyKey === input.idempotencyKey
        ) ?? null
      );
    },
    async enqueue(input: JobRecord) {
      jobs.push(input);
      return input;
    },
    async markSucceeded(input: { jobId: string }) {
      retryUpdates.push(`${input.jobId}:succeeded`);
    },
    async markRetrying(input: { jobId: string; runAt: string; errorCode: string }) {
      retryUpdates.push(`${input.jobId}:retrying:${input.errorCode}`);
    },
    async markFailed(input: { jobId: string; errorCode: string }) {
      retryUpdates.push(`${input.jobId}:failed:${input.errorCode}`);
    },
  };
  const queued = await enqueueJob({
    job: {
      id: 'job-1',
      companyId,
      jobType: 'reports.generate',
      payload: { reportId: 'report-1' },
      idempotencyKey: 'job-key-1',
      runAt: '2026-10-06T00:00:00Z',
      maxAttempts: 2,
    },
    store: queueStore,
  });
  assert.equal(queued.duplicate, false);
  const duplicate = await enqueueJob({
    job: {
      id: 'job-1',
      companyId,
      jobType: 'reports.generate',
      payload: { reportId: 'report-1' },
      idempotencyKey: 'job-key-1',
      runAt: '2026-10-06T00:00:00Z',
      maxAttempts: 2,
    },
    store: queueStore,
  });
  assert.equal(duplicate.duplicate, true);
  const retryResult = await claimAndRunNextJob({
    store: queueStore,
    now: '2026-10-06T00:00:00Z',
    leaseSeconds: 60,
    handlers: {
      'reports.generate': {
        async run() {
          throw new JobExecutionError('provider_timeout', true);
        },
      },
    },
  });
  assert.equal(retryResult?.status, 'retrying');
  assert.equal(calculateRetryAt('2026-10-06T00:00:00Z', 1), '2026-10-06T00:00:30.000Z');
  const successResult = await runClaimedJob({
    claim: {
      job: { ...queued.job, status: 'running', attemptCount: 1, lastErrorCode: null },
      leaseToken: 'lease-2',
    },
    store: queueStore,
    handlers: { 'reports.generate': { async run() {} } },
    now: '2026-10-06T00:01:00Z',
  });
  assert.equal(successResult.status, 'succeeded');

  process.stdout.write(
    'Search, backup, exchange, impersonation, entitlement, and job-queue smoke test passed.\n'
  );
}

main().catch((error: unknown) => {
  process.stderr.write(error instanceof Error ? `${error.message}\n` : 'Core smoke test failed.\n');
  process.exitCode = 1;
});

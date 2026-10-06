import { CoreDomainError, duplicateJob, invalidCoreRequest } from './errors';
import type { JobClaim, JobHandler, JobQueueStore, JobRecord } from './types';

const FORBIDDEN_JOB_KEYS = new Set([
  'password',
  'secret',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'raw_body',
  'private_key',
  'api_key',
  'card_number',
  'cvv',
  'cvc',
]);

export class JobExecutionError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, retryable: boolean) {
    super('Background job execution failed.');
    this.name = 'JobExecutionError';
    this.code = code;
    this.retryable = retryable;
  }
}

export async function enqueueJob(input: {
  readonly job: Omit<JobRecord, 'status' | 'attemptCount' | 'lastErrorCode'>;
  readonly store: JobQueueStore;
}): Promise<{ readonly job: JobRecord; readonly duplicate: boolean }> {
  validateJobInput(input.job);
  const existing = await input.store.findByIdempotency({
    companyId: input.job.companyId,
    idempotencyKey: input.job.idempotencyKey,
  });
  if (existing) return { job: existing, duplicate: true };
  const job: JobRecord = {
    ...input.job,
    status: 'queued',
    attemptCount: 0,
    lastErrorCode: null,
  };
  try {
    return { job: await input.store.enqueue(job), duplicate: false };
  } catch (error) {
    if (error instanceof CoreDomainError && error.code === 'duplicate_job') throw error;
    throw duplicateJob();
  }
}

export async function claimAndRunNextJob(input: {
  readonly store: JobQueueStore;
  readonly now: string;
  readonly leaseSeconds: number;
  readonly handlers: Readonly<Record<string, JobHandler>>;
}): Promise<JobRunResult | null> {
  if (
    !Number.isFinite(Date.parse(input.now)) ||
    !Number.isSafeInteger(input.leaseSeconds) ||
    input.leaseSeconds < 1 ||
    input.leaseSeconds > 3600
  ) {
    throw invalidCoreRequest();
  }
  const claim = await input.store.claimNext({ now: input.now, leaseSeconds: input.leaseSeconds });
  if (!claim) return null;
  return runClaimedJob({ claim, store: input.store, handlers: input.handlers, now: input.now });
}

export interface JobRunResult {
  readonly jobId: string;
  readonly status: 'succeeded' | 'retrying' | 'failed';
  readonly errorCode: string | null;
  readonly nextRunAt: string | null;
}

export async function runClaimedJob(input: {
  readonly claim: JobClaim;
  readonly store: JobQueueStore;
  readonly handlers: Readonly<Record<string, JobHandler>>;
  readonly now: string;
}): Promise<JobRunResult> {
  const { job } = input.claim;
  if (!job.id.trim() || job.status !== 'running' || !input.claim.leaseToken.trim()) {
    throw invalidCoreRequest();
  }
  const handler = input.handlers[job.jobType];
  if (!handler) {
    await input.store.markFailed({ jobId: job.id, errorCode: 'handler_not_registered' });
    return {
      jobId: job.id,
      status: 'failed',
      errorCode: 'handler_not_registered',
      nextRunAt: null,
    };
  }
  try {
    await handler.run({ job, leaseToken: input.claim.leaseToken });
    await input.store.markSucceeded({ jobId: job.id });
    return { jobId: job.id, status: 'succeeded', errorCode: null, nextRunAt: null };
  } catch (error) {
    const failure = normalizeJobFailure(error);
    const nextAttempt = job.attemptCount + 1;
    if (failure.retryable && job.attemptCount < job.maxAttempts) {
      const nextRunAt = calculateRetryAt(input.now, nextAttempt);
      await input.store.markRetrying({ jobId: job.id, runAt: nextRunAt, errorCode: failure.code });
      return { jobId: job.id, status: 'retrying', errorCode: failure.code, nextRunAt };
    }
    await input.store.markFailed({ jobId: job.id, errorCode: failure.code });
    return { jobId: job.id, status: 'failed', errorCode: failure.code, nextRunAt: null };
  }
}

export function calculateRetryAt(now: string, attemptNumber: number): string {
  if (
    !Number.isFinite(Date.parse(now)) ||
    !Number.isSafeInteger(attemptNumber) ||
    attemptNumber < 1 ||
    attemptNumber > 20
  ) {
    throw invalidCoreRequest();
  }
  const delaySeconds = Math.min(86_400, 30 * 2 ** (attemptNumber - 1));
  return new Date(Date.parse(now) + delaySeconds * 1000).toISOString();
}

function validateJobInput(job: Omit<JobRecord, 'status' | 'attemptCount' | 'lastErrorCode'>): void {
  if (
    !job.id.trim() ||
    (job.companyId !== null && !job.companyId.trim()) ||
    !/^[a-z][a-z0-9_.-]{1,127}$/u.test(job.jobType) ||
    !job.idempotencyKey.trim() ||
    !Number.isFinite(Date.parse(job.runAt)) ||
    !Number.isSafeInteger(job.maxAttempts) ||
    job.maxAttempts < 1 ||
    job.maxAttempts > 20
  ) {
    throw invalidCoreRequest();
  }
  assertSafeJobValue(job.payload);
}

function assertSafeJobValue(value: unknown, key = ''): void {
  if (key && FORBIDDEN_JOB_KEYS.has(key.toLowerCase())) throw invalidCoreRequest();
  if (Array.isArray(value)) {
    value.forEach((item) => assertSafeJobValue(item));
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [nestedKey, nestedValue] of Object.entries(value)) {
    assertSafeJobValue(nestedValue, nestedKey);
  }
}

function normalizeJobFailure(error: unknown): {
  readonly code: string;
  readonly retryable: boolean;
} {
  if (error instanceof JobExecutionError) {
    return {
      code: error.code.replace(/[^a-z0-9_.-]/giu, '').slice(0, 64) || 'job_failed',
      retryable: error.retryable,
    };
  }
  return { code: 'job_failed', retryable: false };
}

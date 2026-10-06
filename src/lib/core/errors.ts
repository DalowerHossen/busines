export type CoreErrorCode =
  | 'invalid_request'
  | 'tenant_scope_denied'
  | 'backup_integrity_failed'
  | 'backup_cipher_failed'
  | 'exchange_rate_unavailable'
  | 'impersonation_denied'
  | 'impersonation_expired'
  | 'feature_disabled'
  | 'usage_limit_exceeded'
  | 'duplicate_job'
  | 'job_not_retryable';

export class CoreDomainError extends Error {
  readonly code: CoreErrorCode;
  readonly retryable: boolean;

  constructor(code: CoreErrorCode, retryable = false) {
    super('Platform operation could not be completed.');
    this.name = 'CoreDomainError';
    this.code = code;
    this.retryable = retryable;
  }
}

export function invalidCoreRequest(): CoreDomainError {
  return new CoreDomainError('invalid_request');
}

export function tenantScopeDenied(): CoreDomainError {
  return new CoreDomainError('tenant_scope_denied');
}

export function backupIntegrityFailed(): CoreDomainError {
  return new CoreDomainError('backup_integrity_failed');
}

export function backupCipherFailed(retryable = false): CoreDomainError {
  return new CoreDomainError('backup_cipher_failed', retryable);
}

export function exchangeRateUnavailable(): CoreDomainError {
  return new CoreDomainError('exchange_rate_unavailable', true);
}

export function impersonationDenied(): CoreDomainError {
  return new CoreDomainError('impersonation_denied');
}

export function impersonationExpired(): CoreDomainError {
  return new CoreDomainError('impersonation_expired');
}

export function featureDisabled(): CoreDomainError {
  return new CoreDomainError('feature_disabled');
}

export function usageLimitExceeded(): CoreDomainError {
  return new CoreDomainError('usage_limit_exceeded');
}

export function duplicateJob(): CoreDomainError {
  return new CoreDomainError('duplicate_job');
}

export function jobNotRetryable(): CoreDomainError {
  return new CoreDomainError('job_not_retryable');
}

// src/lib/storage/errors.ts
export type StorageErrorCode =
  | 'invalid_configuration'
  | 'invalid_request'
  | 'provider_request_failed'
  | 'provider_response_invalid'
  | 'tenant_scope_denied'
  | 'unsupported_provider';

export class StorageProviderError extends Error {
  readonly provider: string;
  readonly code: StorageErrorCode;
  readonly statusCode: number | null;
  readonly retryable: boolean;

  constructor(
    provider: string,
    code: StorageErrorCode,
    statusCode: number | null = null,
    retryable = false
  ) {
    super('Storage operation could not be completed.');
    this.name = 'StorageProviderError';
    this.provider = provider;
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export function storageInvalidRequest(): StorageProviderError {
  return new StorageProviderError('storage', 'invalid_request', 400, false);
}

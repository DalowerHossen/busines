export type SecurityErrorCode =
  | 'invalid_configuration'
  | 'invalid_request'
  | 'provider_request_failed'
  | 'invalid_provider_response'
  | 'rate_limit_store_unavailable';

export class SecurityProviderError extends Error {
  readonly provider: string;
  readonly code: SecurityErrorCode;
  readonly statusCode: number | null;
  readonly retryable: boolean;

  constructor(
    provider: string,
    code: SecurityErrorCode,
    statusCode: number | null,
    retryable: boolean
  ) {
    super('Security provider request failed.');
    this.name = 'SecurityProviderError';
    this.provider = provider;
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export function securityInvalidRequest(): SecurityProviderError {
  return new SecurityProviderError('security', 'invalid_request', 400, false);
}

export function securityInvalidConfiguration(): SecurityProviderError {
  return new SecurityProviderError('security', 'invalid_configuration', null, false);
}

export function securityInvalidProviderResponse(
  provider: string,
  statusCode: number | null = null
): SecurityProviderError {
  return new SecurityProviderError(provider, 'invalid_provider_response', statusCode, false);
}

export function securityRetryableStatus(statusCode: number): boolean {
  return (
    statusCode === 408 ||
    statusCode === 409 ||
    statusCode === 425 ||
    statusCode === 429 ||
    statusCode >= 500
  );
}

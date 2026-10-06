export type EcommerceErrorCode =
  | 'invalid_configuration'
  | 'invalid_request'
  | 'invalid_response'
  | 'provider_request_failed'
  | 'provider_rejected'
  | 'signature_invalid'
  | 'duplicate_event';

export class EcommerceProviderError extends Error {
  readonly provider: string;
  readonly code: EcommerceErrorCode;
  readonly statusCode: number | null;
  readonly retryable: boolean;

  constructor(
    provider: string,
    code: EcommerceErrorCode,
    statusCode: number | null,
    retryable: boolean
  ) {
    super('Ecommerce provider request failed.');
    this.name = 'EcommerceProviderError';
    this.provider = provider;
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export function retryableStatus(statusCode: number): boolean {
  return (
    statusCode === 408 ||
    statusCode === 409 ||
    statusCode === 425 ||
    statusCode === 429 ||
    statusCode >= 500
  );
}

export function invalidConfiguration(provider: string): EcommerceProviderError {
  return new EcommerceProviderError(provider, 'invalid_configuration', null, false);
}

export function invalidRequest(provider: string): EcommerceProviderError {
  return new EcommerceProviderError(provider, 'invalid_request', null, false);
}

export function invalidResponse(
  provider: string,
  statusCode: number | null = null
): EcommerceProviderError {
  return new EcommerceProviderError(provider, 'invalid_response', statusCode, false);
}

export function signatureInvalid(provider: string): EcommerceProviderError {
  return new EcommerceProviderError(provider, 'signature_invalid', 401, false);
}

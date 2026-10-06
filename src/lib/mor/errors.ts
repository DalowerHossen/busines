export type MorErrorCode =
  | 'invalid_request'
  | 'invalid_state'
  | 'kyc_required'
  | 'mor_not_eligible'
  | 'insufficient_balance'
  | 'duplicate_request'
  | 'provider_unavailable';

export class MorComplianceError extends Error {
  readonly code: MorErrorCode;
  readonly retryable: boolean;

  constructor(code: MorErrorCode, retryable = false) {
    super('Merchant settlement request could not be completed.');
    this.name = 'MorComplianceError';
    this.code = code;
    this.retryable = retryable;
  }
}

export function invalidMorRequest(): MorComplianceError {
  return new MorComplianceError('invalid_request');
}

export function invalidMorState(): MorComplianceError {
  return new MorComplianceError('invalid_state');
}

export function kycRequired(): MorComplianceError {
  return new MorComplianceError('kyc_required');
}

export function morNotEligible(): MorComplianceError {
  return new MorComplianceError('mor_not_eligible');
}

export function insufficientBalance(): MorComplianceError {
  return new MorComplianceError('insufficient_balance');
}

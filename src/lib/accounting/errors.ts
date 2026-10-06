export type AccountingErrorCode =
  | 'invalid_request'
  | 'unbalanced_entry'
  | 'period_locked'
  | 'account_unavailable'
  | 'already_reconciled'
  | 'ambiguous_match'
  | 'duplicate_receipt'
  | 'ocr_unavailable';

export class AccountingError extends Error {
  readonly code: AccountingErrorCode;
  readonly retryable: boolean;

  constructor(code: AccountingErrorCode, retryable = false) {
    super('Accounting request could not be completed.');
    this.name = 'AccountingError';
    this.code = code;
    this.retryable = retryable;
  }
}

export function invalidAccountingRequest(): AccountingError {
  return new AccountingError('invalid_request');
}

export function unbalancedJournalEntry(): AccountingError {
  return new AccountingError('unbalanced_entry');
}

export function accountingPeriodLocked(): AccountingError {
  return new AccountingError('period_locked');
}

export function accountUnavailable(): AccountingError {
  return new AccountingError('account_unavailable');
}

export function alreadyReconciled(): AccountingError {
  return new AccountingError('already_reconciled');
}

export function ambiguousBankMatch(): AccountingError {
  return new AccountingError('ambiguous_match');
}

export function duplicateReceipt(): AccountingError {
  return new AccountingError('duplicate_receipt');
}

export function ocrUnavailable(retryable = true): AccountingError {
  return new AccountingError('ocr_unavailable', retryable);
}

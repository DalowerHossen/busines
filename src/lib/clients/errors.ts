export type ClientErrorCode =
  | 'invalid_request'
  | 'tenant_scope_denied'
  | 'client_not_found'
  | 'duplicate_client'
  | 'merge_conflict'
  | 'import_failed'
  | 'export_failed';

export class ClientDomainError extends Error {
  readonly code: ClientErrorCode;
  readonly retryable: boolean;

  constructor(code: ClientErrorCode, retryable = false) {
    super('Client operation could not be completed.');
    this.name = 'ClientDomainError';
    this.code = code;
    this.retryable = retryable;
  }
}

export function invalidClientRequest(): ClientDomainError {
  return new ClientDomainError('invalid_request');
}

export function clientTenantScopeDenied(): ClientDomainError {
  return new ClientDomainError('tenant_scope_denied');
}

export function clientNotFound(): ClientDomainError {
  return new ClientDomainError('client_not_found');
}

export function duplicateClient(): ClientDomainError {
  return new ClientDomainError('duplicate_client');
}

export function clientMergeConflict(): ClientDomainError {
  return new ClientDomainError('merge_conflict');
}

export function clientImportFailed(): ClientDomainError {
  return new ClientDomainError('import_failed');
}

export function clientExportFailed(): ClientDomainError {
  return new ClientDomainError('export_failed');
}

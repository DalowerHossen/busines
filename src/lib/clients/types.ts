import type { AccountRole, StaffPermission } from '@/types/auth';
import type { Client, ClientActivityEntry, ClientGroup, ClientTag } from '@/types/client';
import type { Money, UUID } from '@/types/core';

export type ClientEditableFields = Pick<
  Client,
  | 'displayName'
  | 'companyNameOnInvoice'
  | 'email'
  | 'phone'
  | 'billingAddress'
  | 'shippingAddress'
  | 'taxId'
  | 'defaultCurrency'
  | 'groupId'
  | 'tagIds'
  | 'notes'
>;

export interface ClientActor {
  readonly userId: string;
  readonly companyId: string;
  readonly role: AccountRole;
  readonly permissions?: readonly StaffPermission[];
}

export interface ClientListQuery {
  readonly companyId: string;
  readonly search?: string;
  readonly groupId?: string | null;
  readonly tagId?: string | null;
  readonly includeArchived?: boolean;
}

export interface ClientStore {
  list(input: ClientListQuery): Promise<readonly Client[]>;
  findById(input: {
    readonly companyId: string;
    readonly clientId: string;
  }): Promise<Client | null>;
  create(input: {
    readonly companyId: string;
    readonly data: ClientEditableFields;
  }): Promise<Client>;
  update(input: {
    readonly companyId: string;
    readonly clientId: string;
    readonly data: ClientEditableFields;
  }): Promise<Client>;
  archive(input: {
    readonly companyId: string;
    readonly clientId: string;
    readonly archived: boolean;
  }): Promise<Client>;
  merge(input: {
    readonly companyId: string;
    readonly sourceClientId: string;
    readonly targetClientId: string;
  }): Promise<Client>;
  createGroup(input: {
    readonly companyId: string;
    readonly name: string;
    readonly color: string | null;
  }): Promise<ClientGroup>;
  createTag(input: {
    readonly companyId: string;
    readonly name: string;
    readonly color: string | null;
  }): Promise<ClientTag>;
}

export interface DuplicateMatchGroup {
  readonly clientIds: readonly UUID[];
  readonly matchReasons: readonly ('email' | 'phone' | 'display_name')[];
}

export interface ClientStatementInvoice {
  readonly id: string;
  readonly clientId: string;
  readonly invoiceNumber: string;
  readonly issuedAt: string;
  readonly total: Money;
}

export interface ClientStatementPayment {
  readonly id: string;
  readonly clientId: string;
  readonly reference: string;
  readonly paidAt: string;
  readonly amount: Money;
}

export interface ClientStatementCredit {
  readonly id: string;
  readonly clientId: string;
  readonly reference: string;
  readonly issuedAt: string;
  readonly amount: Money;
}

export interface ClientStatementRow {
  readonly id: string;
  readonly occurredAt: string;
  readonly type: 'invoice' | 'payment' | 'credit';
  readonly reference: string;
  readonly description: string;
  readonly amount: Money;
  readonly balance: Money;
}

export interface ClientStatement {
  readonly clientId: string;
  readonly currency: string;
  readonly openingBalance: Money;
  readonly rows: readonly ClientStatementRow[];
  readonly totalInvoiced: Money;
  readonly totalPaid: Money;
  readonly totalCredits: Money;
  readonly closingBalance: Money;
}

export interface ClientTimeline {
  readonly clientId: string;
  readonly entries: readonly ClientActivityEntry[];
}

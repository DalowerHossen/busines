// src/types/client.ts
// Client (CRM) domain types. An invoice/estimate only stores a frozen
// InvoiceClientSnapshot (see src/types/invoice.ts); this file models the
// live, editable client record that snapshot is taken from.
import type { Address, ISODateString, Money, TenantScopedEntity, UUID } from '@/types/core';

/**
 * A client (customer) of a company. Clients never hold a platform account;
 * they are reached only through tokenized links (see ClientAccessToken in
 * src/types/invoice.ts).
 */
export interface Client extends TenantScopedEntity {
  readonly displayName: string;
  readonly companyNameOnInvoice: string | null;
  readonly email: string;
  readonly phone: string | null;
  readonly billingAddress: Address | null;
  readonly shippingAddress: Address | null;
  readonly taxId: string | null;
  readonly defaultCurrency: string;
  readonly groupId: UUID | null;
  readonly tagIds: readonly UUID[];
  readonly notes: string | null;
  readonly isArchived: boolean;
}

/**
 * A named grouping of clients (for example "Wholesale" or "VIP"), used for
 * filtering and bulk actions.
 */
export interface ClientGroup extends TenantScopedEntity {
  readonly name: string;
  readonly color: string | null;
}

/**
 * A free-form label attachable to one or more clients, distinct from a
 * {@link ClientGroup} which a client can only belong to one of at a time.
 */
export interface ClientTag extends TenantScopedEntity {
  readonly name: string;
  readonly color: string | null;
}

/**
 * A scheduled follow-up reminder tied to a client (for example "call about
 * renewal").
 */
export interface ClientReminder extends TenantScopedEntity {
  readonly clientId: UUID;
  readonly assignedToUserId: UUID;
  readonly title: string;
  readonly dueAt: ISODateString;
  readonly isCompleted: boolean;
}

/**
 * A private, internal note left on a client record, never visible to the
 * client themselves.
 */
export interface ClientNote extends TenantScopedEntity {
  readonly clientId: UUID;
  readonly authorUserId: UUID;
  readonly body: string;
}

/**
 * A file attached to a client record (for example a signed contract),
 * stored through the configured storage provider.
 */
export interface ClientAttachment extends TenantScopedEntity {
  readonly clientId: UUID;
  readonly providerFileId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeInBytes: number;
}

/**
 * The reason a client's prepaid credit balance changed. `manual_adjustment`
 * covers corrections made by the owner or an accountant.
 */
export type ClientCreditBalanceReason =
  | 'overpayment'
  | 'credit_note_issued'
  | 'applied_to_invoice'
  | 'manual_adjustment'
  | 'refund_issued';

/**
 * One ledger entry in a client's prepaid credit balance history. The
 * client's current balance is the running sum of every entry's `amount`
 * (positive entries increase the balance, negative entries decrease it).
 */
export interface ClientCreditBalanceEntry extends TenantScopedEntity {
  readonly clientId: UUID;
  readonly reason: ClientCreditBalanceReason;
  readonly amount: Money;
  readonly relatedInvoiceId: UUID | null;
  readonly note: string | null;
}

/**
 * One entry in a client's activity timeline (invoice sent, payment
 * received, email opened, and similar), used to render the client
 * activity timeline feature.
 */
export interface ClientActivityEntry {
  readonly id: UUID;
  readonly clientId: UUID;
  readonly type: string;
  readonly description: string;
  readonly occurredAt: ISODateString;
}

// src/features/clients/types.ts
// The shapes the client module works with. Database rows are narrowed into
// these once, in the mappers, so no component ever reads a raw column name.

import type { ClientStatus, ClientType, MessageChannel } from '@/types/enums';

export interface ClientSummary {
  id: string;
  clientNumber: string;
  displayName: string;
  clientType: ClientType;
  status: ClientStatus;
  email: string | null;
  phone: string | null;
  countryCode: string | null;
  billingCurrency: string | null;
  lastInvoicedAt: string | null;
  isArchived: boolean;
}

export interface ClientContactRecord {
  id: string;
  fullName: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  receivesInvoices: boolean;
  receivesReminders: boolean;
}

export interface ClientAddressRecord {
  id: string;
  addressType: 'billing' | 'shipping';
  label: string | null;
  attentionTo: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  countryCode: string;
  isDefault: boolean;
}

export interface ClientDetail extends ClientSummary {
  legalName: string | null;
  contactPerson: string | null;
  mobile: string | null;
  website: string | null;
  defaultPaymentTermsDays: number | null;
  creditLimit: string | null;
  lateFeePercentage: string | null;
  taxId: string | null;
  vatNumber: string | null;
  registrationNumber: string | null;
  isTaxExempt: boolean;
  taxExemptionReason: string | null;
  appliesReverseCharge: boolean;
  preferredContactChannel: MessageChannel;
  sendReminders: boolean;
  statementDeliveryEnabled: boolean;
  portalNotes: string | null;
  internalNotes: string | null;
  createdAt: string | null;
  contacts: ClientContactRecord[];
  addresses: ClientAddressRecord[];
}

export interface ClientListFilters {
  /** Free text matched against name, number, email and telephone. */
  search: string | null;
  /** Status to narrow by, or null for every active status. */
  status: ClientStatus | null;
  /** True to list clients that have been deleted. */
  includeDeleted: boolean;
}

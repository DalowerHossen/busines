// src/features/clients/mappers.ts
// Turning database rows into the client shapes the interface renders. Every
// unknown value is narrowed here, so the rest of the module is typed.

import type {
  ClientAddressRecord,
  ClientContactRecord,
  ClientDetail,
  ClientSummary,
} from '@/features/clients/types';
import { readAmount, readBoolean, readEnum, readNumber, readString } from '@/lib/records';
import type { DatabaseRow } from '@/types/database';
import { ADDRESS_TYPES, CLIENT_STATUSES, CLIENT_TYPES, MESSAGE_CHANNELS } from '@/types/enums';

/**
 * Maps one row of the client list.
 *
 * @param row Row read from public.clients.
 * @returns The client as the list renders it.
 */
export function toClientSummary(row: DatabaseRow): ClientSummary {
  return {
    id: readString(row, 'id') ?? '',
    clientNumber: readString(row, 'client_number') ?? '',
    displayName: readString(row, 'display_name') ?? '',
    clientType: readEnum(row, 'client_type', CLIENT_TYPES, 'business'),
    status: readEnum(row, 'status', CLIENT_STATUSES, 'active'),
    email: readString(row, 'email'),
    phone: readString(row, 'phone'),
    countryCode: readString(row, 'country_code'),
    billingCurrency: readString(row, 'billing_currency'),
    lastInvoicedAt: readString(row, 'last_invoiced_at'),
    isArchived: readString(row, 'deleted_at') !== null,
  };
}

/**
 * Maps one contact of a client.
 *
 * @param row Row read from public.client_contacts.
 * @returns The contact record.
 */
export function toClientContact(row: DatabaseRow): ClientContactRecord {
  return {
    id: readString(row, 'id') ?? '',
    fullName: readString(row, 'full_name') ?? '',
    jobTitle: readString(row, 'job_title'),
    email: readString(row, 'email'),
    phone: readString(row, 'phone') ?? readString(row, 'mobile'),
    isPrimary: readBoolean(row, 'is_primary'),
    receivesInvoices: readBoolean(row, 'receives_invoices', true),
    receivesReminders: readBoolean(row, 'receives_reminders', true),
  };
}

/**
 * Maps one address of a client.
 *
 * @param row Row read from public.client_addresses.
 * @returns The address record.
 */
export function toClientAddress(row: DatabaseRow): ClientAddressRecord {
  return {
    id: readString(row, 'id') ?? '',
    addressType: readEnum(row, 'address_type', ADDRESS_TYPES, 'billing'),
    label: readString(row, 'label'),
    attentionTo: readString(row, 'attention_to'),
    addressLine1: readString(row, 'address_line1') ?? '',
    addressLine2: readString(row, 'address_line2'),
    city: readString(row, 'city'),
    stateRegion: readString(row, 'state_region'),
    postalCode: readString(row, 'postal_code'),
    countryCode: readString(row, 'country_code') ?? 'US',
    isDefault: readBoolean(row, 'is_default'),
  };
}

/**
 * Maps the full client record shown on its own page.
 *
 * @param row Row read from public.clients.
 * @param contacts Contacts held against the client.
 * @param addresses Addresses held against the client.
 * @returns The client detail record.
 */
export function toClientDetail(
  row: DatabaseRow,
  contacts: readonly DatabaseRow[],
  addresses: readonly DatabaseRow[]
): ClientDetail {
  return {
    ...toClientSummary(row),
    legalName: readString(row, 'legal_name'),
    contactPerson: readString(row, 'contact_person'),
    mobile: readString(row, 'mobile'),
    website: readString(row, 'website'),
    defaultPaymentTermsDays: readNumber(row, 'default_payment_terms_days'),
    creditLimit: row['credit_limit'] === null ? null : readAmount(row, 'credit_limit'),
    lateFeePercentage:
      row['late_fee_percentage'] === null ? null : readAmount(row, 'late_fee_percentage'),
    taxId: readString(row, 'tax_id'),
    vatNumber: readString(row, 'vat_number'),
    registrationNumber: readString(row, 'registration_number'),
    isTaxExempt: readBoolean(row, 'is_tax_exempt'),
    taxExemptionReason: readString(row, 'tax_exemption_reason'),
    appliesReverseCharge: readBoolean(row, 'applies_reverse_charge'),
    preferredContactChannel: readEnum(row, 'preferred_contact_channel', MESSAGE_CHANNELS, 'email'),
    sendReminders: readBoolean(row, 'send_reminders', true),
    statementDeliveryEnabled: readBoolean(row, 'statement_delivery_enabled'),
    portalNotes: readString(row, 'portal_notes'),
    internalNotes: readString(row, 'internal_notes'),
    createdAt: readString(row, 'created_at'),
    contacts: contacts.map((contact) => toClientContact(contact)),
    addresses: addresses.map((address) => toClientAddress(address)),
  };
}

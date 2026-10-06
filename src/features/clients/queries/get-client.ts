// src/features/clients/queries/get-client.ts
// Reading one client with its contacts and addresses, and the small set of
// figures shown on the client page.

import { toClientDetail } from '@/features/clients/mappers';
import type { ClientDetail } from '@/features/clients/types';
import { logger } from '@/lib/logger';
import { addMoney, toStoredAmount } from '@/lib/money';
import { asRow, asRows, readAmount, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const CLIENT_COLUMNS =
  'id, client_number, display_name, client_type, status, email, phone, mobile, website, country_code, billing_currency, last_invoiced_at, deleted_at, legal_name, contact_person, default_payment_terms_days, credit_limit, late_fee_percentage, tax_id, vat_number, registration_number, is_tax_exempt, tax_exemption_reason, applies_reverse_charge, preferred_contact_channel, send_reminders, statement_delivery_enabled, portal_notes, internal_notes, created_at';

/**
 * Reads one client of a company.
 *
 * @param companyId Company the client must belong to.
 * @param clientId Client being opened.
 * @returns The client, or null when it does not exist.
 */
export async function getClient(companyId: string, clientId: string): Promise<ClientDetail | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('clients')
    .select(CLIENT_COLUMNS)
    .eq('company_id', companyId)
    .eq('id', clientId)
    .maybeSingle();

  if (error) {
    logger.error('Could not read client', error, { companyId, clientId });
    return null;
  }

  const row = asRow(data);

  if (row === null) {
    return null;
  }

  const [contacts, addresses] = await Promise.all([
    supabase
      .from('client_contacts')
      .select(
        'id, full_name, job_title, email, phone, mobile, is_primary, receives_invoices, receives_reminders'
      )
      .eq('company_id', companyId)
      .eq('client_id', clientId)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false })
      .order('full_name', { ascending: true }),
    supabase
      .from('client_addresses')
      .select(
        'id, address_type, label, attention_to, address_line1, address_line2, city, state_region, postal_code, country_code, is_default'
      )
      .eq('company_id', companyId)
      .eq('client_id', clientId)
      .is('deleted_at', null)
      .order('is_default', { ascending: false }),
  ]);

  return toClientDetail(row, asRows(contacts.data), asRows(addresses.data));
}

export interface ClientBillingSummary {
  invoiceCount: number;
  outstandingTotal: string;
  paidTotal: string;
  currency: string;
  isDegraded: boolean;
}

const OPEN_STATUSES = ['sent', 'viewed', 'partially_paid', 'overdue', 'disputed'] as const;

/**
 * Totals the invoices raised against one client.
 *
 * @param companyId Company the client belongs to.
 * @param clientId Client being summarised.
 * @param fallbackCurrency Currency used when the client has no invoices yet.
 * @returns The billing figures for the client page.
 */
export async function getClientBillingSummary(
  companyId: string,
  clientId: string,
  fallbackCurrency: string
): Promise<ClientBillingSummary> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('invoices')
    .select('status, currency, balance_due, paid_amount')
    .eq('company_id', companyId)
    .eq('client_id', clientId)
    .is('deleted_at', null);

  if (error) {
    logger.error('Could not summarise client billing', error, { companyId, clientId });

    return {
      invoiceCount: 0,
      outstandingTotal: '0.00',
      paidTotal: '0.00',
      currency: fallbackCurrency,
      isDegraded: true,
    };
  }

  const rows = asRows(data);
  let outstandingTotal = '0';
  let paidTotal = '0';
  let currency = fallbackCurrency;

  for (const row of rows) {
    const rowCurrency = readString(row, 'currency');

    if (rowCurrency !== null) {
      currency = rowCurrency;
    }

    paidTotal = toStoredAmount(addMoney(paidTotal, readAmount(row, 'paid_amount')));

    const status = readString(row, 'status');

    if (status !== null && OPEN_STATUSES.includes(status as (typeof OPEN_STATUSES)[number])) {
      outstandingTotal = toStoredAmount(addMoney(outstandingTotal, readAmount(row, 'balance_due')));
    }
  }

  return {
    invoiceCount: rows.length,
    outstandingTotal,
    paidTotal,
    currency,
    isDegraded: false,
  };
}

// src/features/disputes/queries/list-disputes.ts
// Reading the chargebacks raised against one business.

import type { DisputeOverview, DisputeSummary, DisputeTotals } from '@/features/disputes/types';
import { logger } from '@/lib/logger';
import { addMoney, toStoredAmount } from '@/lib/money';
import { asRow, asRows, readAmount, readEnum, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';
import { DISPUTE_STATUSES, GATEWAY_PROVIDERS } from '@/types/enums';

export const DISPUTE_COLUMNS =
  'id, status, provider, case_number, reason_code, reason_description, invoice_id, payment_id, disputed_amount, fee_amount, recovered_amount, currency, opened_at, evidence_due_at, evidence_submitted_at, resolved_at, outcome_note, clients(display_name), invoices(invoice_number)';

/** The states in which a chargeback still needs work. */
export const OPEN_DISPUTE_STATES: readonly string[] = [
  'open',
  'evidence_required',
  'evidence_submitted',
  'under_review',
];

/**
 * Maps one stored dispute.
 *
 * @param row Row read from public.disputes.
 * @returns The dispute the page renders.
 */
export function toDispute(row: DatabaseRow): DisputeSummary {
  const client = asRow(row['clients']);
  const invoice = asRow(row['invoices']);

  return {
    id: readString(row, 'id') ?? '',
    status: readEnum(row, 'status', DISPUTE_STATUSES, 'open'),
    provider: readEnum(row, 'provider', GATEWAY_PROVIDERS, 'manual'),
    caseNumber: readString(row, 'case_number'),
    reasonCode: readString(row, 'reason_code'),
    reasonDescription: readString(row, 'reason_description'),
    clientName: (client ? readString(client, 'display_name') : null) ?? 'No client recorded',
    invoiceId: readString(row, 'invoice_id'),
    invoiceNumber: invoice ? readString(invoice, 'invoice_number') : null,
    paymentId: readString(row, 'payment_id') ?? '',
    disputedAmount: readAmount(row, 'disputed_amount'),
    feeAmount: readAmount(row, 'fee_amount'),
    recoveredAmount: readAmount(row, 'recovered_amount'),
    currency: readString(row, 'currency') ?? 'USD',
    openedAt: readString(row, 'opened_at') ?? '',
    evidenceDueAt: readString(row, 'evidence_due_at'),
    evidenceSubmittedAt: readString(row, 'evidence_submitted_at'),
    resolvedAt: readString(row, 'resolved_at'),
    outcomeNote: readString(row, 'outcome_note'),
  };
}

/**
 * Adds up what the disputes mean for the business.
 *
 * @param disputes Disputes that were read.
 * @param currency Currency of the business.
 * @returns The totals shown above the list.
 */
function summarise(disputes: readonly DisputeSummary[], currency: string): DisputeTotals {
  const open = disputes.filter((dispute) => OPEN_DISPUTE_STATES.includes(dispute.status));

  return {
    openCount: open.length,
    openAmount: toStoredAmount(addMoney(...open.map((dispute) => dispute.disputedAmount), '0')),
    recoveredAmount: toStoredAmount(
      addMoney(...disputes.map((dispute) => dispute.recoveredAmount), '0')
    ),
    currency,
  };
}

/**
 * Reads the chargebacks of one business, the most urgent first.
 *
 * @param companyId Company whose disputes are read.
 * @param currency Currency the totals are shown in.
 * @returns The disputes and their totals.
 */
export async function loadDisputes(companyId: string, currency: string): Promise<DisputeOverview> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('disputes')
    .select(DISPUTE_COLUMNS)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('opened_at', { ascending: false })
    .limit(200);

  if (error) {
    logger.error('The disputes could not be read', error, { companyId });

    return {
      disputes: [],
      totals: { openCount: 0, openAmount: '0.00', recoveredAmount: '0.00', currency },
      isDegraded: true,
    };
  }

  const disputes = asRows(data).map(toDispute);

  return { disputes, totals: summarise(disputes, currency), isDegraded: false };
}

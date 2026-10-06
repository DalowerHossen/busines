// src/features/refunds/queries/list-refunds.ts
// Reading the money this business has given back, and what is still waiting
// for a decision.

import type { RefundOverview, RefundSummary, RefundTotals } from '@/features/refunds/types';
import { logger } from '@/lib/logger';
import { addMoney, toStoredAmount } from '@/lib/money';
import { asRow, asRows, readAmount, readBoolean, readEnum, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';
import { APPROVAL_STATUSES, GATEWAY_PROVIDERS, REFUND_STATUSES } from '@/types/enums';

const COLUMNS =
  'id, refund_number, status, approval_status, requires_approval, payment_id, amount, currency, reason, provider, is_partial, created_at, settled_at, rejection_reason, clients(display_name), payments(payment_number)';

/**
 * Maps one stored refund.
 *
 * @param row Row read from public.refunds.
 * @returns The refund the page renders.
 */
function toRefund(row: DatabaseRow): RefundSummary {
  const client = asRow(row['clients']);
  const payment = asRow(row['payments']);
  const approval = readString(row, 'approval_status');

  return {
    id: readString(row, 'id') ?? '',
    refundNumber: readString(row, 'refund_number'),
    status: readEnum(row, 'status', REFUND_STATUSES, 'requested'),
    approvalStatus:
      approval === null ? null : readEnum(row, 'approval_status', APPROVAL_STATUSES, 'pending'),
    requiresApproval: readBoolean(row, 'requires_approval'),
    paymentId: readString(row, 'payment_id') ?? '',
    paymentNumber: payment ? readString(payment, 'payment_number') : null,
    clientName: (client ? readString(client, 'display_name') : null) ?? 'No client recorded',
    amount: readAmount(row, 'amount'),
    currency: readString(row, 'currency') ?? 'USD',
    reason: readString(row, 'reason') ?? '',
    provider: readEnum(row, 'provider', GATEWAY_PROVIDERS, 'manual'),
    isPartial: readBoolean(row, 'is_partial'),
    requestedAt: readString(row, 'created_at') ?? '',
    settledAt: readString(row, 'settled_at'),
    rejectionReason: readString(row, 'rejection_reason'),
  };
}

/**
 * Adds up what the refund list means for the business.
 *
 * @param refunds Refunds on the page.
 * @param currency Currency of the business.
 * @returns The totals shown above the list.
 */
function summarise(refunds: readonly RefundSummary[], currency: string): RefundTotals {
  const settled = refunds.filter((refund) => refund.status === 'succeeded');
  const pending = refunds.filter((refund) => refund.approvalStatus === 'pending');

  return {
    settledAmount: toStoredAmount(addMoney(...settled.map((refund) => refund.amount), '0')),
    pendingAmount: toStoredAmount(addMoney(...pending.map((refund) => refund.amount), '0')),
    pendingCount: pending.length,
    currency,
  };
}

/**
 * Reads the refunds of one business, newest first.
 *
 * @param companyId Company whose refunds are read.
 * @param currency Currency the totals are shown in.
 * @returns The refunds and their totals.
 */
export async function loadRefunds(companyId: string, currency: string): Promise<RefundOverview> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('refunds')
    .select(COLUMNS)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    logger.error('The refunds could not be read', error, { companyId });

    return {
      refunds: [],
      totals: { settledAmount: '0.00', pendingAmount: '0.00', pendingCount: 0, currency },
      isDegraded: true,
    };
  }

  const refunds = asRows(data).map(toRefund);

  return { refunds, totals: summarise(refunds, currency), isDegraded: false };
}

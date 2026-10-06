// src/features/estimates/status.ts
// How an estimate status is described to a person, and what may be done to a
// quotation in that state. One definition, used by the list, the detail page
// and the row menu.

import type { EstimateStatus } from '@/types/enums';

export const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  approved: 'Approved',
  declined: 'Declined',
  expired: 'Expired',
  converted: 'Invoiced',
  cancelled: 'Withdrawn',
};

/** Statuses of a quotation that is still with the client. */
export const OPEN_ESTIMATE_STATUSES: readonly EstimateStatus[] = ['sent', 'viewed'];

/**
 * Reports whether an estimate can still be edited.
 *
 * @param status Status the estimate holds.
 * @returns True when the lines may still be changed.
 */
export function isEditableEstimate(status: EstimateStatus): boolean {
  return status === 'draft';
}

/**
 * Reports whether an estimate is ready to go to the client.
 *
 * @param status Status the estimate holds.
 * @param lineCount How many lines the estimate carries.
 * @returns True when it can be sent.
 */
export function canSendEstimate(status: EstimateStatus, lineCount: number): boolean {
  return status === 'draft' && lineCount > 0;
}

/**
 * Reports whether the client decision can still be recorded.
 *
 * @param status Status the estimate holds.
 * @returns True when approval or decline may be entered.
 */
export function canDecideEstimate(status: EstimateStatus): boolean {
  return status === 'sent' || status === 'viewed' || status === 'expired' || status === 'declined';
}

/**
 * Reports whether an estimate can become an invoice.
 *
 * @param status Status the estimate holds.
 * @returns True when conversion is allowed.
 */
export function canConvertEstimate(status: EstimateStatus): boolean {
  return status === 'approved';
}

/**
 * Reports whether an estimate can be withdrawn.
 *
 * @param status Status the estimate holds.
 * @returns True when withdrawing is allowed.
 */
export function canCancelEstimate(status: EstimateStatus): boolean {
  return status !== 'converted' && status !== 'cancelled';
}

/**
 * Describes what an estimate in this state means.
 *
 * @param status Status the estimate holds.
 * @returns One short sentence for the detail page.
 */
export function describeEstimateStatus(status: EstimateStatus): string {
  switch (status) {
    case 'draft':
      return 'This quotation has not gone out. It carries no number yet and the client cannot see it.';
    case 'sent':
      return 'The quotation has been numbered and sent to the client.';
    case 'viewed':
      return 'The client has opened this quotation.';
    case 'approved':
      return 'The client accepted this quotation. Turn it into an invoice when the work is agreed.';
    case 'declined':
      return 'The client turned this quotation down. The reason is kept with the record.';
    case 'expired':
      return 'The validity date has passed. Send a fresh quotation or record a late decision.';
    case 'converted':
      return 'This quotation became an invoice and is now part of the sales ledger.';
    case 'cancelled':
      return 'This quotation was withdrawn and can no longer be accepted.';
    default:
      return 'This quotation is on record.';
  }
}

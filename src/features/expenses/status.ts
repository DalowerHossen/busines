// src/features/expenses/status.ts
// How an expense claim is described to a person, and what may be done to it
// in each state.

import type { ExpenseStatus } from '@/types/enums';

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  draft: 'Draft',
  submitted: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Rejected',
  reimbursed: 'Reimbursed',
};

export const EXPENSE_STATUS_TONES: Record<
  ExpenseStatus,
  'neutral' | 'warning' | 'success' | 'danger' | 'brand'
> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
  reimbursed: 'brand',
};

/**
 * Reports whether a claim can still be changed.
 *
 * @param status State the claim is in.
 * @returns True while it is a draft or has been sent back.
 */
export function isEditableExpense(status: ExpenseStatus): boolean {
  return status === 'draft' || status === 'rejected';
}

/**
 * Reports whether a claim can be sent for approval.
 *
 * @param status State the claim is in.
 * @returns True when somebody still has to look at it.
 */
export function canSubmitExpense(status: ExpenseStatus): boolean {
  return status === 'draft' || status === 'rejected';
}

/**
 * Reports whether a claim is waiting for an answer.
 *
 * @param status State the claim is in.
 * @returns True when it can be approved or sent back.
 */
export function canReviewExpense(status: ExpenseStatus): boolean {
  return status === 'submitted' || status === 'draft';
}

/**
 * Reports whether a claim can be marked as settled.
 *
 * @param status State the claim is in.
 * @param isPaid True when the money has already gone out.
 * @returns True when the payment can still be recorded.
 */
export function canSettleExpense(status: ExpenseStatus, isPaid: boolean): boolean {
  return !isPaid && (status === 'approved' || status === 'submitted');
}

/**
 * Explains in one sentence where a claim stands.
 *
 * @param status State the claim is in.
 * @param isPaid True when the money has gone out.
 * @returns A sentence for the top of the page.
 */
export function describeExpenseStatus(status: ExpenseStatus, isPaid: boolean): string {
  switch (status) {
    case 'draft':
      return 'This claim is a draft. Send it for approval when the receipt and the amount are right.';
    case 'submitted':
      return 'This claim is with the owner. Nothing is paid until it has been approved.';
    case 'approved':
      return isPaid
        ? 'Approved and paid. It counts towards your spending for the period.'
        : 'Approved and waiting to be paid.';
    case 'rejected':
      return 'This claim was sent back. Correct it and submit it again.';
    case 'reimbursed':
      return 'The person who paid for this has been reimbursed.';
    default:
      return 'This claim is on record.';
  }
}

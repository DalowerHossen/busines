// src/features/invoices/status.ts
// How an invoice status is described to a person, and what may be done to a
// document in that state. One definition, used by the list, the detail page
// and the row menu.

import type { InvoiceStatus } from '@/types/enums';

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sent: 'Sent',
  viewed: 'Viewed',
  partially_paid: 'Part paid',
  paid: 'Paid',
  overdue: 'Overdue',
  disputed: 'Disputed',
  written_off: 'Written off',
  cancelled: 'Cancelled',
};

/** Statuses that still count towards the money a company is waiting for. */
export const OPEN_INVOICE_STATUSES: readonly InvoiceStatus[] = [
  'sent',
  'viewed',
  'partially_paid',
  'overdue',
  'disputed',
];

/**
 * Reports whether an invoice can still be edited.
 *
 * @param status Status the invoice holds.
 * @param isLocked True once the invoice has been issued.
 * @returns True when the lines may still be changed.
 */
export function isEditableInvoice(status: InvoiceStatus, isLocked: boolean): boolean {
  return !isLocked && status === 'draft';
}

/**
 * Reports whether an invoice can be issued to the client.
 *
 * @param status Status the invoice holds.
 * @param isLocked True once the invoice has been issued.
 * @param lineCount How many lines the invoice carries.
 * @returns True when the invoice is ready to be issued.
 */
export function canIssueInvoice(
  status: InvoiceStatus,
  isLocked: boolean,
  lineCount: number
): boolean {
  return !isLocked && status === 'draft' && lineCount > 0;
}

/**
 * Reports whether an invoice can be cancelled.
 *
 * @param status Status the invoice holds.
 * @returns True when cancelling is allowed.
 */
export function canCancelInvoice(status: InvoiceStatus): boolean {
  return OPEN_INVOICE_STATUSES.includes(status) || status === 'scheduled';
}

/**
 * Describes what the balance of an invoice means in that state.
 *
 * @param status Status the invoice holds.
 * @returns One short sentence for the detail page.
 */
export function describeInvoiceStatus(status: InvoiceStatus): string {
  switch (status) {
    case 'draft':
      return 'This invoice has not been issued. It carries no number yet and the client cannot see it.';
    case 'scheduled':
      return 'This invoice is waiting for its send date.';
    case 'sent':
      return 'The invoice has been issued and sent to the client.';
    case 'viewed':
      return 'The client has opened this invoice.';
    case 'partially_paid':
      return 'Part of this invoice has been paid. The balance below is still due.';
    case 'paid':
      return 'This invoice has been paid in full.';
    case 'overdue':
      return 'The due date has passed and the balance is still outstanding.';
    case 'disputed':
      return 'The client has raised a question about this invoice.';
    case 'written_off':
      return 'This invoice has been written off and is no longer chased.';
    case 'cancelled':
      return 'This invoice has been cancelled. It stays on record for your audit trail.';
    default:
      return 'This invoice is on record.';
  }
}

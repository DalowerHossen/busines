// tests/unit/invoice-numbering.test.ts
// The small pure rules that decide what a client sees on a document: the
// way money is written, the way a date is written, and whether an invoice
// may still be edited.
//
// These are the parts people notice. A total shown as 1250 instead of
// 1,250.00, or a date that reads as the fifth of November in one country
// and the eleventh of May in another, costs more trust than a missing
// feature.

import { describe, expect, it } from 'vitest';

import { isEditableInvoice, describeInvoiceStatus } from '@/features/invoices/status';
import { formatAmount, formatFileSize, formatMoney, formatPercentage } from '@/lib/format';
import { formatDate } from '@/lib/dates';

describe('writing money on a document', () => {
  it('always shows two decimals, however round the figure is', () => {
    expect(formatMoney('1250', 'USD')).toContain('1,250.00');
    expect(formatMoney('0.5', 'USD')).toContain('0.50');
  });

  it('writes a negative amount as a negative amount rather than hiding it', () => {
    expect(formatMoney('-40.25', 'USD')).toContain('40.25');
    expect(formatMoney('-40.25', 'USD')).toMatch(/-|\(/);
  });

  it('keeps the plain amount separate from the currency, for a column of figures', () => {
    expect(formatAmount('1250', 'USD')).toBe('1,250.00');
  });

  it('writes a percentage the way an invoice line does', () => {
    expect(formatPercentage(7.5)).toContain('7.5');
  });
});

describe('writing a date on a document', () => {
  it('never leaves the order of the day and the month ambiguous', () => {
    const written = formatDate('2026-11-05');

    expect(written).toContain('2026');
    expect(written).toMatch(/Nov/i);
  });
});

describe('whether an invoice may still be changed', () => {
  it('lets a draft be edited', () => {
    expect(isEditableInvoice('draft', false)).toBe(true);
  });

  it('refuses to edit one the client has already been sent', () => {
    expect(isEditableInvoice('sent', false)).toBe(false);
    expect(isEditableInvoice('paid', false)).toBe(false);
  });

  it('refuses to edit a locked invoice whatever its state says', () => {
    expect(isEditableInvoice('draft', true)).toBe(false);
  });

  it('explains every state in words a client could read', () => {
    const statuses = ['draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue'] as const;

    for (const status of statuses) {
      expect(describeInvoiceStatus(status).length).toBeGreaterThan(10);
    }
  });
});

describe('writing a file size', () => {
  it('uses the unit a person would use', () => {
    expect(formatFileSize(512)).toContain('512');
    expect(formatFileSize(1048576)).toMatch(/MB/i);
  });
});

// tests/unit/validation.test.ts
// The rules a form enforces before anything reaches the database. These
// exist so a person is told what is wrong while they can still see the
// figures they typed.

import { describe, expect, it } from 'vitest';

import { postJournalSchema } from '@/features/accounting/validation/accounting';
import { saveSettingsSchema } from '@/features/collections/validation/collections';
import { settlementPolicySchema } from '@/features/settlements/validation/settlement';

const accountOne = '01920000-0000-7000-8000-000000000001';
const accountTwo = '01920000-0000-7000-8000-000000000002';

describe('a journal entry', () => {
  it('is accepted when the two sides agree', () => {
    const result = postJournalSchema.safeParse({
      entryDate: '2026-01-31',
      memo: 'Depreciation for the month',
      lines: [
        { accountId: accountOne, debit: '100.00', credit: '0' },
        { accountId: accountTwo, debit: '0', credit: '100.00' },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('is refused when it does not balance, and says by how much', () => {
    const result = postJournalSchema.safeParse({
      entryDate: '2026-01-31',
      memo: 'Depreciation for the month',
      lines: [
        { accountId: accountOne, debit: '100.00', credit: '0' },
        { accountId: accountTwo, debit: '0', credit: '90.00' },
      ],
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('90.00');
    }
  });

  it('refuses a line that is both a debit and a credit', () => {
    const result = postJournalSchema.safeParse({
      entryDate: '2026-01-31',
      memo: 'Confused entry',
      lines: [
        { accountId: accountOne, debit: '50.00', credit: '50.00' },
        { accountId: accountTwo, debit: '0', credit: '0' },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('refuses an entry that moves nothing at all', () => {
    const result = postJournalSchema.safeParse({
      entryDate: '2026-01-31',
      memo: 'An entry about nothing',
      lines: [
        { accountId: accountOne, debit: '0', credit: '0' },
        { accountId: accountTwo, debit: '0', credit: '0' },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe('collection terms', () => {
  it('accepts an ordinary set of terms', () => {
    const result = settlementPolicySchema.safeParse({
      companyId: null,
      name: 'Standard collection terms',
      feePercentage: '0.5',
      minimumFee: '0.50',
      fixedFee: '0',
      holdDays: '7',
      payoutSlaHours: '24',
      payoutThreshold: '25.00',
    });

    expect(result.success).toBe(true);
  });

  it('refuses a fee that is almost certainly a typing mistake', () => {
    const result = settlementPolicySchema.safeParse({
      companyId: null,
      name: 'Greedy',
      feePercentage: '50',
      minimumFee: '0.50',
      fixedFee: '0',
      holdDays: '7',
      payoutSlaHours: '24',
      payoutThreshold: '25.00',
    });

    expect(result.success).toBe(false);
  });

  it('refuses a hold that is really a freeze', () => {
    const result = settlementPolicySchema.safeParse({
      companyId: null,
      name: 'Forever',
      feePercentage: '0.5',
      minimumFee: '0.50',
      fixedFee: '0',
      holdDays: '400',
      payoutSlaHours: '24',
      payoutThreshold: '25.00',
    });

    expect(result.success).toBe(false);
  });
});

describe('when a business is willing to chase', () => {
  it('refuses quiet hours of zero length', () => {
    const result = saveSettingsSchema.safeParse({
      isEnabled: true,
      timeZone: 'Asia/Dhaka',
      quietHoursStart: '09:00',
      quietHoursEnd: '09:00',
      sendingWeekdays: [1, 2, 3],
      shiftDueDatesToBusinessDays: false,
      sendStatements: false,
    });

    expect(result.success).toBe(false);
  });

  it('refuses a week with no sending days in it', () => {
    const result = saveSettingsSchema.safeParse({
      isEnabled: true,
      timeZone: 'Asia/Dhaka',
      quietHoursStart: '20:00',
      quietHoursEnd: '08:00',
      sendingWeekdays: [],
      shiftDueDatesToBusinessDays: false,
      sendStatements: false,
    });

    expect(result.success).toBe(false);
  });

  it('refuses a statement day that some months do not have', () => {
    const result = saveSettingsSchema.safeParse({
      isEnabled: true,
      timeZone: 'Asia/Dhaka',
      quietHoursStart: '20:00',
      quietHoursEnd: '08:00',
      sendingWeekdays: [1],
      shiftDueDatesToBusinessDays: false,
      sendStatements: true,
      statementDayOfMonth: 31,
    });

    expect(result.success).toBe(false);
  });
});

// tests/unit/money.test.ts
// Money arithmetic, which is the part of this product that cannot be
// approximately right.

import { describe, expect, it } from 'vitest';

import { addMoney, roundToCurrency, splitEvenly, subtractMoney, toMinorUnits } from '@/lib/money';

describe('adding money', () => {
  it('does not lose a penny the way floating point does', () => {
    expect(addMoney('0.10', '0.20').toString()).toBe('0.3');
  });

  it('adds a long column of small amounts exactly', () => {
    const total = Array.from({ length: 10 }).reduce<string>(
      (running) => addMoney(running, '0.10').toString(),
      '0'
    );

    expect(total).toBe('1');
  });
});

describe('subtracting money', () => {
  it('leaves nothing behind when two amounts are equal', () => {
    expect(subtractMoney('199.99', '199.99').toString()).toBe('0');
  });

  it('is willing to go negative, because a credit note is a real thing', () => {
    expect(subtractMoney('10.00', '12.50').toString()).toBe('-2.5');
  });
});

describe('rounding to a currency', () => {
  it('keeps two decimals for an ordinary currency', () => {
    expect(roundToCurrency('10.005', 'USD').toString()).toBe('10.01');
  });

  it('keeps none for a currency that has none', () => {
    expect(roundToCurrency('1050.4', 'JPY').toString()).toBe('1050');
  });
});

describe('converting to the smallest unit', () => {
  it('turns a decimal amount into whole minor units', () => {
    expect(toMinorUnits('12.34', 'USD')).toBe(1234);
  });

  it('leaves a zero decimal currency alone', () => {
    expect(toMinorUnits('1050', 'JPY')).toBe(1050);
  });
});

describe('splitting an amount evenly', () => {
  it('gives every part the same value when it divides cleanly', () => {
    expect(splitEvenly('90.00', 3, 'USD')).toEqual(['30.00', '30.00', '30.00']);
  });

  it('puts the odd penny somewhere rather than losing it', () => {
    const parts = splitEvenly('10.00', 3, 'USD');
    const total = parts.reduce((running, part) => addMoney(running, part).toString(), '0');

    expect(parts).toHaveLength(3);
    expect(Number.parseFloat(total)).toBeCloseTo(10, 10);
  });
});

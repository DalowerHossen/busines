// src/lib/money.ts
// Decimal safe money arithmetic. Amounts travel as strings, are computed with
// decimal.js and are converted to the minor units gateways charge in.

import { Decimal } from 'decimal.js';

import { currencyDecimals } from '@/config/currencies';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -9, toExpPos: 21 });

export type MoneyInput = string | number | Decimal;

/** Number of decimals stored in the database for every money column. */
export const STORED_SCALE = 4;

/**
 * Parses any accepted money input into a decimal.
 *
 * @param value Amount as a string, number or decimal.
 * @returns The parsed decimal, or zero when the input cannot be read.
 */
export function toDecimal(value: MoneyInput): Decimal {
  if (value instanceof Decimal) {
    return value;
  }

  const parsed = new Decimal(typeof value === 'number' ? value : value.trim() || '0');
  return parsed.isFinite() ? parsed : new Decimal(0);
}

/**
 * Adds a list of amounts without losing precision.
 *
 * @param values Amounts to add.
 * @returns The total as a decimal.
 */
export function addMoney(...values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>((total, value) => total.plus(toDecimal(value)), new Decimal(0));
}

/**
 * Subtracts one amount from another.
 *
 * @param left Amount to subtract from.
 * @param right Amount to take away.
 * @returns The difference as a decimal.
 */
export function subtractMoney(left: MoneyInput, right: MoneyInput): Decimal {
  return toDecimal(left).minus(toDecimal(right));
}

/**
 * Multiplies an amount by a quantity or a rate.
 *
 * @param amount Amount to multiply.
 * @param factor Quantity or rate.
 * @returns The product as a decimal.
 */
export function multiplyMoney(amount: MoneyInput, factor: MoneyInput): Decimal {
  return toDecimal(amount).times(toDecimal(factor));
}

/**
 * Applies a percentage to an amount.
 *
 * @param amount Base amount.
 * @param percentage Percentage expressed out of one hundred.
 * @returns The resulting portion as a decimal.
 */
export function percentageOf(amount: MoneyInput, percentage: MoneyInput): Decimal {
  return toDecimal(amount).times(toDecimal(percentage)).dividedBy(100);
}

/**
 * Rounds an amount to the number of decimals its currency is written with.
 *
 * @param amount Amount to round.
 * @param currency Three letter currency code.
 * @returns The rounded decimal.
 */
export function roundToCurrency(amount: MoneyInput, currency: string): Decimal {
  return toDecimal(amount).toDecimalPlaces(currencyDecimals(currency), Decimal.ROUND_HALF_UP);
}

/**
 * Formats an amount the way the database stores it.
 *
 * @param amount Amount to format.
 * @returns A fixed point string with the stored scale.
 */
export function toStoredAmount(amount: MoneyInput): string {
  return toDecimal(amount).toFixed(STORED_SCALE, Decimal.ROUND_HALF_UP);
}

/**
 * Converts an amount into the minor units a payment gateway charges in.
 *
 * @param amount Amount in major units.
 * @param currency Three letter currency code.
 * @returns A whole number of minor units.
 */
export function toMinorUnits(amount: MoneyInput, currency: string): number {
  const decimals = currencyDecimals(currency);
  const scaled = toDecimal(amount)
    .times(new Decimal(10).pow(decimals))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  return scaled.toNumber();
}

/**
 * Converts minor units received from a gateway back into major units.
 *
 * @param minorUnits Whole number of minor units.
 * @param currency Three letter currency code.
 * @returns The amount as a fixed point string.
 */
export function fromMinorUnits(minorUnits: number, currency: string): string {
  const decimals = currencyDecimals(currency);
  return new Decimal(minorUnits).dividedBy(new Decimal(10).pow(decimals)).toFixed(decimals);
}

/**
 * Compares two amounts.
 *
 * @param left First amount.
 * @param right Second amount.
 * @returns A negative number, zero or a positive number.
 */
export function compareMoney(left: MoneyInput, right: MoneyInput): number {
  return toDecimal(left).comparedTo(toDecimal(right));
}

/**
 * Reports whether an amount is exactly zero.
 *
 * @param amount Amount to test.
 * @returns True when the amount is zero.
 */
export function isZeroMoney(amount: MoneyInput): boolean {
  return toDecimal(amount).isZero();
}

/**
 * Reports whether an amount is above zero.
 *
 * @param amount Amount to test.
 * @returns True when the amount is positive.
 */
export function isPositiveMoney(amount: MoneyInput): boolean {
  return toDecimal(amount).greaterThan(0);
}

/**
 * Splits an amount into equal instalments, giving any remainder to the first.
 *
 * @param amount Total to divide.
 * @param parts How many instalments to create.
 * @param currency Three letter currency code.
 * @returns Instalment amounts that add back up to the total exactly.
 */
export function splitEvenly(amount: MoneyInput, parts: number, currency: string): string[] {
  const safeParts = Math.max(1, Math.floor(parts));
  const decimals = currencyDecimals(currency);
  const total = roundToCurrency(amount, currency);
  const base = total.dividedBy(safeParts).toDecimalPlaces(decimals, Decimal.ROUND_DOWN);

  const instalments: Decimal[] = Array.from({ length: safeParts }, () => base);
  const distributed = base.times(safeParts);
  const remainder = total.minus(distributed);

  const first = instalments[0];
  if (first && !remainder.isZero()) {
    instalments[0] = first.plus(remainder);
  }

  return instalments.map((instalment) => instalment.toFixed(decimals));
}

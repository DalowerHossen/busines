import Decimal from 'decimal.js';
import { invalidMorRequest } from './errors';

const MONEY_SCALE = 4;
const AMOUNT_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d{1,4})?$/u;

export function normalizeAmount(
  value: string,
  options: { readonly allowNegative?: boolean; readonly allowZero?: boolean } = {}
): string {
  if (!AMOUNT_PATTERN.test(value)) throw invalidMorRequest();
  if (!options.allowNegative && value.startsWith('-')) throw invalidMorRequest();
  try {
    const amount = new Decimal(value);
    if (!amount.isFinite() || (!options.allowZero && amount.isZero())) throw invalidMorRequest();
    return amount.toFixed(MONEY_SCALE);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Merchant settlement request could not be completed.'
    )
      throw error;
    throw invalidMorRequest();
  }
}

export function normalizeSignedAmount(value: string): string {
  return normalizeAmount(value, { allowNegative: true, allowZero: true });
}

export function addAmounts(...values: readonly string[]): string {
  return values
    .reduce(
      (total, value) => total.plus(new Decimal(normalizeAmount(value, { allowZero: true }))),
      new Decimal(0)
    )
    .toFixed(MONEY_SCALE);
}

export function addSignedAmounts(...values: readonly string[]): string {
  return values
    .reduce((total, value) => total.plus(new Decimal(normalizeSignedAmount(value))), new Decimal(0))
    .toFixed(MONEY_SCALE);
}

export function subtractAmounts(left: string, right: string): string {
  return new Decimal(normalizeAmount(left, { allowZero: true }))
    .minus(new Decimal(normalizeAmount(right, { allowZero: true })))
    .toFixed(MONEY_SCALE);
}

export function multiplyPercentage(amount: string, percentage: string): string {
  const normalizedAmount = normalizeAmount(amount, { allowZero: true });
  const normalizedPercentage = normalizeAmount(percentage, { allowZero: true });
  return new Decimal(normalizedAmount)
    .times(new Decimal(normalizedPercentage))
    .dividedBy(100)
    .toFixed(MONEY_SCALE);
}

export function maximumAmount(left: string, right: string): string {
  const leftDecimal = new Decimal(normalizeAmount(left, { allowZero: true }));
  const rightDecimal = new Decimal(normalizeAmount(right, { allowZero: true }));
  return Decimal.max(leftDecimal, rightDecimal).toFixed(MONEY_SCALE);
}

export function compareAmounts(left: string, right: string): -1 | 0 | 1 {
  return new Decimal(normalizeAmount(left, { allowZero: true })).cmp(
    new Decimal(normalizeAmount(right, { allowZero: true }))
  ) as -1 | 0 | 1;
}

export function isNonNegativeAmount(value: string): boolean {
  try {
    normalizeAmount(value, { allowZero: true });
    return true;
  } catch {
    return false;
  }
}

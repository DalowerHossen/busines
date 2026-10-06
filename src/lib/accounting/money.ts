import Decimal from 'decimal.js';
import { invalidAccountingRequest } from './errors';
import { STORED_AMOUNT_PATTERN, STORED_SCALE } from '@/lib/money';

export function normalizeAccountingAmount(
  value: string,
  options: { readonly allowNegative?: boolean; readonly allowZero?: boolean } = {}
): string {
  if (!STORED_AMOUNT_PATTERN.test(value)) throw invalidAccountingRequest();
  if (!options.allowNegative && value.startsWith('-')) throw invalidAccountingRequest();
  const amount = new Decimal(value);
  if (!amount.isFinite() || (!options.allowZero && amount.isZero())) {
    throw invalidAccountingRequest();
  }
  return amount.toFixed(STORED_SCALE);
}

export function addAccountingAmounts(...values: readonly string[]): string {
  return values
    .reduce(
      (total, value) =>
        total.plus(new Decimal(normalizeAccountingAmount(value, { allowZero: true }))),
      new Decimal(0)
    )
    .toFixed(STORED_SCALE);
}

export function addSignedAccountingAmounts(...values: readonly string[]): string {
  return values
    .reduce(
      (total, value) =>
        total.plus(
          new Decimal(normalizeAccountingAmount(value, { allowNegative: true, allowZero: true }))
        ),
      new Decimal(0)
    )
    .toFixed(STORED_SCALE);
}

export function subtractAccountingAmounts(left: string, right: string): string {
  return new Decimal(normalizeAccountingAmount(left, { allowZero: true }))
    .minus(new Decimal(normalizeAccountingAmount(right, { allowZero: true })))
    .toFixed(STORED_SCALE);
}

export function multiplyAccountingPercentage(amount: string, percentage: string): string {
  return new Decimal(normalizeAccountingAmount(amount, { allowZero: true }))
    .times(new Decimal(normalizeAccountingAmount(percentage, { allowZero: true })))
    .dividedBy(100)
    .toFixed(STORED_SCALE);
}

export function compareAccountingAmounts(left: string, right: string): -1 | 0 | 1 {
  return new Decimal(normalizeAccountingAmount(left, { allowZero: true })).cmp(
    new Decimal(normalizeAccountingAmount(right, { allowZero: true }))
  ) as -1 | 0 | 1;
}

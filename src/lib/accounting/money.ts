import Decimal from 'decimal.js';
import { invalidAccountingRequest } from './errors';

const AMOUNT_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d{1,4})?$/u;

export function normalizeAccountingAmount(
  value: string,
  options: { readonly allowNegative?: boolean; readonly allowZero?: boolean } = {}
): string {
  if (!AMOUNT_PATTERN.test(value)) throw invalidAccountingRequest();
  if (!options.allowNegative && value.startsWith('-')) throw invalidAccountingRequest();
  const amount = new Decimal(value);
  if (!amount.isFinite() || (!options.allowZero && amount.isZero())) {
    throw invalidAccountingRequest();
  }
  return amount.toFixed(4);
}

export function addAccountingAmounts(...values: readonly string[]): string {
  return values
    .reduce(
      (total, value) =>
        total.plus(new Decimal(normalizeAccountingAmount(value, { allowZero: true }))),
      new Decimal(0)
    )
    .toFixed(4);
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
    .toFixed(4);
}

export function subtractAccountingAmounts(left: string, right: string): string {
  return new Decimal(normalizeAccountingAmount(left, { allowZero: true }))
    .minus(new Decimal(normalizeAccountingAmount(right, { allowZero: true })))
    .toFixed(4);
}

export function multiplyAccountingPercentage(amount: string, percentage: string): string {
  return new Decimal(normalizeAccountingAmount(amount, { allowZero: true }))
    .times(new Decimal(normalizeAccountingAmount(percentage, { allowZero: true })))
    .dividedBy(100)
    .toFixed(4);
}

export function compareAccountingAmounts(left: string, right: string): -1 | 0 | 1 {
  return new Decimal(normalizeAccountingAmount(left, { allowZero: true })).cmp(
    new Decimal(normalizeAccountingAmount(right, { allowZero: true }))
  ) as -1 | 0 | 1;
}

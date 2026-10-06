import Decimal from 'decimal.js';
import { getCurrencyDefinition } from '@/config/currencies';
import type { CurrencyCode, Money, MoneyAmount } from '@/types/core';
import { invalidCoreRequest } from './errors';

export type RoundingMode =
  | 'half_even'
  | 'half_up'
  | 'half_down'
  | 'up'
  | 'down'
  | 'ceiling'
  | 'floor';

const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u;
const MAX_DECIMAL_SCALE = 24;
const DECIMAL_PRECISION = 50;
const DECIMAL_ROUNDING: Readonly<Record<RoundingMode, Decimal.Rounding>> = {
  half_even: Decimal.ROUND_HALF_EVEN,
  half_up: Decimal.ROUND_HALF_UP,
  half_down: Decimal.ROUND_HALF_DOWN,
  up: Decimal.ROUND_UP,
  down: Decimal.ROUND_DOWN,
  ceiling: Decimal.ROUND_CEIL,
  floor: Decimal.ROUND_FLOOR,
};

export interface MoneyOperationOptions {
  readonly roundingMode?: RoundingMode;
}

export function isDecimalString(value: string): boolean {
  return DECIMAL_PATTERN.test(value);
}

export function normalizeDecimalAmount(
  value: string,
  options: {
    readonly allowNegative?: boolean;
    readonly allowZero?: boolean;
    readonly maxScale?: number;
  } = {}
): string {
  const decimal = parseDecimal(value, options);
  const canonical = decimal.toFixed();
  return canonical === '-0' ? '0' : canonical;
}

export function roundDecimalAmount(
  value: string,
  scale: number,
  roundingMode: RoundingMode = 'half_even'
): string {
  assertScale(scale);
  const decimal = parseDecimal(value, { allowNegative: true, allowZero: true });
  return decimal.toDecimalPlaces(scale, DECIMAL_ROUNDING[roundingMode]).toFixed(scale);
}

export function normalizeMoneyAmount(
  value: string,
  currencyCode: string,
  options: {
    readonly allowNegative?: boolean;
    readonly roundingMode?: RoundingMode;
  } = {}
): MoneyAmount {
  const definition = requireCurrencyDefinition(currencyCode);
  parseDecimal(value, {
    allowNegative: options.allowNegative ?? true,
    allowZero: true,
  });
  return asMoneyAmount(
    roundDecimalAmount(value, definition.decimalDigits, options.roundingMode ?? 'half_even')
  );
}

export function createMoney(
  amount: string,
  currencyCode: string,
  options: {
    readonly allowNegative?: boolean;
    readonly roundingMode?: RoundingMode;
  } = {}
): Money {
  const code = requireCurrencyDefinition(currencyCode).code;
  return {
    amount: normalizeMoneyAmount(amount, code, options),
    currency: code,
  };
}

export function addMoney(left: Money, right: Money, options: MoneyOperationOptions = {}): Money {
  assertSameCurrency(left, right);
  const currencyCode = requireCurrencyDefinition(left.currency).code;
  const value = new Decimal(normalizeMoneyAmount(left.amount, currencyCode))
    .plus(new Decimal(normalizeMoneyAmount(right.amount, currencyCode)))
    .toFixed();
  return createMoney(value, currencyCode, options);
}

export function subtractMoney(
  left: Money,
  right: Money,
  options: MoneyOperationOptions = {}
): Money {
  assertSameCurrency(left, right);
  const currencyCode = requireCurrencyDefinition(left.currency).code;
  const value = new Decimal(normalizeMoneyAmount(left.amount, currencyCode))
    .minus(new Decimal(normalizeMoneyAmount(right.amount, currencyCode)))
    .toFixed();
  return createMoney(value, currencyCode, { ...options, allowNegative: true });
}

export function multiplyMoney(
  value: Money,
  multiplier: string,
  options: MoneyOperationOptions = {}
): Money {
  const currencyCode = requireCurrencyDefinition(value.currency).code;
  const factor = parseDecimal(multiplier, { allowNegative: true, allowZero: true });
  const amount = new Decimal(normalizeMoneyAmount(value.amount, currencyCode))
    .times(factor)
    .toFixed();
  return createMoney(amount, currencyCode, { ...options, allowNegative: true });
}

export function divideMoney(
  value: Money,
  divisor: string,
  options: MoneyOperationOptions = {}
): Money {
  const currencyCode = requireCurrencyDefinition(value.currency).code;
  const denominator = parseDecimal(divisor, { allowNegative: true, allowZero: false });
  const amount = new Decimal(normalizeMoneyAmount(value.amount, currencyCode))
    .dividedBy(denominator)
    .toFixed();
  return createMoney(amount, currencyCode, { ...options, allowNegative: true });
}

export function compareMoney(left: Money, right: Money): -1 | 0 | 1 {
  assertSameCurrency(left, right);
  const currencyCode = requireCurrencyDefinition(left.currency).code;
  return new Decimal(normalizeMoneyAmount(left.amount, currencyCode)).cmp(
    new Decimal(normalizeMoneyAmount(right.amount, currencyCode))
  ) as -1 | 0 | 1;
}

export function sumMoney(values: readonly Money[]): Money {
  const [first, ...rest] = values;
  if (!first) throw invalidCoreRequest();
  return rest.reduce((total, value) => addMoney(total, value), first);
}

export function toMinorUnits(value: Money): bigint {
  const definition = requireCurrencyDefinition(value.currency);
  const normalized = normalizeMoneyAmount(value.amount, definition.code);
  const sign = normalized.startsWith('-') ? -1n : 1n;
  const unsigned = normalized.replace(/^-/, '');
  const [whole, fraction = ''] = unsigned.split('.');
  const minorText = `${whole}${fraction.padEnd(definition.decimalDigits, '0')}`;
  return sign * BigInt(minorText || '0');
}

export function fromMinorUnits(
  minorUnits: bigint,
  currencyCode: string,
  options: { readonly roundingMode?: RoundingMode } = {}
): Money {
  const definition = requireCurrencyDefinition(currencyCode);
  const negative = minorUnits < 0n;
  const unsigned = (negative ? -minorUnits : minorUnits)
    .toString()
    .padStart(definition.decimalDigits + 1, '0');
  const splitAt = unsigned.length - definition.decimalDigits;
  const whole = unsigned.slice(0, splitAt);
  const fraction = unsigned.slice(splitAt);
  const amount = `${negative ? '-' : ''}${whole}${
    definition.decimalDigits > 0 ? `.${fraction}` : ''
  }`;
  return createMoney(amount, definition.code, {
    allowNegative: true,
    roundingMode: options.roundingMode,
  });
}

export function allocateMoney(value: Money, ratios: readonly string[]): readonly Money[] {
  if (ratios.length === 0) throw invalidCoreRequest();
  const total = toMinorUnits(value);
  const normalizedRatios = ratios.map((ratio) =>
    parseDecimal(ratio, { allowNegative: false, allowZero: true })
  );
  const ratioTotal = normalizedRatios.reduce((sum, ratio) => sum.plus(ratio), new Decimal(0));
  if (ratioTotal.isZero()) throw invalidCoreRequest();

  const sign = total < 0n ? -1n : 1n;
  const absoluteTotal = total < 0n ? -total : total;
  const allocations = normalizedRatios.map((ratio, index) => {
    const exact = new Decimal(absoluteTotal.toString()).times(ratio).dividedBy(ratioTotal);
    const base = BigInt(exact.floor().toFixed(0));
    return { index, base, remainder: exact.minus(base.toString()) };
  });
  let remainder = absoluteTotal - allocations.reduce((sum, item) => sum + item.base, 0n);
  allocations.sort((left, right) => {
    const byRemainder = right.remainder.cmp(left.remainder);
    return byRemainder === 0 ? left.index - right.index : byRemainder;
  });
  for (const allocation of allocations) {
    if (remainder === 0n) break;
    allocation.base += 1n;
    remainder -= 1n;
  }
  allocations.sort((left, right) => left.index - right.index);
  return allocations.map((allocation) => fromMinorUnits(sign * allocation.base, value.currency));
}

export function requireCurrencyDefinition(currencyCode: string) {
  if (!/^[A-Z]{3}$/u.test(currencyCode)) throw invalidCoreRequest();
  const definition = getCurrencyDefinition(currencyCode as CurrencyCode);
  if (!definition) throw invalidCoreRequest();
  return definition;
}

function parseDecimal(
  value: string,
  options: {
    readonly allowNegative?: boolean;
    readonly allowZero?: boolean;
    readonly maxScale?: number;
  }
): Decimal {
  if (!isDecimalString(value)) throw invalidCoreRequest();
  if (options.allowNegative === false && value.startsWith('-')) throw invalidCoreRequest();
  const scale = value.includes('.') ? value.length - value.indexOf('.') - 1 : 0;
  if (scale > (options.maxScale ?? MAX_DECIMAL_SCALE)) throw invalidCoreRequest();
  const decimal = new Decimal(value);
  Decimal.set({ precision: DECIMAL_PRECISION });
  if (!decimal.isFinite() || (options.allowZero === false && decimal.isZero())) {
    throw invalidCoreRequest();
  }
  return decimal;
}

function assertScale(scale: number): void {
  if (!Number.isInteger(scale) || scale < 0 || scale > MAX_DECIMAL_SCALE) {
    throw invalidCoreRequest();
  }
}

function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) throw invalidCoreRequest();
}

function asMoneyAmount(value: string): MoneyAmount {
  return value as MoneyAmount;
}

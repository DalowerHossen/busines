import Decimal from 'decimal.js';
import type { CurrencyCode, Money } from '@/types/core';
import { exchangeRateUnavailable, invalidCoreRequest } from './errors';
import {
  createMoney,
  normalizeDecimalAmount,
  requireCurrencyDefinition,
  subtractMoney,
  type RoundingMode,
} from './money';
import type { ExchangeRateProvider, ExchangeRateSnapshot, ExchangeRateStore } from './types';

export interface FrozenFxConversion {
  readonly sourceAmount: Money;
  readonly targetAmount: Money;
  readonly rateSnapshot: ExchangeRateSnapshot | null;
  readonly rateApplied: string;
  readonly direction: 'identity' | 'direct' | 'inverse';
  readonly roundingMode: RoundingMode;
  readonly convertedAt: string;
}

export interface FxGainLossResult {
  readonly bookedAmount: Money;
  readonly settledAmount: Money;
  readonly settledAmountAtBookedCurrency: Money;
  readonly gainLoss: Money;
  readonly direction: 'gain' | 'loss' | 'none';
  readonly rateSnapshot: ExchangeRateSnapshot | null;
}

export function normalizeExchangeRate(value: string): string {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/u.test(value)) throw invalidCoreRequest();
  const rate = new Decimal(value);
  if (!rate.isFinite() || rate.isZero() || rate.isNegative()) throw invalidCoreRequest();
  return rate.toFixed(12);
}

export async function fetchAndStoreExchangeRate(input: {
  readonly provider: ExchangeRateProvider;
  readonly store: ExchangeRateStore;
  readonly baseCurrencyCode: string;
  readonly quoteCurrencyCode: string;
  readonly asOf: string;
}): Promise<ExchangeRateSnapshot> {
  const baseCurrencyCode = validateCurrencyPair(
    input.baseCurrencyCode,
    input.quoteCurrencyCode
  ).base;
  const quoteCurrencyCode = validateCurrencyPair(
    input.baseCurrencyCode,
    input.quoteCurrencyCode
  ).quote;
  assertTimestamp(input.asOf);
  try {
    const snapshot = await input.provider.fetchRate({
      baseCurrencyCode,
      quoteCurrencyCode,
      asOf: input.asOf,
    });
    const normalized = validateExchangeRateSnapshot(snapshot, input.provider.providerId);
    if (
      normalized.baseCurrencyCode !== baseCurrencyCode ||
      normalized.quoteCurrencyCode !== quoteCurrencyCode
    ) {
      throw invalidCoreRequest();
    }
    return input.store.append(normalized);
  } catch (error) {
    if (error instanceof Error && error.name === 'CoreDomainError') throw error;
    throw exchangeRateUnavailable();
  }
}

export async function resolveExchangeRate(input: {
  readonly store: ExchangeRateStore;
  readonly baseCurrencyCode: string;
  readonly quoteCurrencyCode: string;
  readonly asOf: string;
  readonly source?: string;
}): Promise<ExchangeRateSnapshot> {
  const baseCurrencyCode = requireCurrencyDefinition(input.baseCurrencyCode).code;
  const quoteCurrencyCode = requireCurrencyDefinition(input.quoteCurrencyCode).code;
  assertTimestamp(input.asOf);
  if (baseCurrencyCode === quoteCurrencyCode) {
    return {
      baseCurrencyCode,
      quoteCurrencyCode,
      rate: '1.000000000000',
      source: 'identity',
      effectiveAt: input.asOf,
      fetchedAt: input.asOf,
    };
  }
  const snapshot = await input.store.findLatest({
    baseCurrencyCode,
    quoteCurrencyCode,
    asOf: input.asOf,
    source: input.source,
  });
  if (!snapshot) throw exchangeRateUnavailable();
  const normalized = validateExchangeRateSnapshot(snapshot, snapshot.source);
  if (
    normalized.baseCurrencyCode !== baseCurrencyCode ||
    normalized.quoteCurrencyCode !== quoteCurrencyCode ||
    Date.parse(normalized.effectiveAt) > Date.parse(input.asOf)
  ) {
    throw exchangeRateUnavailable();
  }
  return normalized;
}

export function convertAmount(input: { readonly amount: string; readonly rate: string }): string {
  const amount = normalizeDecimalAmount(input.amount, {
    allowNegative: true,
    allowZero: true,
    maxScale: 24,
  });
  return new Decimal(amount).times(new Decimal(normalizeExchangeRate(input.rate))).toFixed(4);
}

export function convertMoney(input: {
  readonly amount: Money;
  readonly targetCurrencyCode: string;
  readonly rateSnapshot?: ExchangeRateSnapshot;
  readonly roundingMode?: RoundingMode;
}): Money {
  const sourceCurrency = requireCurrencyDefinition(input.amount.currency).code;
  const targetCurrency = requireCurrencyDefinition(input.targetCurrencyCode).code;
  const roundingMode = input.roundingMode ?? 'half_even';
  if (sourceCurrency === targetCurrency) {
    return createMoney(input.amount.amount, targetCurrency, {
      allowNegative: true,
      roundingMode,
    });
  }
  if (!input.rateSnapshot) throw exchangeRateUnavailable();
  const snapshot = validateExchangeRateSnapshot(input.rateSnapshot, input.rateSnapshot.source);
  const direction = getConversionDirection(snapshot, sourceCurrency, targetCurrency);
  const rate =
    direction === 'direct'
      ? new Decimal(snapshot.rate)
      : new Decimal(1).dividedBy(new Decimal(snapshot.rate));
  const amount = new Decimal(input.amount.amount).times(rate).toFixed();
  return createMoney(amount, targetCurrency, { allowNegative: true, roundingMode });
}

export function calculateFxGainLoss(input: {
  readonly bookedAmount: Money;
  readonly settledAmount: Money;
  readonly rateSnapshot?: ExchangeRateSnapshot;
  readonly roundingMode?: RoundingMode;
}): FxGainLossResult {
  const bookedCurrency = requireCurrencyDefinition(input.bookedAmount.currency).code;
  const settledCurrency = requireCurrencyDefinition(input.settledAmount.currency).code;
  const settledAmountAtBookedCurrency = convertMoney({
    amount: input.settledAmount,
    targetCurrencyCode: bookedCurrency,
    rateSnapshot: input.rateSnapshot,
    roundingMode: input.roundingMode,
  });
  const bookedAmount = createMoney(input.bookedAmount.amount, bookedCurrency, {
    allowNegative: true,
    roundingMode: input.roundingMode,
  });
  const settledAmount = createMoney(input.settledAmount.amount, settledCurrency, {
    allowNegative: true,
    roundingMode: input.roundingMode,
  });
  const gainLoss = subtractMoney(settledAmountAtBookedCurrency, bookedAmount, {
    roundingMode: input.roundingMode,
  });
  return {
    bookedAmount,
    settledAmount,
    settledAmountAtBookedCurrency,
    gainLoss,
    direction:
      gainLoss.amount === '0.00' || gainLoss.amount === '0'
        ? 'none'
        : gainLoss.amount.startsWith('-')
          ? 'loss'
          : 'gain',
    rateSnapshot: settledCurrency === bookedCurrency ? null : (input.rateSnapshot ?? null),
  };
}

export function freezeFxConversion(input: {
  readonly sourceAmount: Money;
  readonly targetCurrencyCode: string;
  readonly rateSnapshot?: ExchangeRateSnapshot;
  readonly roundingMode?: RoundingMode;
  readonly convertedAt: string;
}): FrozenFxConversion {
  assertTimestamp(input.convertedAt);
  const sourceCurrency = requireCurrencyDefinition(input.sourceAmount.currency).code;
  const targetCurrency = requireCurrencyDefinition(input.targetCurrencyCode).code;
  if (sourceCurrency === targetCurrency) {
    return {
      sourceAmount: createMoney(input.sourceAmount.amount, sourceCurrency, {
        allowNegative: true,
      }),
      targetAmount: convertMoney({
        amount: input.sourceAmount,
        targetCurrencyCode: targetCurrency,
        roundingMode: input.roundingMode,
      }),
      rateSnapshot: null,
      rateApplied: '1.000000000000',
      direction: 'identity',
      roundingMode: input.roundingMode ?? 'half_even',
      convertedAt: new Date(input.convertedAt).toISOString(),
    };
  }
  if (!input.rateSnapshot) throw exchangeRateUnavailable();
  const snapshot = validateExchangeRateSnapshot(input.rateSnapshot, input.rateSnapshot.source);
  const direction = getConversionDirection(snapshot, sourceCurrency, targetCurrency);
  const rateApplied =
    direction === 'direct'
      ? snapshot.rate
      : new Decimal(1).dividedBy(new Decimal(snapshot.rate)).toFixed(12);
  return {
    sourceAmount: createMoney(input.sourceAmount.amount, sourceCurrency, { allowNegative: true }),
    targetAmount: convertMoney({
      amount: input.sourceAmount,
      targetCurrencyCode: targetCurrency,
      rateSnapshot: snapshot,
      roundingMode: input.roundingMode,
    }),
    rateSnapshot: snapshot,
    rateApplied,
    direction,
    roundingMode: input.roundingMode ?? 'half_even',
    convertedAt: new Date(input.convertedAt).toISOString(),
  };
}

export function validateExchangeRateSnapshot(
  input: ExchangeRateSnapshot,
  expectedSource: string
): ExchangeRateSnapshot {
  const pair = validateCurrencyPair(input.baseCurrencyCode, input.quoteCurrencyCode);
  if (
    !expectedSource.trim() ||
    input.source !== expectedSource ||
    !input.source.trim() ||
    !isTimestamp(input.effectiveAt) ||
    !isTimestamp(input.fetchedAt) ||
    Date.parse(input.fetchedAt) < Date.parse(input.effectiveAt)
  ) {
    throw invalidCoreRequest();
  }
  return {
    ...input,
    baseCurrencyCode: pair.base,
    quoteCurrencyCode: pair.quote,
    rate: normalizeExchangeRate(input.rate),
    source: input.source.trim(),
    effectiveAt: new Date(input.effectiveAt).toISOString(),
    fetchedAt: new Date(input.fetchedAt).toISOString(),
  };
}

function getConversionDirection(
  snapshot: ExchangeRateSnapshot,
  sourceCurrency: CurrencyCode,
  targetCurrency: CurrencyCode
): 'direct' | 'inverse' {
  if (
    snapshot.baseCurrencyCode === sourceCurrency &&
    snapshot.quoteCurrencyCode === targetCurrency
  ) {
    return 'direct';
  }
  if (
    snapshot.baseCurrencyCode === targetCurrency &&
    snapshot.quoteCurrencyCode === sourceCurrency
  ) {
    return 'inverse';
  }
  throw invalidCoreRequest();
}

function validateCurrencyPair(
  baseCurrencyCode: string,
  quoteCurrencyCode: string
): { readonly base: CurrencyCode; readonly quote: CurrencyCode } {
  const base = requireCurrencyDefinition(baseCurrencyCode).code;
  const quote = requireCurrencyDefinition(quoteCurrencyCode).code;
  if (base === quote) throw invalidCoreRequest();
  return { base, quote };
}

function assertTimestamp(value: string): void {
  if (!isTimestamp(value)) throw invalidCoreRequest();
}

function isTimestamp(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

import Decimal from 'decimal.js';
import type { CurrencyCode, Money } from '@/types/core';
import {
  createMoney,
  normalizeDecimalAmount,
  requireCurrencyDefinition,
  roundDecimalAmount,
  type RoundingMode,
} from './money';
import { invalidCoreRequest } from './errors';

export type InvoiceRoundingScope = 'line' | 'total';

export interface InvoiceTaxRuleReference {
  readonly id: string;
  readonly version: string;
}

export interface InvoiceCalculationLineInput {
  readonly lineId: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly discountPercent?: string | null;
  readonly taxRatePercent?: string | null;
  readonly taxRule?: InvoiceTaxRuleReference | null;
}

export interface CalculatedInvoiceLine {
  readonly lineId: string;
  readonly quantity: string;
  readonly unitPrice: Money;
  readonly discountPercent: string;
  readonly taxRatePercent: string;
  readonly taxRule: InvoiceTaxRuleReference | null;
  readonly subtotal: Money;
  readonly discount: Money;
  readonly taxableAmount: Money;
  readonly tax: Money;
  readonly total: Money;
}

export interface InvoiceCalculation {
  readonly currencyCode: CurrencyCode;
  readonly roundingScope: InvoiceRoundingScope;
  readonly roundingMode: RoundingMode;
  readonly lines: readonly CalculatedInvoiceLine[];
  readonly subtotal: Money;
  readonly discountTotal: Money;
  readonly taxableTotal: Money;
  readonly taxTotal: Money;
  readonly total: Money;
}

export interface InvoiceCalculationOptions {
  readonly currencyCode: string;
  readonly roundingScope?: InvoiceRoundingScope;
  readonly roundingMode?: RoundingMode;
  readonly lines: readonly InvoiceCalculationLineInput[];
}

export function calculateInvoice(input: InvoiceCalculationOptions): InvoiceCalculation {
  if (input.lines.length === 0 || input.lines.length > 500) throw invalidCoreRequest();
  const currency = requireCurrencyDefinition(input.currencyCode).code;
  const roundingScope = input.roundingScope ?? 'line';
  const roundingMode = input.roundingMode ?? 'half_even';
  const lines = input.lines.map((line) =>
    calculateLine({ line, currency, roundingScope, roundingMode })
  );

  const rawLines = input.lines.map((line) => calculateRawLine(line));
  const subtotal = sumRawOrRounded(
    rawLines.map((line, index) =>
      roundingScope === 'line' ? lineAt(lines, index).subtotal.amount : line.subtotal
    ),
    currency,
    roundingMode
  );
  const discountTotal = sumRawOrRounded(
    rawLines.map((line, index) =>
      roundingScope === 'line' ? lineAt(lines, index).discount.amount : line.discount
    ),
    currency,
    roundingMode
  );
  const taxableTotal = sumRawOrRounded(
    rawLines.map((line, index) =>
      roundingScope === 'line' ? lineAt(lines, index).taxableAmount.amount : line.taxableAmount
    ),
    currency,
    roundingMode
  );
  const taxTotal = sumRawOrRounded(
    rawLines.map((line, index) =>
      roundingScope === 'line' ? lineAt(lines, index).tax.amount : line.tax
    ),
    currency,
    roundingMode
  );
  const total = sumRawOrRounded(
    rawLines.map((line, index) =>
      roundingScope === 'line' ? lineAt(lines, index).total.amount : line.total
    ),
    currency,
    roundingMode
  );

  return {
    currencyCode: currency,
    roundingScope,
    roundingMode,
    lines,
    subtotal,
    discountTotal,
    taxableTotal,
    taxTotal,
    total,
  };
}

interface RawInvoiceLine {
  readonly subtotal: string;
  readonly discount: string;
  readonly taxableAmount: string;
  readonly tax: string;
  readonly total: string;
}

function calculateLine(input: {
  readonly line: InvoiceCalculationLineInput;
  readonly currency: CurrencyCode;
  readonly roundingScope: InvoiceRoundingScope;
  readonly roundingMode: RoundingMode;
}): CalculatedInvoiceLine {
  const raw = calculateRawLine(input.line);
  const definition = requireCurrencyDefinition(input.currency);
  const quantity = normalizeDecimalAmount(input.line.quantity, {
    allowNegative: false,
    allowZero: false,
    maxScale: 18,
  });
  const unitPrice = createMoney(input.line.unitPrice, definition.code, { allowNegative: false });
  const discountPercent = normalizePercentage(input.line.discountPercent ?? '0');
  const taxRatePercent = normalizePercentage(input.line.taxRatePercent ?? '0');
  const taxRule = normalizeTaxRule(input.line.taxRule);
  const round = (value: string): Money =>
    createMoney(
      input.roundingScope === 'line'
        ? roundDecimalAmount(value, definition.decimalDigits, input.roundingMode)
        : value,
      definition.code,
      { allowNegative: false, roundingMode: input.roundingMode }
    );

  const subtotal = round(raw.subtotal);
  const discount = round(raw.discount);
  const taxableAmount = round(raw.taxableAmount);
  const tax = round(raw.tax);
  const total = round(raw.total);
  return {
    lineId: requireText(input.line.lineId),
    quantity,
    unitPrice,
    discountPercent,
    taxRatePercent,
    taxRule,
    subtotal,
    discount,
    taxableAmount,
    tax,
    total,
  };
}

function calculateRawLine(line: InvoiceCalculationLineInput): RawInvoiceLine {
  const quantity = new Decimal(
    normalizeDecimalAmount(line.quantity, { allowNegative: false, allowZero: false, maxScale: 18 })
  );
  const unitPrice = new Decimal(
    normalizeDecimalAmount(line.unitPrice, { allowNegative: false, allowZero: true, maxScale: 18 })
  );
  const discountPercent = new Decimal(normalizePercentage(line.discountPercent ?? '0'));
  const taxRatePercent = new Decimal(normalizePercentage(line.taxRatePercent ?? '0'));
  const subtotal = quantity.times(unitPrice);
  const discount = subtotal.times(discountPercent).dividedBy(100);
  const taxableAmount = subtotal.minus(discount);
  const tax = taxableAmount.times(taxRatePercent).dividedBy(100);
  return {
    subtotal: subtotal.toFixed(),
    discount: discount.toFixed(),
    taxableAmount: taxableAmount.toFixed(),
    tax: tax.toFixed(),
    total: taxableAmount.plus(tax).toFixed(),
  };
}

function sumRawOrRounded(
  values: readonly string[],
  currency: CurrencyCode,
  roundingMode: RoundingMode
): Money {
  const total = values.reduce((sum, value) => sum.plus(new Decimal(value)), new Decimal(0));
  return createMoney(total.toFixed(), currency, { allowNegative: false, roundingMode });
}

function normalizePercentage(value: string): string {
  const normalized = normalizeDecimalAmount(value, {
    allowNegative: false,
    allowZero: true,
    maxScale: 8,
  });
  if (new Decimal(normalized).greaterThan(100)) throw invalidCoreRequest();
  return normalized;
}

function normalizeTaxRule(
  value: InvoiceTaxRuleReference | null | undefined
): InvoiceTaxRuleReference | null {
  if (value === undefined || value === null) return null;
  const id = requireText(value.id);
  const version = requireText(value.version);
  return { id, version };
}

function lineAt(lines: readonly CalculatedInvoiceLine[], index: number): CalculatedInvoiceLine {
  const line = lines[index];
  if (!line) throw invalidCoreRequest();
  return line;
}

function requireText(value: string): string {
  if (!value.trim()) throw invalidCoreRequest();
  return value.trim();
}

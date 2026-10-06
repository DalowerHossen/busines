// src/lib/pdf/format.ts
// Pure formatting helpers shared by the PDF renderer and the browser print
// preview. They never perform monetary arithmetic with JavaScript numbers.
import Decimal from 'decimal.js';

import type { CurrencyCode, Money } from '@/types/core';
import { getCurrencyDefinition } from '@/config/currencies';

import { PdfRenderError } from './errors';

const AMOUNT_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u;

function parseAmount(value: string): Decimal {
  if (!AMOUNT_PATTERN.test(value)) throw new PdfRenderError('invalid_document');
  const amount = new Decimal(value);
  if (!amount.isFinite()) throw new PdfRenderError('invalid_document');
  return amount;
}

export function cleanPdfText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '')
    .replace(/[ \t]+/gu, ' ')
    .trim();
}

export function formatPdfMoney(value: Money, expectedCurrency?: CurrencyCode): string {
  if (expectedCurrency && value.currency !== expectedCurrency) {
    throw new PdfRenderError('invalid_document');
  }
  const definition = getCurrencyDefinition(value.currency);
  if (!definition) throw new PdfRenderError('unsupported_currency');

  const amount = parseAmount(value.amount);
  const fixed = amount.toFixed(definition.decimalDigits);
  const [whole = '0', fraction = ''] = fixed.split('.');
  const negative = whole.startsWith('-');
  const unsignedWhole = negative ? whole.slice(1) : whole;
  const groupedWhole = unsignedWhole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const numericValue = definition.decimalDigits > 0 ? `${groupedWhole}.${fraction}` : groupedWhole;
  return `${negative ? '-' : ''}${definition.code} ${numericValue}`;
}

export function formatPdfQuantity(value: string): string {
  const amount = parseAmount(value);
  return amount.toFixed(Math.min(Math.max(amount.decimalPlaces(), 0), 4));
}

export function formatPdfDate(value: string, locale = 'en-US'): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) throw new PdfRenderError('invalid_document');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new PdfRenderError('invalid_document');
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    throw new PdfRenderError('invalid_document');
  }
}

export function documentLabel(documentType: string): string {
  switch (documentType) {
    case 'invoice':
      return 'Invoice';
    case 'estimate':
      return 'Estimate';
    case 'credit_note':
      return 'Credit Note';
    case 'debit_note':
      return 'Debit Note';
    default:
      throw new PdfRenderError('invalid_document');
  }
}

import type { Money } from '@/types/core';
import { invalidCoreRequest } from './errors';
import { normalizeDecimalAmount, normalizeMoneyAmount, requireCurrencyDefinition } from './money';

const SMALL_NUMBERS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
] as const;

const TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
] as const;

const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'] as const;

const CURRENCY_UNIT_LABELS: Readonly<
  Record<string, { readonly major: string; readonly minor: string }>
> = {
  USD: { major: 'dollar', minor: 'cent' },
  BDT: { major: 'taka', minor: 'poisha' },
  INR: { major: 'rupee', minor: 'paisa' },
  PKR: { major: 'rupee', minor: 'paisa' },
  LKR: { major: 'rupee', minor: 'cent' },
  NPR: { major: 'rupee', minor: 'paisa' },
  PHP: { major: 'peso', minor: 'centavo' },
  IDR: { major: 'rupiah', minor: 'sen' },
  VND: { major: 'dong', minor: 'hao' },
  MYR: { major: 'ringgit', minor: 'sen' },
  SGD: { major: 'dollar', minor: 'cent' },
  THB: { major: 'baht', minor: 'satang' },
  AED: { major: 'dirham', minor: 'fils' },
  SAR: { major: 'riyal', minor: 'halala' },
  EUR: { major: 'euro', minor: 'cent' },
  GBP: { major: 'pound', minor: 'penny' },
  CAD: { major: 'dollar', minor: 'cent' },
  AUD: { major: 'dollar', minor: 'cent' },
  NZD: { major: 'dollar', minor: 'cent' },
  JPY: { major: 'yen', minor: 'sen' },
  CNY: { major: 'yuan', minor: 'fen' },
  HKD: { major: 'dollar', minor: 'cent' },
  KRW: { major: 'won', minor: 'jeon' },
  CHF: { major: 'franc', minor: 'centime' },
  SEK: { major: 'krona', minor: 'ore' },
  NOK: { major: 'krone', minor: 'ore' },
  DKK: { major: 'krone', minor: 'ore' },
  PLN: { major: 'zloty', minor: 'grosz' },
  TRY: { major: 'lira', minor: 'kurus' },
  ZAR: { major: 'rand', minor: 'cent' },
  NGN: { major: 'naira', minor: 'kobo' },
  KES: { major: 'shilling', minor: 'cent' },
  EGP: { major: 'pound', minor: 'piastre' },
  BRL: { major: 'real', minor: 'centavo' },
  MXN: { major: 'peso', minor: 'centavo' },
};

export function numberToWords(value: string): string {
  const normalized = normalizeDecimalAmount(value, {
    allowNegative: true,
    allowZero: true,
    maxScale: 18,
  });
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [integerPart = '0', fractionPart = ''] = unsigned.split('.');
  const integerWords = integerToWords(integerPart);
  const fractionWords = fractionPart
    ? ` point ${fractionPart
        .split('')
        .map((digit) => smallNumberToWords(Number(digit)))
        .join(' ')}`
    : '';
  return `${negative ? 'negative ' : ''}${integerWords}${fractionWords}`;
}

export function moneyToWords(value: Money): string {
  const definition = requireCurrencyDefinition(value.currency);
  const normalized = normalizeMoneyAmount(value.amount, definition.code, { allowNegative: true });
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [wholePart = '0', fractionPart = ''] = unsigned.split('.');
  const labels = CURRENCY_UNIT_LABELS[definition.code] ?? {
    major: definition.name.toLowerCase(),
    minor: 'minor unit',
  };
  const whole = integerToWords(wholePart);
  const majorLabel = pluralize(labels.major, wholePart);
  const minorDigits = fractionPart.replace(/0+$/u, '');
  const minorValue = minorDigits ? integerToWords(String(Number(fractionPart))) : '';
  const minorLabel = minorDigits ? pluralize(labels.minor, String(Number(fractionPart))) : '';
  const minorWords = minorDigits ? ` and ${minorValue} ${minorLabel}` : '';
  return `${negative ? 'negative ' : ''}${whole} ${majorLabel}${minorWords}`;
}

function integerToWords(value: string): string {
  if (!/^\d+$/u.test(value)) throw invalidCoreRequest();
  const trimmed = value.replace(/^0+(?=\d)/u, '');
  if (trimmed === '0') return 'zero';
  const groups: string[] = [];
  for (let end = trimmed.length; end > 0; end -= 3) {
    groups.unshift(trimmed.slice(Math.max(0, end - 3), end));
  }
  if (groups.length > SCALES.length) throw invalidCoreRequest();
  return groups
    .map((group, index) => {
      const numericGroup = Number(group);
      if (numericGroup === 0) return '';
      const scale = SCALES[groups.length - index - 1];
      return `${threeDigitGroupToWords(numericGroup)}${scale ? ` ${scale}` : ''}`;
    })
    .filter(Boolean)
    .join(' ');
}

function threeDigitGroupToWords(value: number): string {
  if (value < 20) return smallNumberToWords(value);
  if (value < 100) {
    const tens = Math.floor(value / 10);
    const remainder = value % 10;
    return remainder === 0
      ? tensToWords(tens)
      : `${tensToWords(tens)}-${smallNumberToWords(remainder)}`;
  }
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  return remainder === 0
    ? `${smallNumberToWords(hundreds)} hundred`
    : `${smallNumberToWords(hundreds)} hundred ${threeDigitGroupToWords(remainder)}`;
}

function smallNumberToWords(value: number): string {
  const word = SMALL_NUMBERS[value];
  if (!word) throw invalidCoreRequest();
  return word;
}

function tensToWords(value: number): string {
  const word = TENS[value];
  if (!word) throw invalidCoreRequest();
  return word;
}

function pluralize(unit: string, numericValue: string): string {
  if (numericValue === '1') return unit;
  if (unit === 'penny') return 'pence';
  if (unit === 'sen' || unit === 'taka' || unit === 'baht' || unit === 'yen' || unit === 'won') {
    return unit;
  }
  return `${unit}s`;
}

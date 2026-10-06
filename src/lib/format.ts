// src/lib/format.ts
// Display formatting. Every function is safe to call on the server and in the
// browser, and always produces English output.

import { currencyDecimals, findCurrency } from '@/config/currencies';
import { toDecimal, type MoneyInput } from '@/lib/money';

const DISPLAY_LOCALE = 'en-US';

/**
 * Formats an amount with its currency symbol.
 *
 * @param amount Amount in major units.
 * @param currency Three letter currency code.
 * @returns A string such as "$1,250.00".
 */
export function formatMoney(amount: MoneyInput, currency: string): string {
  const decimals = currencyDecimals(currency);
  const value = toDecimal(amount).toDecimalPlaces(decimals).toNumber();

  try {
    return new Intl.NumberFormat(DISPLAY_LOCALE, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    const symbol = findCurrency(currency)?.symbol ?? currency.toUpperCase();
    return `${symbol}${value.toFixed(decimals)}`;
  }
}

/**
 * Formats an amount without a currency symbol, for table columns that carry
 * the currency in their header.
 *
 * @param amount Amount in major units.
 * @param currency Three letter currency code.
 * @returns A grouped decimal string.
 */
export function formatAmount(amount: MoneyInput, currency: string): string {
  const decimals = currencyDecimals(currency);

  return new Intl.NumberFormat(DISPLAY_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(toDecimal(amount).toDecimalPlaces(decimals).toNumber());
}

/**
 * Formats a plain number with thousands separators.
 *
 * @param value Number to format.
 * @param fractionDigits How many decimals to show.
 * @returns A grouped number string.
 */
export function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(DISPLAY_LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/**
 * Formats a ratio as a percentage.
 *
 * @param value Percentage expressed out of one hundred.
 * @param fractionDigits How many decimals to show.
 * @returns A string such as "12.5%".
 */
export function formatPercentage(value: number, fractionDigits = 1): string {
  return `${formatNumber(value, fractionDigits)}%`;
}

/**
 * Formats a byte count for a file list.
 *
 * @param bytes Size in bytes.
 * @returns A string such as "1.4 MB".
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex] ?? 'TB'}`;
}

/**
 * Turns a database enum value into a readable label.
 *
 * @param value Snake case value such as "partially_paid".
 * @returns A capitalised label such as "Partially paid".
 */
export function humanise(value: string): string {
  const words = value.replace(/[_-]+/g, ' ').trim().toLowerCase();

  if (words.length === 0) {
    return '';
  }

  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Formats a person or company name into initials for an avatar.
 *
 * @param name Full name.
 * @returns One or two uppercase letters.
 */
export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return '';
  }

  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';

  return `${first}${last}`.toUpperCase();
}

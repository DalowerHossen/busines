// src/config/currencies.ts
// Central currency registry. Adding a new currency only requires adding one
// entry here; no other file needs to change. This list covers the
// platform's primary Asia-Pacific markets plus the major global currencies
// a client-facing invoice is likely to be issued in.
import type { CurrencyCode } from '@/types/core';

/**
 * Metadata for one supported currency.
 */
export interface CurrencyDefinition {
  readonly code: CurrencyCode;
  readonly name: string;
  readonly symbol: string;
  readonly decimalDigits: number;
}

function currency(
  code: string,
  name: string,
  symbol: string,
  decimalDigits: number
): CurrencyDefinition {
  return { code: code as CurrencyCode, name, symbol, decimalDigits };
}

/**
 * Every currency the platform supports out of the box, ordered with the
 * platform's primary markets first.
 */
export const SUPPORTED_CURRENCIES: readonly CurrencyDefinition[] = [
  currency('USD', 'United States Dollar', '$', 2),
  currency('BDT', 'Bangladeshi Taka', 'Tk', 2),
  currency('INR', 'Indian Rupee', '₹', 2),
  currency('PKR', 'Pakistani Rupee', 'Rs', 2),
  currency('LKR', 'Sri Lankan Rupee', 'Rs', 2),
  currency('NPR', 'Nepalese Rupee', 'Rs', 2),
  currency('PHP', 'Philippine Peso', '₱', 2),
  currency('IDR', 'Indonesian Rupiah', 'Rp', 0),
  currency('VND', 'Vietnamese Dong', '₫', 0),
  currency('MYR', 'Malaysian Ringgit', 'RM', 2),
  currency('SGD', 'Singapore Dollar', 'S$', 2),
  currency('THB', 'Thai Baht', '฿', 2),
  currency('AED', 'UAE Dirham', 'Dhs', 2),
  currency('SAR', 'Saudi Riyal', '﷼', 2),
  currency('EUR', 'Euro', '€', 2),
  currency('GBP', 'British Pound', '£', 2),
  currency('CAD', 'Canadian Dollar', 'C$', 2),
  currency('AUD', 'Australian Dollar', 'A$', 2),
  currency('NZD', 'New Zealand Dollar', 'NZ$', 2),
  currency('JPY', 'Japanese Yen', '¥', 0),
  currency('CNY', 'Chinese Yuan', '¥', 2),
  currency('HKD', 'Hong Kong Dollar', 'HK$', 2),
  currency('KRW', 'South Korean Won', '₩', 0),
  currency('CHF', 'Swiss Franc', 'CHF', 2),
  currency('SEK', 'Swedish Krona', 'kr', 2),
  currency('NOK', 'Norwegian Krone', 'kr', 2),
  currency('DKK', 'Danish Krone', 'kr', 2),
  currency('PLN', 'Polish Zloty', 'zl', 2),
  currency('TRY', 'Turkish Lira', '₺', 2),
  currency('ZAR', 'South African Rand', 'R', 2),
  currency('NGN', 'Nigerian Naira', '₦', 2),
  currency('KES', 'Kenyan Shilling', 'KSh', 2),
  currency('EGP', 'Egyptian Pound', 'E£', 2),
  currency('BRL', 'Brazilian Real', 'R$', 2),
  currency('MXN', 'Mexican Peso', '$', 2),
];

const CURRENCY_BY_CODE = new Map<string, CurrencyDefinition>(
  SUPPORTED_CURRENCIES.map((definition) => [definition.code, definition])
);

/**
 * The platform-wide default currency used when a company has not chosen
 * one yet.
 */
export const DEFAULT_CURRENCY_CODE: CurrencyCode = 'USD' as CurrencyCode;

/**
 * Looks up a currency's display metadata by its ISO 4217 code.
 *
 * @param code The currency code to look up.
 * @returns The matching definition, or `undefined` if the code is not
 * (yet) in {@link SUPPORTED_CURRENCIES}.
 */
export function getCurrencyDefinition(code: CurrencyCode): CurrencyDefinition | undefined {
  return CURRENCY_BY_CODE.get(code);
}

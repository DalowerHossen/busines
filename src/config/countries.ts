// src/config/countries.ts
// Central country registry used by address forms, phone dial-code lookup,
// and tax rules. Adding a new country only requires adding one entry here.
import type { CountryCode } from '@/types/core';

/**
 * Metadata for one supported country.
 */
export interface CountryDefinition {
  readonly code: CountryCode;
  readonly name: string;
  readonly dialCode: string;
  readonly defaultCurrencyCode: string;
  readonly currency: string;
}

function country(
  code: string,
  name: string,
  dialCode: string,
  defaultCurrencyCode: string
): CountryDefinition {
  return {
    code: code as CountryCode,
    name,
    dialCode,
    defaultCurrencyCode,
    currency: defaultCurrencyCode,
  };
}

/**
 * Every country the platform supports out of the box, ordered with the
 * platform's primary Asia-Pacific markets first, followed by major global
 * markets.
 */
export const SUPPORTED_COUNTRIES: readonly CountryDefinition[] = [
  country('BD', 'Bangladesh', '+880', 'BDT'),
  country('IN', 'India', '+91', 'INR'),
  country('PK', 'Pakistan', '+92', 'PKR'),
  country('LK', 'Sri Lanka', '+94', 'LKR'),
  country('NP', 'Nepal', '+977', 'NPR'),
  country('PH', 'Philippines', '+63', 'PHP'),
  country('ID', 'Indonesia', '+62', 'IDR'),
  country('VN', 'Vietnam', '+84', 'VND'),
  country('MY', 'Malaysia', '+60', 'MYR'),
  country('SG', 'Singapore', '+65', 'SGD'),
  country('TH', 'Thailand', '+66', 'THB'),
  country('AE', 'United Arab Emirates', '+971', 'AED'),
  country('SA', 'Saudi Arabia', '+966', 'SAR'),
  country('US', 'United States', '+1', 'USD'),
  country('GB', 'United Kingdom', '+44', 'GBP'),
  country('CA', 'Canada', '+1', 'CAD'),
  country('AU', 'Australia', '+61', 'AUD'),
  country('NZ', 'New Zealand', '+64', 'NZD'),
  country('DE', 'Germany', '+49', 'EUR'),
  country('FR', 'France', '+33', 'EUR'),
  country('NL', 'Netherlands', '+31', 'EUR'),
  country('ES', 'Spain', '+34', 'EUR'),
  country('IT', 'Italy', '+39', 'EUR'),
  country('IE', 'Ireland', '+353', 'EUR'),
  country('SE', 'Sweden', '+46', 'SEK'),
  country('NO', 'Norway', '+47', 'NOK'),
  country('DK', 'Denmark', '+45', 'DKK'),
  country('PL', 'Poland', '+48', 'PLN'),
  country('TR', 'Turkey', '+90', 'TRY'),
  country('JP', 'Japan', '+81', 'JPY'),
  country('CN', 'China', '+86', 'CNY'),
  country('HK', 'Hong Kong', '+852', 'HKD'),
  country('KR', 'South Korea', '+82', 'KRW'),
  country('ZA', 'South Africa', '+27', 'ZAR'),
  country('NG', 'Nigeria', '+234', 'NGN'),
  country('KE', 'Kenya', '+254', 'KES'),
  country('EG', 'Egypt', '+20', 'EGP'),
  country('BR', 'Brazil', '+55', 'BRL'),
  country('MX', 'Mexico', '+52', 'MXN'),
  country('CH', 'Switzerland', '+41', 'CHF'),
];

const COUNTRY_BY_CODE = new Map<string, CountryDefinition>(
  SUPPORTED_COUNTRIES.map((definition) => [definition.code, definition])
);

/**
 * Looks up a country's display metadata by its ISO 3166-1 alpha-2 code.
 *
 * @param code The country code to look up.
 * @returns The matching definition, or `undefined` if the code is not
 * (yet) in {@link SUPPORTED_COUNTRIES}.
 */
export function getCountryDefinition(code: CountryCode): CountryDefinition | undefined {
  return COUNTRY_BY_CODE.get(code);
}

export const COUNTRIES = SUPPORTED_COUNTRIES;
export function findCountry(code: string): CountryDefinition | undefined {
  return COUNTRY_BY_CODE.get(code.toUpperCase());
}

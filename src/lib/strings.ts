// src/lib/strings.ts
// Text handling shared by forms, documents and search.

/**
 * Trims a value and turns an empty string into null.
 *
 * @param value Raw text from a form or an import file.
 * @returns The trimmed text, or null when nothing is left.
 */
export function trimToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Lowercases and trims an email address for comparison.
 *
 * @param value Raw email address.
 * @returns The normalised address, or null when nothing is left.
 */
export function normaliseEmail(value: string | null | undefined): string | null {
  const trimmed = trimToNull(value);
  return trimmed ? trimmed.toLowerCase() : null;
}

/**
 * Reduces a telephone number to its digits so two spellings can be compared.
 *
 * @param value Raw telephone number.
 * @returns The digits only, or null when there are none.
 */
export function normalisePhone(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D+/g, '');
  return digits.length > 0 ? digits : null;
}

/**
 * Builds a URL friendly slug.
 *
 * @param value Text to convert.
 * @returns A lowercase slug made of letters, digits and hyphens.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Shortens text and adds an ellipsis when it was cut.
 *
 * @param value Text to shorten.
 * @param maxLength Longest result allowed, including the ellipsis.
 * @returns The shortened text.
 */
export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}\u2026`;
}

/**
 * Hides all but the last few characters of a secret.
 *
 * @param value Secret to mask.
 * @param visible How many trailing characters to leave readable.
 * @returns A masked string safe to display.
 */
export function maskSecret(value: string | null | undefined, visible = 4): string {
  const text = (value ?? '').trim();

  if (text.length === 0) {
    return '';
  }

  if (text.length <= visible) {
    return '\u2022'.repeat(text.length);
  }

  return `${'\u2022'.repeat(Math.min(12, text.length - visible))}${text.slice(-visible)}`;
}

/**
 * Hides the local part of an email address.
 *
 * @param value Email address to mask.
 * @returns A masked address such as "jo\u2022\u2022\u2022@example.com".
 */
export function maskEmail(value: string): string {
  const atIndex = value.indexOf('@');

  if (atIndex <= 0) {
    return maskSecret(value, 0);
  }

  const local = value.slice(0, atIndex);
  const domain = value.slice(atIndex);
  const head = local.slice(0, Math.min(2, local.length));

  return `${head}${'\u2022'.repeat(Math.max(1, local.length - head.length))}${domain}`;
}

/**
 * Escapes the characters PostgREST treats as wildcards in a search filter.
 *
 * @param value Raw search text.
 * @returns Text safe to interpolate into an "ilike" pattern.
 */
export function escapeSearchTerm(value: string): string {
  return value.replace(/[%_,()]/g, (match) => `\\${match}`).trim();
}

/**
 * Removes characters that would break a downloaded file name.
 *
 * @param value Proposed file name.
 * @param fallback Name used when nothing usable is left.
 * @returns A safe file name.
 */
export function safeFileName(value: string, fallback = 'document'): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.length > 0 ? cleaned.slice(0, 120) : fallback;
}

/**
 * Joins the parts of an address into display lines.
 *
 * @param parts Address parts in order, some of which may be missing.
 * @returns The non empty parts joined with commas.
 */
export function joinAddress(parts: readonly (string | null | undefined)[]): string {
  return parts
    .map((part) => trimToNull(part))
    .filter((part): part is string => part !== null)
    .join(', ');
}

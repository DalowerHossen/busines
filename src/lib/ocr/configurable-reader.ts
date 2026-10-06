// src/lib/ocr/configurable-reader.ts
// The reader everyone starts with. It posts the image to whatever service
// the business has an account with and reads the answer using the field
// names stored in the settings, so a different service is a change of
// configuration rather than a change of code.

import 'server-only';

import { logger } from '@/lib/logger';
import {
  EMPTY_FIELDS,
  type ReadFields,
  type ReadLine,
  type ReadOutcome,
  type ReadRequest,
  type ReceiptReader,
} from '@/lib/ocr/types';
import { isJsonObject, type Json, type JsonObject } from '@/types/json';

/** How long the platform waits for a reader before giving up. */
const READER_TIMEOUT_MS = 30_000;

/**
 * Reads one setting as text.
 *
 * @param settings Configuration stored for the reader.
 * @param key Setting to read.
 * @param fallback Value used when the setting is absent.
 * @returns The setting, or the fallback.
 */
function setting(settings: JsonObject, key: string, fallback: string): string {
  const value = settings[key];

  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

/**
 * Walks a dotted path into the answer.
 *
 * @param source The answer the reader gave.
 * @param path Dotted path, such as fields.total.
 * @returns What was found, or null.
 */
function at(source: Json, path: string): Json | null {
  let current: Json = source;

  for (const part of path.split('.')) {
    if (!isJsonObject(current)) {
      return null;
    }

    const next: Json | undefined = current[part];

    if (next === undefined) {
      return null;
    }

    current = next;
  }

  return current;
}

/**
 * Reads a value as text, whatever shape the reader used for it.
 *
 * @param value The value found in the answer.
 * @returns The text, or null.
 */
function asText(value: Json | null): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return typeof value === 'number' ? String(value) : null;
}

/**
 * Reads a confidence as a number between nothing and a hundred.
 *
 * @param value The value found in the answer.
 * @returns The confidence, or null.
 */
function asConfidence(value: Json | null): number | null {
  if (typeof value !== 'number') {
    return null;
  }

  // Some services answer with a fraction and some with a percentage.
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

export const configurableReceiptReader: ReceiptReader = {
  key: 'configurable',

  async read(request: ReadRequest, settings: JsonObject): Promise<ReadOutcome> {
    const endpoint = setting(settings, 'read_url', '');
    const apiKey = setting(settings, 'api_key', '');

    if (!endpoint || !apiKey) {
      return {
        status: 'not_configured',
        reason: 'No receipt reader has been set up for this business yet.',
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, READER_TIMEOUT_MS);

    try {
      const headerName = setting(settings, 'auth_header', 'authorization');
      const prefix = setting(settings, 'auth_prefix', 'Bearer ');

      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          [headerName.toLowerCase()]: `${prefix}${apiKey}`.trim(),
        },
        body: JSON.stringify({
          [setting(settings, 'reference_field', 'reference')]: request.scanId,
          [setting(settings, 'url_field', 'document_url')]: request.imageUrl,
          [setting(settings, 'type_field', 'content_type')]: request.contentType,
        }),
      });

      if (!response.ok) {
        return {
          status: 'failed',
          provider: setting(settings, 'provider_name', 'configurable'),
          reason: `The reader answered with status ${response.status}.`,
        };
      }

      const parsed: unknown = await response.json();

      if (!isJsonObject(parsed)) {
        return {
          status: 'failed',
          provider: setting(settings, 'provider_name', 'configurable'),
          reason: 'The reader answered with something that was not a set of fields.',
        };
      }

      const answer: Json = parsed;

      const fields: ReadFields = {
        ...EMPTY_FIELDS,
        merchant_name: asText(at(answer, setting(settings, 'merchant_path', 'merchant_name'))),
        merchant_tax_id: asText(at(answer, setting(settings, 'tax_id_path', 'merchant_tax_id'))),
        receipt_date: asText(at(answer, setting(settings, 'date_path', 'receipt_date'))),
        receipt_number: asText(at(answer, setting(settings, 'number_path', 'receipt_number'))),
        currency: asText(at(answer, setting(settings, 'currency_path', 'currency'))),
        subtotal_amount: asText(at(answer, setting(settings, 'subtotal_path', 'subtotal'))),
        tax_amount: asText(at(answer, setting(settings, 'tax_path', 'tax'))),
        tip_amount: asText(at(answer, setting(settings, 'tip_path', 'tip'))),
        total_amount: asText(at(answer, setting(settings, 'total_path', 'total'))),
        payment_method_hint: asText(at(answer, setting(settings, 'method_path', 'payment_method'))),
        card_last4: asText(at(answer, setting(settings, 'card_path', 'card_last4'))),
        confidence: {},
      };

      const confidenceSource = at(answer, setting(settings, 'confidence_path', 'confidence'));

      if (isJsonObject(confidenceSource)) {
        for (const [key, value] of Object.entries(confidenceSource)) {
          const score = asConfidence(value ?? null);

          if (score !== null) {
            fields.confidence[key] = score;
          }
        }
      }

      const rawLines = at(answer, setting(settings, 'lines_path', 'line_items'));
      const lines: ReadLine[] = Array.isArray(rawLines)
        ? rawLines.filter(isJsonObject).map((entry) => ({
            description: asText(entry.description ?? null) ?? 'Item',
            quantity: asText(entry.quantity ?? null),
            unit_price: asText(entry.unit_price ?? null),
            line_total: asText(entry.total ?? entry.line_total ?? null) ?? '0',
            tax_amount: asText(entry.tax ?? entry.tax_amount ?? null),
            confidence: asConfidence(entry.confidence ?? null),
          }))
        : [];

      const overall =
        asConfidence(
          at(answer, setting(settings, 'overall_confidence_path', 'confidence_score'))
        ) ??
        (Object.values(fields.confidence).length > 0
          ? Math.round(
              Object.values(fields.confidence).reduce((sum, value) => sum + value, 0) /
                Object.values(fields.confidence).length
            )
          : 0);

      return {
        status: 'read',
        provider: setting(settings, 'provider_name', 'configurable'),
        fields,
        lines,
        overallConfidence: overall,
        rawText: asText(at(answer, setting(settings, 'text_path', 'raw_text'))),
      };
    } catch (caught) {
      logger.warn('A receipt reader could not be reached', { scanId: request.scanId });

      return {
        status: 'failed',
        provider: setting(settings, 'provider_name', 'configurable'),
        reason:
          caught instanceof Error && caught.name === 'AbortError'
            ? 'The reader did not answer in time.'
            : 'The reader could not be reached.',
      };
    } finally {
      clearTimeout(timer);
    }
  },
};

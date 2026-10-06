// src/lib/ocr/types.ts
// What a receipt reader has to be able to do. Readers differ wildly in what
// they answer with, so each one maps its own answer into the one shape the
// rest of the platform understands.

import 'server-only';

import type { JsonObject } from '@/types/json';

export interface ReadRequest {
  /** Identifier of the scan, sent so a provider can echo it back. */
  scanId: string;
  /** Where the image is, so a provider that fetches can be given a link. */
  imageUrl: string | null;
  /** The bytes themselves, for a provider that wants them posted. */
  imageBytes: ArrayBuffer | null;
  /** The type the browser reported. */
  contentType: string;
}

export interface ReadFields {
  merchant_name: string | null;
  merchant_tax_id: string | null;
  receipt_date: string | null;
  receipt_number: string | null;
  currency: string | null;
  subtotal_amount: string | null;
  tax_amount: string | null;
  tip_amount: string | null;
  total_amount: string | null;
  payment_method_hint: string | null;
  card_last4: string | null;
  /** How sure the reader was about each field, from nothing to a hundred. */
  confidence: Record<string, number>;
}

export interface ReadLine {
  description: string;
  quantity: string | null;
  unit_price: string | null;
  line_total: string;
  tax_amount: string | null;
  confidence: number | null;
}

export type ReadOutcome =
  | {
      status: 'read';
      provider: string;
      fields: ReadFields;
      lines: readonly ReadLine[];
      overallConfidence: number;
      rawText: string | null;
    }
  | { status: 'failed'; provider: string; reason: string }
  | { status: 'not_configured'; reason: string };

export interface ReceiptReader {
  /** Name used in logs and stored against the scan. */
  readonly key: string;
  /**
   * Reads one receipt.
   *
   * @param request The image and what is known about it.
   * @param settings Endpoints and field names for a configurable reader.
   * @returns What the reader made of it.
   */
  read(request: ReadRequest, settings: JsonObject): Promise<ReadOutcome>;
}

/** An empty set of fields, so a reader only fills in what it actually found. */
export const EMPTY_FIELDS: ReadFields = {
  merchant_name: null,
  merchant_tax_id: null,
  receipt_date: null,
  receipt_number: null,
  currency: null,
  subtotal_amount: null,
  tax_amount: null,
  tip_amount: null,
  total_amount: null,
  payment_method_hint: null,
  card_last4: null,
  confidence: {},
};

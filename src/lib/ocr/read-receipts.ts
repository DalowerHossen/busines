// src/lib/ocr/read-receipts.ts
// The work of actually reading the receipts that are waiting. It claims a
// batch so two workers never read the same photograph, hands each one to the
// reader, and writes back either what was read or why it could not be.

import 'server-only';

import { serverEnv } from '@/env/server';
import { logger } from '@/lib/logger';
import { resolveReceiptReader } from '@/lib/ocr/registry';
import type { ReadOutcome } from '@/lib/ocr/types';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { asRows, readString, requireString } from '@/lib/records';
import type { JsonObject } from '@/types/json';

/** Bucket the receipt photographs live in. */
export const RECEIPT_BUCKET = 'receipts';

/** How long a link handed to a reader stays usable. */
const LINK_SECONDS = 600;

export interface ReadRunSummary {
  /** How many receipts were picked up. */
  claimed: number;
  /** How many came back with figures. */
  read: number;
  /** How many could not be read at all. */
  failed: number;
}

/**
 * Builds the settings the configurable reader works from.
 *
 * @returns Endpoints and field names, with the key from the environment.
 */
function readerSettings(): JsonObject {
  return {
    provider_name: 'configurable',
    read_url: serverEnv.OCR_PROVIDER_URL ?? '',
    api_key: serverEnv.OCR_PROVIDER_API_KEY ?? '',
  };
}

/**
 * Writes one outcome back against the scan.
 *
 * @param scanId The receipt that was read.
 * @param outcome What the reader made of it.
 * @returns True when figures were stored.
 */
async function storeOutcome(scanId: string, outcome: ReadOutcome): Promise<boolean> {
  const service = getServiceSupabaseClient();

  if (outcome.status === 'read') {
    const { error } = await service.rpc('record_receipt_result', {
      p_scan_id: scanId,
      p_provider: outcome.provider,
      p_fields: { ...outcome.fields },
      p_lines: outcome.lines.map((line) => ({ ...line })),
      p_overall_confidence: outcome.overallConfidence,
      p_raw_text: outcome.rawText,
    });

    if (!error) {
      return true;
    }

    logger.error('A receipt result could not be stored', error, { scanId });
  }

  const reason =
    outcome.status === 'read'
      ? 'The figures could not be stored against this receipt.'
      : outcome.reason;

  const { error: failureError } = await service.rpc('fail_receipt_scan', {
    p_scan_id: scanId,
    p_error_message: reason,
  });

  if (failureError) {
    logger.error('A receipt failure could not be recorded', failureError, { scanId });
  }

  return false;
}

/**
 * Reads the receipts that are waiting.
 *
 * @param limit How many to attempt in this run.
 * @returns What the run managed to do.
 */
export async function readWaitingReceipts(limit: number): Promise<ReadRunSummary> {
  const service = getServiceSupabaseClient();

  const { data, error } = await service.rpc('claim_receipt_scans', { p_limit: limit });

  if (error) {
    logger.error('Receipts waiting to be read could not be claimed', error);

    return { claimed: 0, read: 0, failed: 0 };
  }

  const rows = asRows(data);
  const settings = readerSettings();
  const reader = resolveReceiptReader(readString(settings, 'provider_name'));

  let read = 0;
  let failed = 0;

  for (const row of rows) {
    const scanId = requireString(row, 'id');
    const storageKey = readString(row, 'storage_key') ?? '';
    const contentType = readString(row, 'content_type') ?? 'image/jpeg';

    const { data: link } = await service.storage
      .from(RECEIPT_BUCKET)
      .createSignedUrl(storageKey, LINK_SECONDS);

    const outcome = await reader.read(
      {
        scanId,
        imageUrl: link?.signedUrl ?? null,
        imageBytes: null,
        contentType,
      },
      settings
    );

    if (await storeOutcome(scanId, outcome)) {
      read += 1;
    } else {
      failed += 1;
    }
  }

  logger.info('Receipts were read', { claimed: rows.length, read, failed });

  return { claimed: rows.length, read, failed };
}

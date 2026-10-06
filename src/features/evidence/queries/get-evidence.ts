// src/features/evidence/queries/get-evidence.ts
// Reading the proof attached to one invoice.

import type { WorkEvidenceItem, WorkEvidenceSummary } from '@/features/evidence/types';
import { logger } from '@/lib/logger';
import { asRows, readAmount, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject } from '@/types/json';

export interface WorkEvidenceBoard {
  items: readonly WorkEvidenceItem[];
  summary: WorkEvidenceSummary;
  /** True when the read failed. */
  isDegraded: boolean;
}

const EMPTY_SUMMARY: WorkEvidenceSummary = {
  itemCount: 0,
  clientVisibleCount: 0,
  fileCount: 0,
  linkCount: 0,
  hoursLogged: '0',
  isSealed: false,
};

/**
 * Reads the proof attached to one invoice, with its totals.
 *
 * @param invoiceId Invoice being read.
 * @returns The proof, the totals and whether the read failed.
 */
export async function loadWorkEvidence(invoiceId: string): Promise<WorkEvidenceBoard> {
  const supabase = createServerSupabaseClient();

  const [items, summary] = await Promise.all([
    supabase.rpc('invoice_work_evidence', { p_invoice_id: invoiceId }),
    supabase.rpc('work_evidence_summary', { p_invoice_id: invoiceId }),
  ]);

  if (items.error || summary.error) {
    logger.error('The proof of work could not be read', items.error ?? summary.error, {
      invoiceId,
    });

    return { items: [], summary: EMPTY_SUMMARY, isDegraded: true };
  }

  const totals = isJsonObject(summary.data) ? summary.data : {};

  /**
   * Reads a counter out of the totals.
   *
   * @param key Field being read.
   * @returns The count, or zero.
   */
  function count(key: string): number {
    const value = totals[key];

    return typeof value === 'number' ? value : Number(value ?? 0) || 0;
  }

  return {
    items: asRows(items.data).map((row) => ({
      evidenceId: readString(row, 'evidence_id') ?? '',
      kind: readString(row, 'kind') ?? 'note',
      title: readString(row, 'title') ?? '',
      description: readString(row, 'description'),
      fileId: readString(row, 'file_id'),
      fileName: readString(row, 'file_name'),
      byteSize: readNumber(row, 'byte_size') ?? 0,
      externalUrl: readString(row, 'external_url'),
      hoursWorked: row['hours_worked'] === null ? null : readAmount(row, 'hours_worked'),
      performedOn: readString(row, 'performed_on'),
      isClientVisible: readBoolean(row, 'is_client_visible'),
      isSealed: readBoolean(row, 'is_sealed'),
      createdAt: readString(row, 'created_at') ?? '',
    })),
    summary: {
      itemCount: count('item_count'),
      clientVisibleCount: count('client_visible_count'),
      fileCount: count('file_count'),
      linkCount: count('link_count'),
      hoursLogged: String(totals['hours_logged'] ?? '0'),
      isSealed: totals['is_sealed'] === true,
    },
    isDegraded: false,
  };
}

// src/features/disputes/queries/get-dispute.ts
// Reading one chargeback together with the evidence gathered to answer it.

import { DISPUTE_COLUMNS, toDispute } from '@/features/disputes/queries/list-disputes';
import type { DisputeDetail, DisputeEvidenceItem } from '@/features/disputes/types';
import { logger } from '@/lib/logger';
import { asRow, asRows, readBoolean, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';

/**
 * Maps one piece of evidence.
 *
 * @param row Row read from public.dispute_evidence_items.
 * @returns The evidence the page renders.
 */
function toEvidence(row: DatabaseRow): DisputeEvidenceItem {
  return {
    id: readString(row, 'id') ?? '',
    evidenceType: readString(row, 'evidence_type') ?? 'note',
    title: readString(row, 'title') ?? '',
    description: readString(row, 'description'),
    fileName: readString(row, 'file_name'),
    collectedAt: readString(row, 'collected_at') ?? '',
    isIncluded: readBoolean(row, 'included_in_submission', true),
  };
}

/**
 * Reads one chargeback belonging to a business.
 *
 * @param companyId Company the dispute must belong to.
 * @param disputeId Dispute being opened.
 * @returns The dispute and its evidence, or null when there is none.
 */
export async function getDispute(
  companyId: string,
  disputeId: string
): Promise<DisputeDetail | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('disputes')
    .select(DISPUTE_COLUMNS)
    .eq('company_id', companyId)
    .eq('id', disputeId)
    .is('deleted_at', null)
    .maybeSingle();

  const row = asRow(data);

  if (error || row === null) {
    if (error) {
      logger.error('A dispute could not be read', error, { companyId, disputeId });
    }

    return null;
  }

  const { data: evidenceData, error: evidenceError } = await supabase
    .from('dispute_evidence_items')
    .select(
      'id, evidence_type, title, description, file_name, collected_at, included_in_submission'
    )
    .eq('company_id', companyId)
    .eq('dispute_id', disputeId)
    .order('collected_at', { ascending: true });

  if (evidenceError) {
    logger.error('The evidence of a dispute could not be read', evidenceError, { disputeId });
  }

  return { ...toDispute(row), evidence: asRows(evidenceData).map(toEvidence) };
}

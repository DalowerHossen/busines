// src/features/banking/queries/get-banking-overview.ts
// Feed health, the size of the queue and what the engine has learned, in one
// read, so the page opens with an answer.

import type { ReconciliationOverview } from '@/features/banking/types';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject } from '@/types/json';

const EMPTY: ReconciliationOverview = {
  connections: 0,
  connectionsNeedingAttention: 0,
  linkedAccounts: 0,
  unlinkedAccounts: 0,
  linesToReview: 0,
  valueToReview: '0',
  oldestUnreviewedDate: null,
  matchedLast30Days: 0,
  learnedCounterparties: 0,
};

/**
 * Reads one number out of the summary.
 *
 * @param source Summary returned by the database.
 * @param key Figure being read.
 * @returns The figure, or zero.
 */
function count(source: Record<string, unknown>, key: string): number {
  const value = source[key];

  return typeof value === 'number' ? value : 0;
}

/**
 * Reads the reconciliation summary of one business.
 *
 * @param companyId Business being summarised.
 * @returns The figures, which are all zero when the read failed.
 */
export async function loadBankingOverview(companyId: string): Promise<ReconciliationOverview> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('reconciliation_overview', {
    p_company_id: companyId,
  });

  if (error || !isJsonObject(data)) {
    if (error) {
      logger.error('The reconciliation summary could not be read', error, { companyId });
    }

    return EMPTY;
  }

  const value = data.value_to_review;
  const oldest = data.oldest_unreviewed_date;

  return {
    connections: count(data, 'connections'),
    connectionsNeedingAttention: count(data, 'connections_needing_attention'),
    linkedAccounts: count(data, 'linked_accounts'),
    unlinkedAccounts: count(data, 'unlinked_accounts'),
    linesToReview: count(data, 'lines_to_review'),
    valueToReview: typeof value === 'number' ? String(value) : String(value ?? '0'),
    oldestUnreviewedDate: typeof oldest === 'string' ? oldest : null,
    matchedLast30Days: count(data, 'matched_last_30_days'),
    learnedCounterparties: count(data, 'learned_counterparties'),
  };
}

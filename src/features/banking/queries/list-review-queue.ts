// src/features/banking/queries/list-review-queue.ts
// Reading the statement lines that still need a decision, with the records
// that could explain each one already attached.

import type { BankLineRecord, MatchCandidate } from '@/features/banking/types';
import { logger } from '@/lib/logger';
import { asRows, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ReviewQueueEntry {
  line: BankLineRecord;
  candidates: readonly MatchCandidate[];
}

export interface ReviewQueueResult {
  entries: readonly ReviewQueueEntry[];
  /** True when the queue could not be read. */
  isDegraded: boolean;
}

/** How many lines are offered on one screen. */
const QUEUE_LIMIT = 25;

/** How many candidates are offered for one line. */
const CANDIDATE_LIMIT = 4;

/**
 * Reads the review queue of one business.
 *
 * @param companyId Business whose queue is being read.
 * @returns The queue, and whether the read failed.
 */
export async function loadReviewQueue(companyId: string): Promise<ReviewQueueResult> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('bank_lines_to_review', {
    p_company_id: companyId,
    p_limit: QUEUE_LIMIT,
  });

  if (error) {
    logger.error('The reconciliation queue could not be read', error, { companyId });

    return { entries: [], isDegraded: true };
  }

  const lines: BankLineRecord[] = asRows(data).map((row) => ({
    bankTransactionId: readString(row, 'bank_transaction_id') ?? '',
    bankAccountId: readString(row, 'bank_account_id') ?? '',
    bankAccountName: readString(row, 'bank_account_name') ?? '',
    transactionDate: readString(row, 'transaction_date') ?? '',
    amount: readString(row, 'amount') ?? '0',
    currency: readString(row, 'currency') ?? 'USD',
    description: readString(row, 'description') ?? '',
    counterpartyName: readString(row, 'counterparty_name'),
    reference: readString(row, 'reference'),
    status: readString(row, 'status') ?? 'unmatched',
    importSource: readString(row, 'import_source') ?? 'manual',
    suggestionCount: readNumber(row, 'suggestion_count') ?? 0,
    bestConfidence: readString(row, 'best_confidence') ?? '0',
    rememberedConfidence: readString(row, 'remembered_confidence') ?? '0',
  }));

  const entries = await Promise.all(
    lines.map(async (line) => {
      const { data: candidateData, error: candidateError } = await supabase.rpc(
        'candidate_matches',
        { p_bank_transaction_id: line.bankTransactionId, p_limit: CANDIDATE_LIMIT }
      );

      if (candidateError) {
        logger.warn('The candidates for one statement line could not be read', {
          companyId,
        });

        return { line, candidates: [] };
      }

      const candidates = asRows(candidateData).map((row) => ({
        recordType: readString(row, 'record_type') ?? '',
        recordId: readString(row, 'record_id') ?? '',
        recordLabel: readString(row, 'record_label') ?? '',
        matchedAmount: readString(row, 'matched_amount') ?? '0',
        confidence: readString(row, 'confidence') ?? '0',
        matchReason: readString(row, 'match_reason') ?? '',
      }));

      return { line, candidates };
    })
  );

  return { entries, isDegraded: false };
}

// src/features/banking/actions/settle-line.ts
// Saying what a statement line actually was. The choice is also remembered,
// so the same counterparty is guessed correctly next month.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { settleLineSchema } from '@/features/banking/validation/banking';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SettleLineResult {
  /** Identifier of the match that was recorded. */
  matchId: string;
}

export const settleBankLine = createAction(
  settleLineSchema,
  async (input): Promise<SettleLineResult> => {
    const { company } = await requirePermission('banking', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('settle_bank_line', {
      p_bank_transaction_id: input.bankTransactionId,
      p_record_type: input.recordType,
      p_record_id: input.recordId,
      p_confidence: input.confidence,
    });

    if (error || typeof data !== 'string') {
      logger.error('A statement line could not be settled', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        error?.message ?? 'That line could not be settled. Try again.'
      );
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'bank_transaction',
      entityId: input.bankTransactionId,
      companyId: company.id,
      description: `Settled a statement line against a ${input.recordType.replace('_', ' ')}`,
      metadata: { recordType: input.recordType, recordId: input.recordId },
    });

    revalidatePath(ROUTES.banking);

    return { matchId: data };
  },
  { name: 'settleBankLine' }
);

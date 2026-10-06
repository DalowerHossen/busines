// src/features/banking/actions/unmatch-line.ts
// Undoing a match, because people make mistakes and have to be able to fix
// them without going near the database.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { unmatchLineSchema } from '@/features/banking/validation/banking';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface UnmatchLineResult {
  /** True when the line is back in the queue. */
  isUnmatched: boolean;
}

export const unmatchBankLine = createAction(
  unmatchLineSchema,
  async (input): Promise<UnmatchLineResult> => {
    const { company } = await requirePermission('banking', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('unmatch_bank_transaction', {
      p_bank_transaction_id: input.bankTransactionId,
      p_reason: input.reason ?? null,
    });

    if (error) {
      logger.error('A match could not be undone', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'bank_transaction',
      entityId: input.bankTransactionId,
      companyId: company.id,
      description: 'Undid the match on a statement line',
    });

    revalidatePath(ROUTES.banking);

    return { isUnmatched: data === true };
  },
  { name: 'unmatchBankLine' }
);

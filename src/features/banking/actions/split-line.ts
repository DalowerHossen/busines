// src/features/banking/actions/split-line.ts
// Dividing one statement line across several things it paid for. The parts
// have to add up to the line exactly, which the database insists on.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { splitLineSchema } from '@/features/banking/validation/banking';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SplitLineResult {
  /** How many parts the line was divided into. */
  partCount: number;
}

export const splitBankLine = createAction(
  splitLineSchema,
  async (input): Promise<SplitLineResult> => {
    const { company } = await requirePermission('banking', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('split_bank_transaction', {
      p_bank_transaction_id: input.bankTransactionId,
      p_splits: input.parts.map((part) => ({
        amount: part.amount,
        note: part.note ?? null,
      })),
    });

    if (error || typeof data !== 'number') {
      logger.error('A statement line could not be divided', error, {
        companyId: company.id,
      });

      throw new AppError(
        'database_failure',
        error?.message ?? 'That line could not be divided. Try again.'
      );
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'bank_transaction',
      entityId: input.bankTransactionId,
      companyId: company.id,
      description: `Divided a statement line into ${data} parts`,
    });

    revalidatePath(ROUTES.banking);

    return { partCount: data };
  },
  { name: 'splitBankLine' }
);

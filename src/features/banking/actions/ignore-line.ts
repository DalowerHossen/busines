// src/features/banking/actions/ignore-line.ts
// Setting a line aside. A bank charge or an internal transfer is not hidden,
// it is put away with a reason anybody can read later.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { ignoreLineSchema } from '@/features/banking/validation/banking';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface IgnoreLineResult {
  /** True when the line is now set aside. */
  isIgnored: boolean;
}

export const ignoreBankLine = createAction(
  ignoreLineSchema,
  async (input): Promise<IgnoreLineResult> => {
    const { company } = await requirePermission('banking', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('ignore_bank_line', {
      p_bank_transaction_id: input.bankTransactionId,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('A statement line could not be set aside', error, {
        companyId: company.id,
      });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'bank_transaction',
      entityId: input.bankTransactionId,
      companyId: company.id,
      description: 'Set a statement line aside',
      metadata: { reason: input.reason },
    });

    revalidatePath(ROUTES.banking);

    return { isIgnored: data === true };
  },
  { name: 'ignoreBankLine' }
);

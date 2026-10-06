// src/features/expenses/actions/restore-expense.ts
// Brings a deleted claim back into the working lists.

'use server';

import { revalidatePath } from 'next/cache';

import { expenseIdSchema } from '@/features/expenses/validation/expense';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RestoreExpenseResult {
  /** Identifier of the claim that was brought back. */
  expenseId: string;
}

export const restoreExpense = createAction(
  expenseIdSchema,
  async (input): Promise<RestoreExpenseResult> => {
    const { user, company } = await requirePermission('expenses', 'delete');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('expenses')
      .update({ deleted_at: null, updated_by: user.id })
      .eq('company_id', company.id)
      .eq('id', input.expenseId)
      .not('deleted_at', 'is', null)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Could not restore an expense', error, { companyId: company.id });

      throw new AppError('database_failure', 'The expense could not be restored just now.');
    }

    if (asRow(data) === null) {
      throw new AppError('not_found', 'That expense is not in the deleted list.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'expense',
      entityId: input.expenseId,
      companyId: company.id,
      description: 'Deleted expense claim restored.',
    });

    revalidatePath('/dashboard/expenses');

    return { expenseId: input.expenseId };
  },
  { name: 'restoreExpense' }
);

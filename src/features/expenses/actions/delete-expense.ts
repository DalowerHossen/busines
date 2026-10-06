// src/features/expenses/actions/delete-expense.ts
// Takes a claim out of the working lists without losing it.

'use server';

import { revalidatePath } from 'next/cache';

import { expenseIdSchema } from '@/features/expenses/validation/expense';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readBoolean } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface DeleteExpenseResult {
  /** Identifier of the claim that was removed. */
  expenseId: string;
}

export const deleteExpense = createAction(
  expenseIdSchema,
  async (input): Promise<DeleteExpenseResult> => {
    const { user, company } = await requirePermission('expenses', 'delete');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const existing = await supabase
      .from('expenses')
      .select('id, invoiced_at, is_paid')
      .eq('company_id', company.id)
      .eq('id', input.expenseId)
      .is('deleted_at', null)
      .maybeSingle();

    const current = asRow(existing.data);

    if (existing.error !== null || current === null) {
      throw new AppError('not_found', 'That expense no longer exists.');
    }

    if (current['invoiced_at'] !== null && current['invoiced_at'] !== undefined) {
      throw new AppError(
        'conflict',
        'This claim has already been recharged to a client, so it has to stay on record.'
      );
    }

    if (readBoolean(current, 'is_paid')) {
      throw new AppError(
        'conflict',
        'This claim has been paid, so it has to stay on record. Record a correcting expense instead.'
      );
    }

    const { error } = await supabase
      .from('expenses')
      .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
      .eq('company_id', company.id)
      .eq('id', input.expenseId);

    if (error) {
      logger.error('Could not delete an expense', error, { companyId: company.id });

      throw new AppError('database_failure', 'The expense could not be removed just now.');
    }

    await recordAuditEntry({
      action: 'soft_delete',
      entityType: 'expense',
      entityId: input.expenseId,
      companyId: company.id,
      description: 'Expense claim deleted.',
    });

    revalidatePath('/dashboard/expenses');

    return { expenseId: input.expenseId };
  },
  { name: 'deleteExpense' }
);

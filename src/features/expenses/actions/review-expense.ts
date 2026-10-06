// src/features/expenses/actions/review-expense.ts
// Approves a claim or sends it back. The database refuses an approval by the
// person who made the claim, so the rule holds even outside this action.

'use server';

import { revalidatePath } from 'next/cache';

import { reviewExpenseSchema } from '@/features/expenses/validation/expense';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ReviewExpenseResult {
  /** Identifier of the claim that was reviewed. */
  expenseId: string;
  /** True when the claim was approved. */
  isApproved: boolean;
}

export const reviewExpense = createAction(
  reviewExpenseSchema,
  async (input): Promise<ReviewExpenseResult> => {
    const { company } = await requirePermission('expenses', 'approve');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('review_expense', {
      p_expense_id: input.expenseId,
      p_approve: input.approve,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('Could not review an expense', error, {
        companyId: company.id,
        expenseId: input.expenseId,
      });

      throw new AppError(
        'conflict',
        'The claim could not be reviewed. It may already have been dealt with, or it may be your own claim.'
      );
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'expense',
      entityId: input.expenseId,
      companyId: company.id,
      description: input.approve ? 'Expense claim approved.' : 'Expense claim sent back.',
    });

    revalidatePath('/dashboard/expenses');
    revalidatePath(`/dashboard/expenses/${input.expenseId}`);

    return { expenseId: input.expenseId, isApproved: input.approve };
  },
  { name: 'reviewExpense' }
);

// src/features/expenses/actions/submit-expense.ts
// Sends a claim to the owner for approval.

'use server';

import { revalidatePath } from 'next/cache';

import { expenseIdSchema } from '@/features/expenses/validation/expense';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SubmitExpenseResult {
  /** Identifier of the claim that was sent. */
  expenseId: string;
}

export const submitExpense = createAction(
  expenseIdSchema,
  async (input): Promise<SubmitExpenseResult> => {
    const { user, company } = await requirePermission('expenses', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const existing = await supabase
      .from('expenses')
      .select('id, status')
      .eq('company_id', company.id)
      .eq('id', input.expenseId)
      .is('deleted_at', null)
      .maybeSingle();

    const current = asRow(existing.data);

    if (existing.error !== null || current === null) {
      throw new AppError('not_found', 'That expense no longer exists.');
    }

    const status = readString(current, 'status');

    if (status !== 'draft' && status !== 'rejected') {
      throw new AppError('conflict', 'This claim has already been sent for approval.');
    }

    const { error } = await supabase
      .from('expenses')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        submitted_by: user.id,
        rejected_at: null,
        rejection_reason: null,
        updated_by: user.id,
      })
      .eq('company_id', company.id)
      .eq('id', input.expenseId);

    if (error) {
      logger.error('Could not submit an expense', error, { companyId: company.id });

      throw new AppError('database_failure', 'The claim could not be sent just now.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'expense',
      entityId: input.expenseId,
      companyId: company.id,
      description: 'Expense claim sent for approval.',
    });

    revalidatePath('/dashboard/expenses');
    revalidatePath(`/dashboard/expenses/${input.expenseId}`);

    return { expenseId: input.expenseId };
  },
  { name: 'submitExpense' }
);

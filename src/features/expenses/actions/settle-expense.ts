// src/features/expenses/actions/settle-expense.ts
// Marks an approved claim as paid, and reimburses the person who paid for it
// out of their own pocket.

'use server';

import { revalidatePath } from 'next/cache';

import { settleExpenseSchema } from '@/features/expenses/validation/expense';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readBoolean, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/json';

export interface SettleExpenseResult {
  /** Identifier of the claim that was settled. */
  expenseId: string;
}

export const settleExpense = createAction(
  settleExpenseSchema,
  async (input): Promise<SettleExpenseResult> => {
    const { user, company } = await requirePermission('expenses', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const existing = await supabase
      .from('expenses')
      .select('id, status, is_paid, is_reimbursable')
      .eq('company_id', company.id)
      .eq('id', input.expenseId)
      .is('deleted_at', null)
      .maybeSingle();

    const current = asRow(existing.data);

    if (existing.error !== null || current === null) {
      throw new AppError('not_found', 'That expense no longer exists.');
    }

    if (readBoolean(current, 'is_paid')) {
      throw new AppError('conflict', 'This claim is already marked as paid.');
    }

    const status = readString(current, 'status');

    if (status === 'rejected') {
      throw new AppError('conflict', 'A claim that was sent back cannot be paid.');
    }

    const paidAt = `${input.paidOn}T00:00:00.000Z`;
    const changes: Record<string, Json> = {
      is_paid: true,
      paid_at: paidAt,
      updated_by: user.id,
    };

    if (input.paymentMethod !== null) {
      changes['payment_method'] = input.paymentMethod;
    }

    if (readBoolean(current, 'is_reimbursable')) {
      changes['status'] = 'reimbursed';
      changes['reimbursed_at'] = paidAt;
    }

    const { error } = await supabase
      .from('expenses')
      .update(changes)
      .eq('company_id', company.id)
      .eq('id', input.expenseId);

    if (error) {
      logger.error('Could not settle an expense', error, { companyId: company.id });

      throw new AppError('database_failure', 'The payment could not be recorded just now.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'expense',
      entityId: input.expenseId,
      companyId: company.id,
      description: 'Expense claim marked as paid.',
    });

    revalidatePath('/dashboard/expenses');
    revalidatePath(`/dashboard/expenses/${input.expenseId}`);

    return { expenseId: input.expenseId };
  },
  { name: 'settleExpense' }
);

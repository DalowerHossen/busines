// src/features/expenses/actions/update-expense.ts
// Corrects a claim that has not been approved yet.

'use server';

import { revalidatePath } from 'next/cache';

import { updateExpenseSchema } from '@/features/expenses/validation/expense';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { addMoney, toStoredAmount } from '@/lib/money';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface UpdateExpenseResult {
  /** Identifier of the claim that was saved. */
  expenseId: string;
}

export const updateExpense = createAction(
  updateExpenseSchema,
  async (input): Promise<UpdateExpenseResult> => {
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
      throw new AppError(
        'conflict',
        'An approved claim cannot be edited. Record a correcting expense instead.'
      );
    }

    const total = toStoredAmount(addMoney(input.subtotalAmount, input.taxAmount));

    const { error } = await supabase
      .from('expenses')
      .update({
        description: input.description,
        expense_date: input.expenseDate,
        vendor_id: input.vendorId,
        category_id: input.categoryId,
        reference: input.reference,
        currency: input.currency,
        subtotal_amount: input.subtotalAmount,
        tax_rate_id: input.taxRateId,
        tax_amount: input.taxAmount,
        total_amount: total,
        base_currency_amount: total,
        payment_method: input.paymentMethod,
        is_paid: input.isPaid,
        is_billable: input.isBillable,
        client_id: input.clientId,
        markup_percentage: input.markupPercentage,
        is_reimbursable: input.isReimbursable,
        paid_by_user_id: input.isReimbursable ? user.id : null,
        notes: input.notes,
        updated_by: user.id,
      })
      .eq('company_id', company.id)
      .eq('id', input.expenseId);

    if (error) {
      logger.error('Could not save an expense', error, { companyId: company.id });

      throw new AppError('database_failure', 'The expense could not be saved. Please try again.');
    }

    revalidatePath('/dashboard/expenses');
    revalidatePath(`/dashboard/expenses/${input.expenseId}`);

    return { expenseId: input.expenseId };
  },
  { name: 'updateExpense' }
);

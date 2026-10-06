// src/features/expenses/actions/create-expense.ts
// Records money the business has spent. The claim starts as a draft so the
// receipt and the amount can be checked before anyone approves it.

'use server';

import { revalidatePath } from 'next/cache';

import { createExpenseSchema } from '@/features/expenses/validation/expense';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { addMoney, toStoredAmount } from '@/lib/money';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface CreateExpenseResult {
  /** Identifier of the claim that was created. */
  expenseId: string;
}

export const createExpense = createAction(
  createExpenseSchema,
  async (input): Promise<CreateExpenseResult> => {
    const { user, company } = await requirePermission('expenses', 'create');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();
    const total = toStoredAmount(addMoney(input.subtotalAmount, input.taxAmount));

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        company_id: company.id,
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
        paid_at: input.isPaid ? new Date().toISOString() : null,
        is_billable: input.isBillable,
        client_id: input.clientId,
        markup_percentage: input.markupPercentage,
        is_reimbursable: input.isReimbursable,
        paid_by_user_id: input.isReimbursable ? user.id : null,
        notes: input.notes,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Could not record an expense', error, { companyId: company.id });

      throw new AppError('database_failure', 'The expense could not be saved. Please try again.');
    }

    const expenseId = readString(asRow(data) ?? {}, 'id');

    if (expenseId === null) {
      throw new AppError('database_failure', 'The expense was saved but could not be read back.');
    }

    revalidatePath('/dashboard/expenses');

    return { expenseId };
  },
  { name: 'createExpense' }
);

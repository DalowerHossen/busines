// src/features/expenses/queries/get-expense.ts
// Reading one expense claim in full.

import { toExpenseDetail } from '@/features/expenses/mappers';
import type { ExpenseDetail } from '@/features/expenses/types';
import { logger } from '@/lib/logger';
import { asRow } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const DETAIL_COLUMNS =
  'id, expense_number, status, description, expense_date, reference, vendor_id, category_id, currency, subtotal_amount, tax_amount, tax_rate_id, total_amount, payment_method, is_paid, paid_at, is_billable, client_id, markup_percentage, invoiced_at, invoice_id, is_reimbursable, paid_by_user_id, reimbursed_at, receipt_file_name, submitted_at, approved_at, rejected_at, rejection_reason, notes, created_at, deleted_at, vendors(display_name), expense_categories(name), clients(display_name)';

/**
 * Reads one expense claim of a company.
 *
 * @param companyId Company the claim must belong to.
 * @param expenseId Claim being opened.
 * @returns The claim, or null when it does not exist.
 */
export async function getExpense(
  companyId: string,
  expenseId: string
): Promise<ExpenseDetail | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('expenses')
    .select(DETAIL_COLUMNS)
    .eq('company_id', companyId)
    .eq('id', expenseId)
    .maybeSingle();

  if (error) {
    logger.error('Could not read an expense', error, { companyId, expenseId });
    return null;
  }

  const row = asRow(data);

  return row === null ? null : toExpenseDetail(row);
}

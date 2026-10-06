// src/features/expenses/queries/expense-form-data.ts
// The suppliers, categories and clients the expense form offers.

import type {
  ExpenseCategoryOption,
  ExpenseClientOption,
  ExpenseFormData,
  VendorOption,
} from '@/features/expenses/types';
import { logger } from '@/lib/logger';
import { asRows, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** How many of each list the form offers at once. */
const OPTION_LIMIT = 300;

/**
 * Reads the lists the expense form needs.
 *
 * @param companyId Company the claim belongs to.
 * @returns The suppliers, categories and clients on offer.
 */
export async function loadExpenseFormData(companyId: string): Promise<ExpenseFormData> {
  const supabase = createServerSupabaseClient();

  const [vendorResult, categoryResult, clientResult] = await Promise.all([
    supabase
      .from('vendors')
      .select('id, display_name, currency, default_expense_account_id')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .eq('status', 'active')
      .order('display_name', { ascending: true })
      .limit(OPTION_LIMIT),
    supabase
      .from('expense_categories')
      .select('id, name, tax_rate_id')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(OPTION_LIMIT),
    supabase
      .from('clients')
      .select('id, display_name')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('display_name', { ascending: true })
      .limit(OPTION_LIMIT),
  ]);

  if (vendorResult.error || categoryResult.error || clientResult.error) {
    logger.error(
      'Could not read the expense form lists',
      vendorResult.error ?? categoryResult.error ?? clientResult.error,
      { companyId }
    );
  }

  const vendors: VendorOption[] = asRows(vendorResult.data)
    .map((row): VendorOption | null => {
      const id = readString(row, 'id');
      const name = readString(row, 'display_name');

      return id === null || name === null
        ? null
        : {
            id,
            name,
            currency: readString(row, 'currency'),
            defaultCategoryId: null,
          };
    })
    .filter((entry): entry is VendorOption => entry !== null);

  const categories: ExpenseCategoryOption[] = asRows(categoryResult.data)
    .map((row): ExpenseCategoryOption | null => {
      const id = readString(row, 'id');
      const name = readString(row, 'name');

      return id === null || name === null
        ? null
        : { id, name, taxRateId: readString(row, 'tax_rate_id') };
    })
    .filter((entry): entry is ExpenseCategoryOption => entry !== null);

  const clients: ExpenseClientOption[] = asRows(clientResult.data)
    .map((row): ExpenseClientOption | null => {
      const id = readString(row, 'id');
      const name = readString(row, 'display_name');

      return id === null || name === null ? null : { id, name };
    })
    .filter((entry): entry is ExpenseClientOption => entry !== null);

  return { vendors, categories, clients };
}

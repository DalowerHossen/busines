// src/features/receipts/actions/accept-receipt.ts
// Turning a checked receipt into a draft expense. It arrives as a draft, not
// as something approved, because reading a photograph is not approval.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { acceptReceiptSchema } from '@/features/receipts/validation/receipts';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface AcceptReceiptResult {
  /** Identifier of the draft expense that was created. */
  expenseId: string;
}

export const acceptReceipt = createAction(
  acceptReceiptSchema,
  async (input): Promise<AcceptReceiptResult> => {
    const { company } = await requirePermission('expenses', 'create');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('create_expense_from_receipt', {
      p_scan_id: input.scanId,
      p_category_id: input.categoryId ?? null,
      p_vendor_id: input.vendorId ?? null,
      p_description: input.description ?? null,
    });

    if (error || typeof data !== 'string') {
      logger.error('A receipt could not become an expense', error, {
        companyId: company.id,
      });

      throw new AppError(
        'database_failure',
        error?.message ?? 'That receipt could not be posted. Try again.'
      );
    }

    await recordAuditEntry({
      action: 'insert',
      entityType: 'expense',
      entityId: data,
      companyId: company.id,
      description: 'Created a draft expense from a receipt',
      metadata: { scanId: input.scanId },
    });

    revalidatePath(`${ROUTES.expenses}/receipts`);
    revalidatePath(ROUTES.expenses);

    return { expenseId: data };
  },
  { name: 'acceptReceipt' }
);

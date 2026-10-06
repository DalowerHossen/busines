// src/features/receipts/actions/discard-receipt.ts
// Throwing a receipt away without losing the record that it existed, which
// is what an auditor will ask about.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { discardReceiptSchema } from '@/features/receipts/validation/receipts';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface DiscardReceiptResult {
  /** True when the receipt has been thrown away. */
  wasDiscarded: boolean;
}

export const discardReceipt = createAction(
  discardReceiptSchema,
  async (input): Promise<DiscardReceiptResult> => {
    const { company } = await requirePermission('expenses', 'delete');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('discard_receipt_scan', {
      p_scan_id: input.scanId,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('A receipt could not be discarded', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'soft_delete',
      entityType: 'receipt_scan',
      entityId: input.scanId,
      companyId: company.id,
      description: 'Discarded a receipt',
      metadata: { reason: input.reason },
    });

    revalidatePath(`${ROUTES.expenses}/receipts`);

    return { wasDiscarded: data === true };
  },
  { name: 'discardReceipt' }
);

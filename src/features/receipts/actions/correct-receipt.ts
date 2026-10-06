// src/features/receipts/actions/correct-receipt.ts
// Fixing what the reader got wrong. Nothing reaches the books until a person
// has agreed with the figures.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { correctReceiptSchema } from '@/features/receipts/validation/receipts';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface CorrectReceiptResult {
  /** True when the corrections were stored. */
  wasCorrected: boolean;
}

export const correctReceipt = createAction(
  correctReceiptSchema,
  async (input): Promise<CorrectReceiptResult> => {
    const { company } = await requirePermission('expenses', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('correct_receipt_scan', {
      p_scan_id: input.scanId,
      p_fields: {
        merchant_name: input.merchantName ?? null,
        receipt_date: input.receiptDate ?? null,
        receipt_number: input.receiptNumber ?? null,
        currency: input.currency ?? null,
        subtotal_amount: input.subtotalAmount ?? null,
        tax_amount: input.taxAmount ?? null,
        total_amount: input.totalAmount ?? null,
      },
    });

    if (error) {
      logger.error('A receipt could not be corrected', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'receipt_scan',
      entityId: input.scanId,
      companyId: company.id,
      description: 'Corrected what was read from a receipt',
    });

    revalidatePath(`${ROUTES.expenses}/receipts`);

    return { wasCorrected: data === true };
  },
  { name: 'correctReceipt' }
);

// src/features/payments/actions/reverse-allocation.ts
// Takes an allocation back, for example when money was applied to the wrong
// invoice. The payment keeps its amount and can be applied again.

'use server';

import { revalidatePath } from 'next/cache';

import { reverseAllocationSchema } from '@/features/payments/validation/payment';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ReverseAllocationResult {
  /** Identifier of the allocation that was reversed. */
  allocationId: string;
}

export const reverseAllocation = createAction(
  reverseAllocationSchema,
  async (input): Promise<ReverseAllocationResult> => {
    const { company } = await requirePermission('payments', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('reverse_payment_allocation', {
      p_allocation_id: input.allocationId,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('Could not reverse an allocation', error, {
        companyId: company.id,
        allocationId: input.allocationId,
      });

      throw new AppError(
        'conflict',
        'The allocation could not be reversed. It may already have been taken back.'
      );
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'payment_allocation',
      entityId: input.allocationId,
      companyId: company.id,
      description: `Allocation reversed: ${input.reason}`,
    });

    revalidatePath('/dashboard/payments');
    revalidatePath('/dashboard/invoices');

    return { allocationId: input.allocationId };
  },
  { name: 'reverseAllocation' }
);

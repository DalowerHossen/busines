// src/features/contracts/actions/void-contract.ts
// Stopping an agreement that should never be signed. A signed one cannot be
// stopped this way; that would need a cancellation both sides agree to.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { voidContractSchema } from '@/features/contracts/validation/contracts';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface VoidContractResult {
  /** Where the agreement ended up. */
  status: string;
}

export const voidContract = createAction(
  voidContractSchema,
  async (input): Promise<VoidContractResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('void_contract', {
      p_contract_id: input.contractId,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('An agreement could not be stopped', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'contract',
      entityId: input.contractId,
      companyId: company.id,
      description: 'Stopped an agreement before it was signed',
      metadata: { reason: input.reason },
    });

    revalidatePath(ROUTES.contracts);
    revalidatePath(`${ROUTES.contracts}/${input.contractId}`);

    return { status: typeof data === 'string' ? data : 'voided' };
  },
  { name: 'voidContract' }
);

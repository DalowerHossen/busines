// src/features/contracts/actions/set-signers.ts
// Naming the people who have to sign. The list can only be changed while the
// agreement is still a draft, so nobody can be added behind a signature.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { setSignersSchema } from '@/features/contracts/validation/contracts';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SetSignersResult {
  /** How many parties the agreement now has. */
  signerCount: number;
}

export const setContractSigners = createAction(
  setSignersSchema,
  async (input): Promise<SetSignersResult> => {
    const { company } = await requirePermission('contracts', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('set_contract_signers', {
      p_contract_id: input.contractId,
      p_signers: input.signers.map((signer) => ({
        full_name: signer.fullName,
        email: signer.email,
        role_label: signer.roleLabel,
        signing_order: signer.signingOrder,
        is_internal: signer.isInternal,
      })),
    });

    if (error) {
      logger.error('The parties could not be saved', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'contract',
      entityId: input.contractId,
      companyId: company.id,
      description: 'Named the parties to an agreement',
    });

    revalidatePath(`${ROUTES.contracts}/${input.contractId}`);

    return { signerCount: typeof data === 'number' ? data : input.signers.length };
  },
  { name: 'setContractSigners' }
);

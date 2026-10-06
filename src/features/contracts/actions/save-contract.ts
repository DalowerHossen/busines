// src/features/contracts/actions/save-contract.ts
// Drafting an agreement, or editing one that has not gone out yet. Once it
// has been sent the wording is sealed, and the database refuses to move it.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { saveContractSchema } from '@/features/contracts/validation/contracts';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SaveContractResult {
  /** Identifier of the agreement that was saved. */
  contractId: string;
}

export const saveContract = createAction(
  saveContractSchema,
  async (input): Promise<SaveContractResult> => {
    const { company } = await requirePermission(
      'contracts',
      input.contractId === undefined ? 'create' : 'edit'
    );
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_contract', {
      p_company_id: company.id,
      p_title: input.title,
      p_body_html: input.bodyHtml,
      p_contract_id: input.contractId ?? null,
      p_client_id: input.clientId ?? null,
      p_currency: input.currency ?? company.baseCurrency,
      p_contract_value: input.contractValue ?? null,
      p_effective_date: input.effectiveDate ?? null,
      p_expiry_date: input.expiryDate ?? null,
      p_signing_order_enforced: input.signingOrderEnforced,
      p_notes: input.notes ?? null,
    });

    if (error || typeof data !== 'string') {
      logger.error('An agreement could not be saved', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        error?.message ?? 'That agreement could not be saved. Try again.'
      );
    }

    await recordAuditEntry({
      action: input.contractId === undefined ? 'insert' : 'update',
      entityType: 'contract',
      entityId: data,
      companyId: company.id,
      description:
        input.contractId === undefined ? 'Drafted an agreement' : 'Edited a draft agreement',
    });

    revalidatePath(ROUTES.contracts);
    revalidatePath(`${ROUTES.contracts}/${data}`);

    return { contractId: data };
  },
  { name: 'saveContract' }
);

// src/features/clients/actions/restore-client.ts
// Brings a deleted client back into the working lists.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { clientIdSchema } from '@/features/clients/validation/client';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RestoreClientResult {
  /** Identifier of the client that was brought back. */
  clientId: string;
}

export const restoreClient = createAction(
  clientIdSchema,
  async (input): Promise<RestoreClientResult> => {
    const { user, company } = await requirePermission('clients', 'delete');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('clients')
      .update({ deleted_at: null, status: 'active', updated_by: user.id })
      .eq('company_id', company.id)
      .eq('id', input.clientId)
      .not('deleted_at', 'is', null)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Could not restore a client', error, { companyId: company.id });

      throw new AppError('database_failure', 'The client could not be restored just now.');
    }

    if (asRow(data) === null) {
      throw new AppError('not_found', 'That client is not in the deleted list.');
    }

    await recordAuditEntry({
      action: 'restore',
      entityType: 'client',
      entityId: input.clientId,
      companyId: company.id,
      description: 'Client restored.',
    });

    revalidatePath(ROUTES.clients);
    revalidatePath(`${ROUTES.clients}/${input.clientId}`);

    return { clientId: input.clientId };
  },
  { name: 'restoreClient' }
);

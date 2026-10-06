// src/features/clients/actions/set-client-status.ts
// Moves a client between active, inactive and archived. Archiving keeps every
// invoice intact; it only takes the client out of the day to day lists.

'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { ROUTES } from '@/config/app';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validation/primitives';
import { CLIENT_STATUSES } from '@/types/enums';

const setClientStatusSchema = z.object({
  clientId: uuidSchema,
  status: z.enum(CLIENT_STATUSES),
});

export interface SetClientStatusResult {
  /** Status the client now holds. */
  status: (typeof CLIENT_STATUSES)[number];
}

export const setClientStatus = createAction(
  setClientStatusSchema,
  async (input): Promise<SetClientStatusResult> => {
    const { user, company } = await requirePermission('clients', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('clients')
      .update({ status: input.status, updated_by: user.id })
      .eq('company_id', company.id)
      .eq('id', input.clientId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Could not change the client status', error, { companyId: company.id });

      throw new AppError('database_failure', 'The client status could not be changed.');
    }

    if (asRow(data) === null) {
      throw new AppError('not_found', 'That client no longer exists.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'client',
      entityId: input.clientId,
      companyId: company.id,
      description: `Client status changed to ${input.status}.`,
    });

    revalidatePath(ROUTES.clients);
    revalidatePath(`${ROUTES.clients}/${input.clientId}`);

    return { status: input.status };
  },
  { name: 'setClientStatus' }
);

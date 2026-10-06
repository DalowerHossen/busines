// src/features/storage/actions/disconnect-drive.ts
// Stopping the use of a connected drive.
//
// Nothing is deleted. The files already in the drive of the business stay
// exactly where they are, under their own account, and new uploads go back
// to platform storage.

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ROUTES } from '@/config/app';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface DisconnectDriveResult {
  /** True when the drive is no longer in use. */
  isDisconnected: boolean;
}

/** The action takes nothing; the business is read from the session. */
const disconnectSchema = z.object({});

export const disconnectCompanyDrive = createAction(
  disconnectSchema,
  async (): Promise<DisconnectDriveResult> => {
    const { company } = await requireOwner();

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('disconnect_company_storage', {
      p_company_id: company.id,
    });

    if (error) {
      logger.error('A drive could not be disconnected', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'storage_target',
      entityId: company.id,
      companyId: company.id,
      description: 'Disconnected the cloud drive used for documents',
    });

    revalidatePath(`${ROUTES.settings}/storage`);

    return { isDisconnected: true };
  },
  { name: 'disconnectCompanyDrive' }
);

// src/features/marketplace/actions/uninstall-template.ts
// Removing a template. The record of what it created stays behind, so the
// business can see later what came from where.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { uninstallTemplateSchema } from '@/features/marketplace/validation/marketplace';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface UninstallTemplateResult {
  /** True once the template is no longer in use. */
  isRemoved: boolean;
}

export const uninstallTemplate = createAction(
  uninstallTemplateSchema,
  async (input): Promise<UninstallTemplateResult> => {
    const { company } = await requireOwner();

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('uninstall_listing', {
      p_install_id: input.installId,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('A template could not be removed', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'soft_delete',
      entityType: 'marketplace_install',
      entityId: input.installId,
      companyId: company.id,
      description: 'Removed a template installed from the marketplace.',
      metadata: { reason: input.reason },
    });

    revalidatePath(ROUTES.marketplace);

    return { isRemoved: true };
  },
  { name: 'uninstallTemplate' }
);

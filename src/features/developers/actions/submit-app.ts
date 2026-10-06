// src/features/developers/actions/submit-app.ts
// Putting an application in front of the platform team.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { submitAppSchema } from '@/features/developers/validation/app';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SubmitAppResult {
  /** State the application is now in. */
  status: string;
}

export const submitDeveloperApp = createAction(
  submitAppSchema,
  async (input): Promise<SubmitAppResult> => {
    const { company } = await requireOwner();
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('submit_developer_app', {
      p_app_id: input.appId,
      p_requested_scopes: input.requestedScopes,
    });

    if (error) {
      logger.error('The application could not be submitted', error, { appId: input.appId });

      throw new AppError('conflict', error.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'developer_app',
      entityId: input.appId,
      companyId: company.id,
      description: 'Application submitted for review.',
    });

    revalidatePath(`${ROUTES.dashboard}/developers/${input.appId}`);

    return { status: typeof data === 'string' ? data : 'in_review' };
  },
  { name: 'submitDeveloperApp' }
);

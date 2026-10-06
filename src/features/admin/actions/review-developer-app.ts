// src/features/admin/actions/review-developer-app.ts
// The platform decision on an application: approve it for a fixed set of
// permissions, refuse it with a reason, or stop one that is misbehaving.

'use server';

import { revalidatePath } from 'next/cache';

import { reviewAppSchema } from '@/features/developers/validation/app';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ReviewAppResult {
  /** State the application is now in. */
  status: string;
}

export const reviewDeveloperApp = createAction(
  reviewAppSchema,
  async (input): Promise<ReviewAppResult> => {
    await requireSuperAdmin();
    const supabase = createServerSupabaseClient();

    if (input.decision === 'approve') {
      if (input.allowedScopes.length === 0) {
        throw new AppError(
          'validation_failed',
          'Choose the permissions this application may ask for.'
        );
      }

      const { data, error } = await supabase.rpc('approve_developer_app', {
        p_app_id: input.appId,
        p_allowed_scopes: input.allowedScopes,
      });

      if (error || data !== true) {
        logger.error('The application could not be approved', error, { appId: input.appId });

        throw new AppError('conflict', 'That application is not waiting for a decision.');
      }
    } else if (input.decision === 'reject') {
      const { error } = await supabase.rpc('reject_developer_app', {
        p_app_id: input.appId,
        p_reason: input.reason ?? '',
      });

      if (error) {
        logger.error('The application could not be refused', error, { appId: input.appId });

        throw new AppError('conflict', error.message);
      }
    } else {
      const { error } = await supabase.rpc('set_developer_app_status', {
        p_app_id: input.appId,
        p_status: input.decision === 'suspend' ? 'suspended' : 'retired',
        p_reason: input.reason,
      });

      if (error) {
        logger.error('The application state could not be changed', error, {
          appId: input.appId,
        });

        throw new AppError('conflict', error.message);
      }
    }

    await recordAuditEntry({
      action: 'permission_change',
      entityType: 'developer_app',
      entityId: input.appId,
      description: `Application decision: ${input.decision}.`,
      metadata: { scopes: [...input.allowedScopes] },
    });

    revalidatePath('/admin/apps');

    const statusByDecision: Readonly<Record<string, string>> = {
      approve: 'approved',
      reject: 'rejected',
      suspend: 'suspended',
      retire: 'retired',
    };

    return { status: statusByDecision[input.decision] ?? 'in_review' };
  },
  { name: 'reviewDeveloperApp' }
);

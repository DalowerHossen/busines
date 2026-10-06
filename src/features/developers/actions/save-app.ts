// src/features/developers/actions/save-app.ts
// Editing how an application presents itself to the accounts it asks for
// permission from.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { saveAppSchema } from '@/features/developers/validation/app';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SaveAppResult {
  appId: string;
}

export const saveDeveloperApp = createAction(
  saveAppSchema,
  async (input): Promise<SaveAppResult> => {
    const { company } = await requireOwner();
    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('save_developer_app', {
      p_app_id: input.appId,
      p_app_name: input.appName,
      p_tagline: input.tagline,
      p_description: input.description,
      p_homepage_url: input.homepageUrl,
      p_privacy_policy_url: input.privacyPolicyUrl,
      p_support_email: input.supportEmail ?? null,
      p_webhook_url: input.webhookUrl,
      p_distribution: input.distribution,
    });

    if (error) {
      logger.error('The application could not be saved', error, { appId: input.appId });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'developer_app',
      entityId: input.appId,
      companyId: company.id,
      description: 'Application details updated.',
    });

    revalidatePath(`${ROUTES.dashboard}/developers/${input.appId}`);

    return { appId: input.appId };
  },
  { name: 'saveDeveloperApp' }
);

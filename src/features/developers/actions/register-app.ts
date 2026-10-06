// src/features/developers/actions/register-app.ts
// Registering a new application. The secret is returned exactly once, here,
// and is never readable again from anywhere in the product.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { registerAppSchema } from '@/features/developers/validation/app';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRows, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RegisterAppResult {
  appId: string;
  /** Public identifier of the application. */
  clientId: string;
  /** Secret shown once and never again. */
  clientSecret: string;
}

export const registerDeveloperApp = createAction(
  registerAppSchema,
  async (input): Promise<RegisterAppResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('register_developer_app', {
      p_app_slug: input.appSlug,
      p_app_name: input.appName,
      p_app_type: input.appType,
      p_requested_scopes: input.requestedScopes,
      p_owner_company_id: company.id,
    });

    if (error) {
      logger.error('The application could not be registered', error, { companyId: company.id });

      if (error.message.includes('already')) {
        throw new AppError('conflict', 'That application address is already taken.');
      }

      throw new AppError('database_failure', 'The application could not be registered.');
    }

    const row = asRows(data)[0];

    if (row === undefined) {
      throw new AppError('unexpected', 'The application could not be registered.');
    }

    const appId = readString(row, 'app_id') ?? '';

    await recordAuditEntry({
      action: 'insert',
      entityType: 'developer_app',
      entityId: appId,
      companyId: company.id,
      description: `Application ${input.appName} registered.`,
      metadata: { scopes: [...input.requestedScopes] },
    });

    revalidatePath(`${ROUTES.dashboard}/developers`);

    return {
      appId,
      clientId: readString(row, 'client_id') ?? '',
      clientSecret: readString(row, 'client_secret') ?? '',
    };
  },
  { name: 'registerDeveloperApp' }
);

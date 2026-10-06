// src/features/developers/actions/authorise-app.ts
// The moment an owner says yes. An authorisation code is issued, and the
// client is sent back to the address the application registered.

'use server';

import { authoriseAppSchema } from '@/features/developers/validation/app';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export interface AuthoriseAppResult {
  /** Address to send the person back to, with the code attached. */
  redirectTo: string;
}

export const authoriseApp = createAction(
  authoriseAppSchema,
  async (input): Promise<AuthoriseAppResult> => {
    const { company } = await requireOwner();

    const service = getServiceSupabaseClient();
    const { data: appData, error: appError } = await service
      .from('developer_apps')
      .select('id, app_name')
      .eq('client_id', input.clientId)
      .is('deleted_at', null)
      .maybeSingle();

    const app = asRow(appData);

    if (appError || app === null) {
      throw new AppError('not_found', 'That application could not be found.');
    }

    const appId = readString(app, 'id') ?? '';
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('create_authorization_code', {
      p_app_id: appId,
      p_company_id: company.id,
      p_redirect_uri: input.redirectUri,
      p_requested_scopes: input.scopes,
      p_code_challenge: input.codeChallenge ?? null,
      p_code_challenge_method: input.codeChallengeMethod ?? null,
    });

    if (error || typeof data !== 'string' || data.length === 0) {
      logger.error('The authorisation could not be issued', error, { appId });

      throw new AppError('forbidden', 'This application could not be connected.');
    }

    await recordAuditEntry({
      action: 'permission_change',
      entityType: 'developer_app',
      entityId: appId,
      companyId: company.id,
      description: `Access granted to ${readString(app, 'app_name') ?? 'an application'}.`,
      metadata: { scopes: [...input.scopes] },
    });

    const target = new URL(input.redirectUri);
    target.searchParams.set('code', data);

    if (input.state) {
      target.searchParams.set('state', input.state);
    }

    return { redirectTo: target.toString() };
  },
  { name: 'authoriseApp' }
);

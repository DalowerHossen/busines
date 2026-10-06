// src/features/auth/actions/start-oauth.ts
// Beginning a sign in with Google or GitHub. The action only produces the
// address to send the browser to; the exchange happens in the callback route.

'use server';

import { clientEnv } from '@/lib/env/env.client';
import { oauthStartSchema } from '@/features/auth/validation/auth';
import { createAction } from '@/lib/actions/create-action';
import { OAUTH_PROVIDERS, buildOAuthRedirectUrl, safeRedirectPath } from '@/lib/auth/oauth';
import { AppError } from '@/lib/errors';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface StartOAuthResult {
  /** Address of the provider consent screen. */
  authorizationUrl: string;
}

export const startOAuth = createAction(
  oauthStartSchema,
  async (input): Promise<StartOAuthResult> => {
    const definition = OAUTH_PROVIDERS.find((entry) => entry.provider === input.provider);

    if (!definition) {
      throw new AppError('validation_failed', 'That sign in provider is not available.');
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: definition.provider,
      options: {
        redirectTo: buildOAuthRedirectUrl(
          clientEnv.NEXT_PUBLIC_APP_URL,
          safeRedirectPath(input.nextPath)
        ),
        scopes: definition.scopes,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      throw new AppError(
        'integration_failure',
        'That provider is not reachable at the moment. Please sign in with your password.'
      );
    }

    return { authorizationUrl: data.url };
  },
  { name: 'startOAuth' }
);

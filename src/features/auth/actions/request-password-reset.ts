// src/features/auth/actions/request-password-reset.ts
// Asking for a reset link. The answer is always the same, so the form cannot
// be used to discover which addresses have an account.

'use server';

import { ROUTES } from '@/config/app';
import { clientEnv } from '@/env/client';
import { passwordResetRequestSchema } from '@/features/auth/validation/auth';
import { createAction } from '@/lib/actions/create-action';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { anonymousBucketKey, consumeRateLimit } from '@/lib/security/rate-limit';
import { getRequestContext } from '@/lib/security/request-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Reset messages allowed to one address in an hour. */
const REQUEST_LIMIT = 5;

export interface PasswordResetRequestResult {
  /** The sentence shown to the person, whatever actually happened. */
  message: string;
}

export const requestPasswordReset = createAction(
  passwordResetRequestSchema,
  async (input): Promise<PasswordResetRequestResult> => {
    const context = getRequestContext();

    const decision = await consumeRateLimit({
      kind: 'password_reset',
      key: anonymousBucketKey('password-reset', context.ipHash),
      limit: REQUEST_LIMIT,
      windowSeconds: 3600,
    });

    if (!decision.isAllowed) {
      throw new AppError(
        'rate_limited',
        'Several reset messages have already been requested. Please wait an hour.'
      );
    }

    const base = clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo: `${base}${ROUTES.resetPassword}`,
    });

    if (error) {
      logger.error('A password reset message could not be sent', error, {
        action: 'requestPasswordReset',
      });
    }

    return {
      message:
        'If that address has an account, a reset link is on its way. The link is valid for one hour.',
    };
  },
  { name: 'requestPasswordReset' }
);

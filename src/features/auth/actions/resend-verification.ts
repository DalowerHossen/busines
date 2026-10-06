// src/features/auth/actions/resend-verification.ts
// Sending the confirmation message again, for the person whose first one
// never arrived.

'use server';

import { ROUTES } from '@/config/app';
import { clientEnv } from '@/env/client';
import { resendVerificationSchema } from '@/features/auth/validation/auth';
import { createAction } from '@/lib/actions/create-action';
import { buildOAuthRedirectUrl } from '@/lib/auth/oauth';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { anonymousBucketKey, consumeRateLimit } from '@/lib/security/rate-limit';
import { getRequestContext } from '@/lib/security/request-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Confirmation messages allowed from one address in an hour. */
const RESEND_LIMIT = 4;

export interface ResendVerificationResult {
  message: string;
}

export const resendVerification = createAction(
  resendVerificationSchema,
  async (input): Promise<ResendVerificationResult> => {
    const context = getRequestContext();

    const decision = await consumeRateLimit({
      kind: 'email_verification',
      key: anonymousBucketKey('verify-email', context.ipHash),
      limit: RESEND_LIMIT,
      windowSeconds: 3600,
    });

    if (!decision.isAllowed) {
      throw new AppError(
        'rate_limited',
        'We have already sent several confirmations. Please check the spam folder and wait an hour.'
      );
    }

    const supabase = createServerSupabaseClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: input.email,
      options: {
        emailRedirectTo: buildOAuthRedirectUrl(clientEnv.NEXT_PUBLIC_APP_URL, ROUTES.dashboard),
      },
    });

    if (error) {
      logger.error('A confirmation message could not be sent again', error, {
        action: 'resendVerification',
      });
    }

    return {
      message: 'If that address is waiting to be confirmed, a new message has been sent.',
    };
  },
  { name: 'resendVerification' }
);

// src/features/auth/actions/sign-in.ts
// Signing in with an email address and a password. Attempts are limited by
// address and by account, every attempt is written down, and the answer never
// reveals whether an address is registered.

'use server';

import { ROUTES } from '@/config/app';
import { signInSchema } from '@/features/auth/validation/auth';
import { recordLoginAttempt } from '@/features/auth/services/login-attempts';
import { createAction } from '@/lib/actions/create-action';
import { safeRedirectPath } from '@/lib/auth/oauth';
import { AppError } from '@/lib/errors';
import { anonymousBucketKey, consumeRateLimit } from '@/lib/security/rate-limit';
import { getRequestContext } from '@/lib/security/request-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Sign in attempts allowed from one address in fifteen minutes. */
const ATTEMPT_LIMIT = 10;

const ATTEMPT_WINDOW_SECONDS = 900;

export interface SignInResult {
  /** Where the browser should go next. */
  redirectTo: string;
  /** True when the account still has to confirm its email address. */
  requiresEmailVerification: boolean;
}

export const signIn = createAction(
  signInSchema,
  async (input): Promise<SignInResult> => {
    const context = getRequestContext();

    const decision = await consumeRateLimit({
      kind: 'sign_in',
      key: anonymousBucketKey('sign-in', context.ipHash),
      limit: ATTEMPT_LIMIT,
      windowSeconds: ATTEMPT_WINDOW_SECONDS,
    });

    if (!decision.isAllowed) {
      throw new AppError(
        'rate_limited',
        'Too many attempts from here. Please wait a few minutes and try again.'
      );
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.user) {
      await recordLoginAttempt({
        email: input.email,
        succeeded: false,
        failureReason: error?.message ?? 'invalid_credentials',
      });

      throw new AppError('unauthenticated', 'That email address and password do not match.');
    }

    await recordLoginAttempt({ email: input.email, succeeded: true, userId: data.user.id });

    const isEmailVerified = Boolean(data.user.email_confirmed_at);

    return {
      redirectTo: isEmailVerified ? safeRedirectPath(input.nextPath) : ROUTES.verifyEmail,
      requiresEmailVerification: !isEmailVerified,
    };
  },
  { name: 'signIn' }
);

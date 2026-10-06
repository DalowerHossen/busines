// src/features/auth/actions/sign-up.ts
// Opening an account. One submission creates the login, the business it owns
// and the subscription on the free plan, then asks the person to confirm their
// email address.

'use server';

import { ROUTES } from '@/config/app';
import { clientEnv } from '@/lib/env/env.client';
import { provisionAccount } from '@/features/auth/services/provision-account';
import { recordLoginAttempt } from '@/features/auth/services/login-attempts';
import { signUpSchema } from '@/features/auth/validation/auth';
import { createAction } from '@/lib/actions/create-action';
import { buildOAuthRedirectUrl } from '@/lib/auth/oauth';
import { AppError } from '@/lib/errors';
import { anonymousBucketKey, consumeRateLimit } from '@/lib/security/rate-limit';
import { getRequestContext } from '@/lib/security/request-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Accounts that may be opened from one address in an hour. */
const SIGN_UP_LIMIT = 5;

export interface SignUpResult {
  /** Address the confirmation message was sent to. */
  email: string;
  /** Where the browser should go next. */
  redirectTo: string;
}

export const signUp = createAction(
  signUpSchema,
  async (input): Promise<SignUpResult> => {
    const context = getRequestContext();

    const decision = await consumeRateLimit({
      kind: 'sign_up',
      key: anonymousBucketKey('sign-up', context.ipHash),
      limit: SIGN_UP_LIMIT,
      windowSeconds: 3600,
    });

    if (!decision.isAllowed) {
      throw new AppError(
        'rate_limited',
        'Several accounts have already been opened from here. Please try again later.'
      );
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: buildOAuthRedirectUrl(clientEnv.NEXT_PUBLIC_APP_URL, ROUTES.dashboard),
        data: {
          full_name: input.fullName,
          company_name: input.companyName,
        },
      },
    });

    if (error || !data.user) {
      await recordLoginAttempt({
        email: input.email,
        succeeded: false,
        failureReason: error?.message ?? 'sign_up_failed',
      });

      if (error?.message.toLowerCase().includes('registered')) {
        throw new AppError(
          'conflict',
          'An account already exists for that address. Try signing in, or reset the password.'
        );
      }

      throw new AppError('unexpected', 'The account could not be created. Please try again.');
    }

    await provisionAccount({
      authUserId: data.user.id,
      email: input.email,
      fullName: input.fullName,
      companyName: input.companyName,
      countryCode: input.countryCode,
      marketingOptIn: input.marketingOptIn,
      isEmailVerified: Boolean(data.user.email_confirmed_at),
    });

    await recordLoginAttempt({ email: input.email, succeeded: true, userId: data.user.id });

    return { email: input.email, redirectTo: ROUTES.verifyEmail };
  },
  { name: 'signUp' }
);

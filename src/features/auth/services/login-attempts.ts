// src/features/auth/services/login-attempts.ts
// Every authentication attempt is written down, successful or not, so a
// lockout can be applied and an unusual sign in can be noticed later.

import 'server-only';

import { logger } from '@/lib/logger';
import { getRequestContext } from '@/lib/security/request-context';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import type { AuthProvider } from '@/types/enums';

export interface LoginAttemptInput {
  email: string;
  succeeded: boolean;
  /** Why the attempt failed; required when it did. */
  failureReason?: string;
  provider?: AuthProvider;
  userId?: string | null;
}

/**
 * Records one authentication attempt.
 *
 * Recording must never stop somebody signing in, so a failure here is logged
 * and swallowed.
 *
 * @param input What was attempted and how it ended.
 * @returns Nothing.
 */
export async function recordLoginAttempt(input: LoginAttemptInput): Promise<void> {
  try {
    const context = getRequestContext();
    const supabase = getServiceSupabaseClient();

    const { error } = await supabase.from('login_attempts').insert({
      email: input.email,
      user_id: input.userId ?? null,
      succeeded: input.succeeded,
      failure_reason: input.succeeded ? null : (input.failureReason ?? 'unknown'),
      auth_provider: input.provider ?? 'email',
      user_agent: context.userAgent,
    });

    if (error) {
      throw error;
    }
  } catch (caught) {
    logger.error('A login attempt could not be recorded', caught, {
      action: 'recordLoginAttempt',
    });
  }
}

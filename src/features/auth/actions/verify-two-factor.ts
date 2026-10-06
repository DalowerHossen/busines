// src/features/auth/actions/verify-two-factor.ts
// The second step of signing in. A code from the authenticator application is
// accepted, and so is one of the recovery codes, which is then used up.

'use server';

import { twoFactorChallengeSchema } from '@/features/auth/validation/auth';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { safeRedirectPath } from '@/lib/auth/oauth';
import { findMatchingRecoveryHash, normaliseRecoveryCode } from '@/lib/auth/recovery-codes';
import { requireUser } from '@/lib/auth/guards';
import { verifyTwoFactorCode } from '@/lib/auth/two-factor';
import { decryptSecret } from '@/lib/crypto/encryption';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { readStringArray, readString } from '@/lib/records';
import { accountBucketKey, consumeRateLimit } from '@/lib/security/rate-limit';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

/** Attempts allowed against one account in fifteen minutes. */
const ATTEMPT_LIMIT = 8;

export interface VerifyTwoFactorResult {
  redirectTo: string;
  /** True when a recovery code was spent rather than a generated code. */
  usedRecoveryCode: boolean;
  /** Recovery codes still unused after this attempt. */
  recoveryCodesRemaining: number;
}

export const verifyTwoFactor = createAction(
  twoFactorChallengeSchema,
  async (input): Promise<VerifyTwoFactorResult> => {
    const user = await requireUser();

    const decision = await consumeRateLimit({
      kind: 'two_factor',
      key: accountBucketKey('two-factor', user.id),
      limit: ATTEMPT_LIMIT,
      windowSeconds: 900,
    });

    if (!decision.isAllowed) {
      throw new AppError(
        'rate_limited',
        'Too many codes have been tried. Please wait a few minutes.'
      );
    }

    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase
      .from('user_two_factor')
      .select('secret_encrypted, recovery_code_hashes, recovery_codes_remaining, locked_until')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      logger.error('The two step settings could not be read', error, {
        action: 'verifyTwoFactor',
      });

      throw new AppError('database_failure', 'The code could not be checked. Please try again.');
    }

    if (!data) {
      throw new AppError('forbidden', 'Two step verification is not set up on this account.');
    }

    const lockedUntil = readString(data, 'locked_until');

    if (lockedUntil && Date.parse(lockedUntil) > Date.now()) {
      throw new AppError(
        'rate_limited',
        'This account is locked for a few minutes after too many wrong codes.'
      );
    }

    const secret = decryptSecret(readString(data, 'secret_encrypted') ?? '');
    const storedHashes = readStringArray(data, 'recovery_code_hashes');
    const nowIso = new Date().toISOString();

    if (verifyTwoFactorCode(secret, input.code)) {
      await supabase
        .from('user_two_factor')
        .update({ last_used_at: nowIso, failed_attempt_count: 0, locked_until: null })
        .eq('user_id', user.id);

      await recordAuditEntry({
        action: 'login',
        entityType: 'user',
        entityId: user.id,
        companyId: user.companyId,
        description: 'Completed two step verification',
      });

      return {
        redirectTo: safeRedirectPath(input.nextPath),
        usedRecoveryCode: false,
        recoveryCodesRemaining: storedHashes.length,
      };
    }

    const matched = findMatchingRecoveryHash(normaliseRecoveryCode(input.code), storedHashes);

    if (matched) {
      const remaining = storedHashes.filter((hash) => hash !== matched);

      await supabase
        .from('user_two_factor')
        .update({
          recovery_code_hashes: remaining,
          recovery_codes_remaining: remaining.length,
          last_used_at: nowIso,
          failed_attempt_count: 0,
          locked_until: null,
        })
        .eq('user_id', user.id);

      await recordAuditEntry({
        action: 'two_factor_change',
        entityType: 'user',
        entityId: user.id,
        companyId: user.companyId,
        description: 'Signed in with a recovery code',
        metadata: { recoveryCodesRemaining: remaining.length },
      });

      return {
        redirectTo: safeRedirectPath(input.nextPath),
        usedRecoveryCode: true,
        recoveryCodesRemaining: remaining.length,
      };
    }

    await recordAuditEntry({
      action: 'login_failed',
      entityType: 'user',
      entityId: user.id,
      companyId: user.companyId,
      description: 'A two step code was rejected',
    });

    throw new AppError('unauthenticated', 'That code is not right. Check the clock on your phone.');
  },
  { name: 'verifyTwoFactor' }
);

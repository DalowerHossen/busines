// src/features/contracts/actions/sign-contract.ts
// Signing from the invitation link. The signer holds no account, so the
// token is the only key, consent is captured in the same breath as the
// signature, and the address the signature came from is kept as a hash.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { signerIdForToken } from '@/features/contracts/queries/resolve-invitation';
import { signContractSchema } from '@/features/contracts/validation/contracts';
import { createAction } from '@/lib/actions/create-action';
import { sha256Hex } from '@/lib/crypto/hashing';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { getRequestContext } from '@/lib/security/request-context';
import { ELECTRONIC_CONSENT_TEXT } from '@/features/contracts/consent';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export interface SignContractResult {
  /** Where the agreement stands now. */
  status: string;
}

export const signContractFromLink = createAction(
  signContractSchema,
  async (input): Promise<SignContractResult> => {
    const limit = await consumeRateLimit({
      kind: 'contract_signing',
      key: sha256Hex(input.token),
      limit: 10,
      windowSeconds: 900,
    });

    if (!limit.isAllowed) {
      throw new AppError('rate_limited', 'That is a lot of attempts. Try again shortly.');
    }

    const signerId = await signerIdForToken(input.token);

    if (signerId === null) {
      throw new AppError('not_found', 'This signing link is no longer valid.');
    }

    const context = getRequestContext();
    const supabase = getServiceSupabaseClient();

    const { data, error } = await supabase.rpc('sign_contract', {
      p_signer_id: signerId,
      p_signature_type: 'typed',
      p_typed_signature: input.typedSignature,
      p_signature_file_id: null,
      p_consent_text: ELECTRONIC_CONSENT_TEXT,
      p_ip_hash: context.ipHash,
      p_user_agent: context.userAgent,
    });

    if (error) {
      logger.error('A signature could not be recorded', error, { signerId });

      throw new AppError('database_failure', error.message);
    }

    revalidatePath(`${ROUTES.clientSigning}/${input.token}`);

    return { status: typeof data === 'string' ? data : 'partially_signed' };
  },
  { name: 'signContractFromLink' }
);

// src/features/contracts/actions/decline-contract.ts
// Saying no from the invitation link. A refusal is as much a part of the
// record as a signature, so it is kept with a reason and stops the agreement.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { signerIdForToken } from '@/features/contracts/queries/resolve-invitation';
import { declineContractSchema } from '@/features/contracts/validation/contracts';
import { createAction } from '@/lib/actions/create-action';
import { sha256Hex } from '@/lib/crypto/hashing';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { getRequestContext } from '@/lib/security/request-context';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export interface DeclineContractResult {
  /** Where the agreement stands now. */
  status: string;
}

export const declineContractFromLink = createAction(
  declineContractSchema,
  async (input): Promise<DeclineContractResult> => {
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

    const { data, error } = await supabase.rpc('decline_contract', {
      p_signer_id: signerId,
      p_reason: input.reason,
      p_ip_hash: context.ipHash,
    });

    if (error) {
      logger.error('A refusal could not be recorded', error, { signerId });

      throw new AppError('database_failure', error.message);
    }

    revalidatePath(`${ROUTES.clientSigning}/${input.token}`);

    return { status: typeof data === 'string' ? data : 'declined' };
  },
  { name: 'declineContractFromLink' }
);

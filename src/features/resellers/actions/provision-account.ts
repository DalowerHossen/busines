// src/features/resellers/actions/provision-account.ts
// Opening an account for a client of the partner. The partner becomes
// responsible for billing it, and gains no access to what it holds.

'use server';

import { revalidatePath } from 'next/cache';

import { provisionAccountSchema } from '@/features/resellers/validation/reseller';
import { createAction } from '@/lib/actions/create-action';
import { requireUser } from '@/lib/auth/guards';
import { ROUTES } from '@/config/app';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ProvisionAccountResult {
  /** Identifier of the account that was opened. */
  companyId: string;
}

export const provisionResellerAccount = createAction(
  provisionAccountSchema,
  async (input): Promise<ProvisionAccountResult> => {
    const user = await requireUser();

    const supabase = createServerSupabaseClient();

    const { data: resellerData } = await supabase
      .from('resellers')
      .select('id, status')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    const reseller = asRow(resellerData);

    if (reseller === null) {
      throw new AppError('forbidden', 'This account is not a white label partner.');
    }

    if (readString(reseller, 'status') !== 'approved') {
      throw new AppError('forbidden', 'Accounts can be opened once your application is approved.');
    }

    const { data, error } = await supabase.rpc('provision_sub_tenant', {
      p_reseller_id: readString(reseller, 'id') ?? '',
      p_legal_name: input.legalName,
      p_display_name: input.displayName,
      p_slug: input.slug,
      p_account_reference: input.accountReference,
      p_price_book_id: null,
    });

    if (error) {
      logger.error('A partner account could not be opened', error, { userId: user.id });

      throw new AppError(
        'conflict',
        'That account was not opened. The address may be taken, or you may have reached your limit.'
      );
    }

    revalidatePath(`${ROUTES.reseller}/accounts`);

    return { companyId: typeof data === 'string' ? data : '' };
  },
  { name: 'provisionResellerAccount' }
);

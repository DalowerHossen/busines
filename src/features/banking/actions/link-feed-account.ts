// src/features/banking/actions/link-feed-account.ts
// Saying which of your own accounts the bank has been describing. Nothing is
// imported until that question is answered.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { linkFeedAccountSchema } from '@/features/banking/validation/banking';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface LinkFeedAccountResult {
  /** True when the feed account is now pointed at a ledger account. */
  isLinked: boolean;
}

export const linkFeedAccount = createAction(
  linkFeedAccountSchema,
  async (input): Promise<LinkFeedAccountResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('link_feed_account', {
      p_feed_account_id: input.feedAccountId,
      p_bank_account_id: input.bankAccountId,
      p_import_from_date: input.importFromDate ?? null,
    });

    if (error) {
      logger.error('A feed account could not be linked', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'bank_feed_account',
      entityId: input.feedAccountId,
      companyId: company.id,
      description: 'Pointed a bank feed at one of our accounts',
      metadata: { bankAccountId: input.bankAccountId },
    });

    revalidatePath(`${ROUTES.banking}/feeds`);

    return { isLinked: data === true };
  },
  { name: 'linkFeedAccount' }
);

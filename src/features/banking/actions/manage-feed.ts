// src/features/banking/actions/manage-feed.ts
// How often a bank is read, and how a connection is ended. Open banking
// consent runs out on its own, so ending one deliberately has to be just as
// tidy: the tokens go, the history stays.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { disconnectFeedSchema, feedFrequencySchema } from '@/features/banking/validation/banking';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface FeedFrequencyResult {
  /** Hours between reads after the change. */
  syncFrequencyHours: number;
}

export const setFeedFrequency = createAction(
  feedFrequencySchema,
  async (input): Promise<FeedFrequencyResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('set_feed_frequency', {
      p_connection_id: input.connectionId,
      p_sync_frequency_hours: input.syncFrequencyHours,
    });

    if (error) {
      logger.error('The reading frequency of a feed could not be changed', error, {
        companyId: company.id,
      });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'bank_feed_connection',
      entityId: input.connectionId,
      companyId: company.id,
      description: `Set a bank feed to be read every ${input.syncFrequencyHours} hours`,
    });

    revalidatePath(`${ROUTES.banking}/feeds`);

    return { syncFrequencyHours: input.syncFrequencyHours };
  },
  { name: 'setFeedFrequency' }
);

export interface DisconnectFeedResult {
  /** True when the connection has been ended. */
  isDisconnected: boolean;
}

export const disconnectFeed = createAction(
  disconnectFeedSchema,
  async (input): Promise<DisconnectFeedResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('disconnect_bank_feed', {
      p_connection_id: input.connectionId,
      p_reason: input.reason,
    });

    if (error) {
      logger.error('A bank connection could not be ended', error, { companyId: company.id });

      throw new AppError('database_failure', error.message);
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'bank_feed_connection',
      entityId: input.connectionId,
      companyId: company.id,
      description: 'Ended a bank connection',
      metadata: { reason: input.reason },
    });

    revalidatePath(`${ROUTES.banking}/feeds`);

    return { isDisconnected: data === true };
  },
  { name: 'disconnectFeed' }
);

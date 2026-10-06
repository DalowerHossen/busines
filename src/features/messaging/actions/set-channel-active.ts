// src/features/messaging/actions/set-channel-active.ts
// Switching a channel off is how a business stops spending on it without
// losing what was configured. Switching it back on is one click.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { channelStateSchema } from '@/features/messaging/validation/channels';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SetChannelActiveResult {
  /** Whether the channel is on after the change. */
  isActive: boolean;
}

export const setChannelActive = createAction(
  channelStateSchema,
  async (input): Promise<SetChannelActiveResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('set_messaging_channel_active', {
      p_channel_id: input.channelId,
      p_is_active: input.isActive,
    });

    if (error) {
      logger.error('A messaging channel could not be switched', error, {
        companyId: company.id,
      });

      throw new AppError('database_failure', 'That channel could not be changed. Try again.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'messaging_channel',
      entityId: input.channelId,
      companyId: company.id,
      description: input.isActive
        ? 'Switched a messaging channel on'
        : 'Switched a messaging channel off',
    });

    revalidatePath(`${ROUTES.messages}/channels`);

    return { isActive: data === true };
  },
  { name: 'setChannelActive' }
);
